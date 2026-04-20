import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getNewsForSymbols, getNewsFeed, type NewsItem } from "@/lib/news/feeds";
import { isHot } from "@/lib/news/hotness";
import { sendEmail, hotNewsEmailHtml } from "@/lib/email/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

interface UserSettingsRow {
  user_id: string;
  hot_news_email: boolean;
  hot_news_min_score: number;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runHotNews();
}

// POST also supported so the Alerts page "Check now" button can hit it with the user's cookie.
// When called via POST we require a valid user session and only process that one user.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}` || req.headers.get("x-vercel-cron");
  if (isCron) return runHotNews();

  // Fall through to per-user on-demand
  const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return runHotNews(user.id);
}

async function runHotNews(onlyUserId?: string) {
  const supabase = supabaseAdmin();
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";

  let settingsQuery = supabase
    .from("user_settings")
    .select("user_id, hot_news_email, hot_news_min_score")
    .eq("hot_news_email", true);
  if (onlyUserId) settingsQuery = settingsQuery.eq("user_id", onlyUserId);

  const { data: settings, error } = await settingsQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!settings?.length) return NextResponse.json({ users: 0, flagged: 0, emailed: 0 });

  const results: { user_id: string; flagged: number; emailed: number }[] = [];

  for (const s of settings as UserSettingsRow[]) {
    const flagged = await processUser(supabase, s, appUrl);
    results.push({ user_id: s.user_id, ...flagged });
  }

  const totals = results.reduce(
    (acc, r) => ({ flagged: acc.flagged + r.flagged, emailed: acc.emailed + r.emailed }),
    { flagged: 0, emailed: 0 },
  );

  return NextResponse.json({ users: results.length, ...totals, results });
}

async function processUser(
  supabase: ReturnType<typeof supabaseAdmin>,
  s: UserSettingsRow,
  appUrl: string,
): Promise<{ flagged: number; emailed: number }> {
  // Collect user's tickers from positions + watchlist
  const [{ data: positions }, { data: watchlist }] = await Promise.all([
    supabase.from("v_open_positions").select("ticker, asset_class").eq("user_id", s.user_id),
    supabase.from("watchlist").select("ticker, asset_class").eq("user_id", s.user_id),
  ]);

  const pairs: { ticker: string; asset_class: string }[] = [];
  const seen = new Set<string>();
  for (const row of [...(positions || []), ...(watchlist || [])]) {
    const key = `${row.asset_class}:${row.ticker}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ ticker: row.ticker, asset_class: row.asset_class });
  }

  let items: NewsItem[] = [];
  if (pairs.length) {
    items = await getNewsForSymbols(pairs.slice(0, 24), 6);
  }
  // Also pull global markets feed so the user gets macro-level hot news
  const macroItems = await getNewsFeed("markets", 30).catch(() => []);
  const macroHot = macroItems.filter((m) => isHot(m, s.hot_news_min_score).hot);

  const merged: (NewsItem & { ticker?: string | null })[] = [
    ...items.map((i) => ({ ...i, ticker: i.symbols?.[0] || null })),
    ...macroHot.map((m) => ({ ...m, ticker: null })),
  ];

  // Score + filter
  type HotItem = NewsItem & { ticker?: string | null; score: number; reasons: string[] };
  const hotItems: HotItem[] = [];
  for (const it of merged) {
    const h = isHot(it, s.hot_news_min_score);
    if (h.hot) hotItems.push({ ...it, score: h.score, reasons: h.reasons });
  }

  if (hotItems.length === 0) return { flagged: 0, emailed: 0 };

  // Dedup against already-sent
  const ids = hotItems.map((h) => h.id);
  const { data: already } = await supabase
    .from("news_alert_sent")
    .select("news_id")
    .eq("user_id", s.user_id)
    .in("news_id", ids);
  const sentIds = new Set((already || []).map((r) => r.news_id));
  const fresh = hotItems
    .filter((h) => !sentIds.has(h.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  if (fresh.length === 0) return { flagged: hotItems.length, emailed: 0 };

  // Resolve email
  const { data: authUser } = await supabase.auth.admin.getUserById(s.user_id);
  const email = authUser?.user?.email;

  let emailed = 0;
  if (email) {
    const send = await sendEmail({
      to: email,
      subject: `Aeternum — ${fresh.length} hot news ${fresh.length === 1 ? "item" : "items"}${fresh[0].ticker ? ` · ${fresh[0].ticker}` : ""}`,
      html: hotNewsEmailHtml({
        items: fresh.map((f) => ({
          title: f.title,
          url: f.url,
          source: f.source,
          ticker: f.ticker,
          score: f.score,
          reasons: f.reasons,
          published: f.published,
        })),
        app_url: appUrl,
      }),
    });
    if (send.ok) emailed = fresh.length;
  }

  // Log all fresh items as sent (even if email failed — dedupe on retry)
  const rows = fresh.map((f) => ({
    user_id: s.user_id,
    news_id: f.id,
    ticker: f.ticker,
    title: f.title.slice(0, 512),
    url: f.url,
    source: f.source,
    score: f.score,
    reasons: f.reasons,
    email_ok: emailed > 0,
  }));
  if (rows.length) {
    await supabase.from("news_alert_sent").upsert(rows, { onConflict: "user_id,news_id", ignoreDuplicates: true });
  }

  await supabase
    .from("user_settings")
    .update({ hot_news_last_run_at: new Date().toISOString() })
    .eq("user_id", s.user_id);

  return { flagged: hotItems.length, emailed };
}
