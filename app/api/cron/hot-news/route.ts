import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getNewsForSymbols, getNewsFeed, type NewsItem } from "@/lib/news/feeds";
import { isHot } from "@/lib/news/hotness";
import { agentShortlist } from "@/lib/news/llm-filter";
import { sendEmail, hotNewsEmailHtml } from "@/lib/email/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeEq(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return timingSafeEqual(A, B);
}

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  return safeEq(auth, `Bearer ${secret}`);
}

interface UserSettingsRow {
  user_id: string;
  hot_news_email: boolean;
  hot_news_min_score: number;
  cc_emails: string[] | null;
}

/**
 * Two modes:
 * - "full"     : broad 3-hour sweep. User's `hot_news_min_score` threshold,
 *                agent urgency >= 2, no recency cap.
 * - "realtime" : every-5-min pulse. Only items published in the last 20 min,
 *                higher bar (score >= 85 / agent urgency == 3), fires the
 *                moment something structural hits the wire.
 */
type Mode = "full" | "realtime";

function parseMode(req: NextRequest): Mode {
  const m = req.nextUrl.searchParams.get("realtime");
  return m === "1" || m === "true" ? "realtime" : "full";
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runHotNews(undefined, parseMode(req));
}

// POST also supported so the Alerts page "Check now" button can hit it with the user's cookie.
// When called via POST we require a valid user session and only process that one user.
export async function POST(req: NextRequest) {
  const mode = parseMode(req);
  if (isAuthorized(req)) return runHotNews(undefined, mode);

  // Fall through to per-user on-demand
  const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return runHotNews(user.id, mode);
}

async function runHotNews(onlyUserId: string | undefined, mode: Mode) {
  const supabase = supabaseAdmin();
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";

  let settingsQuery = supabase
    .from("user_settings")
    .select("user_id, hot_news_email, hot_news_min_score, cc_emails")
    .eq("hot_news_email", true);
  if (onlyUserId) settingsQuery = settingsQuery.eq("user_id", onlyUserId);

  const { data: settings, error } = await settingsQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!settings?.length) return NextResponse.json({ users: 0, flagged: 0, emailed: 0, mode });

  const results: { user_id: string; flagged: number; emailed: number }[] = [];

  for (const s of settings as UserSettingsRow[]) {
    const flagged = await processUser(supabase, s, appUrl, mode);
    results.push({ user_id: s.user_id, ...flagged });
  }

  const totals = results.reduce(
    (acc, r) => ({ flagged: acc.flagged + r.flagged, emailed: acc.emailed + r.emailed }),
    { flagged: 0, emailed: 0 },
  );

  return NextResponse.json({ users: results.length, mode, ...totals, results });
}

async function processUser(
  supabase: ReturnType<typeof supabaseAdmin>,
  s: UserSettingsRow,
  appUrl: string,
  mode: Mode,
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

  // Realtime mode pulls fewer headlines per source — we only care about the
  // freshest stuff and cut token cost on the Llama classifier.
  const perSymbol = mode === "realtime" ? 3 : 6;
  const feedSize = mode === "realtime"
    ? { macro: 12, idx: 12, markets: 6, crypto: 6, economy: 6 }
    : { macro: 30, idx: 25, markets: 15, crypto: 15, economy: 15 };

  let items: NewsItem[] = [];
  if (pairs.length) {
    items = await getNewsForSymbols(pairs.slice(0, 24), perSymbol);
  }
  // Pull broad macro/IDX/markets/crypto/economy topic feeds so the agent sees
  // the full set of stuff that transmits into the portfolio (oil, Fed, DXY, China, etc.).
  const [macroItems, idxItems, marketsItems, cryptoItems, economyItems] = await Promise.all([
    getNewsFeed("macro", feedSize.macro).catch(() => []),
    getNewsFeed("idx", feedSize.idx).catch(() => []),
    getNewsFeed("markets", feedSize.markets).catch(() => []),
    getNewsFeed("crypto", feedSize.crypto).catch(() => []),
    getNewsFeed("economy", feedSize.economy).catch(() => []),
  ]);

  const merged: (NewsItem & { ticker?: string | null })[] = [
    ...items.map((i) => ({ ...i, ticker: i.symbols?.[0] || null })),
    ...macroItems.map((m) => ({ ...m, ticker: null })),
    ...idxItems.map((m) => ({ ...m, ticker: null })),
    ...marketsItems.map((m) => ({ ...m, ticker: null })),
    ...cryptoItems.map((m) => ({ ...m, ticker: null })),
    ...economyItems.map((m) => ({ ...m, ticker: null })),
  ];

  // Deduplicate across sources
  const seenId = new Set<string>();
  let dedup = merged.filter((m) => {
    if (seenId.has(m.id)) return false;
    seenId.add(m.id);
    return true;
  });

  // Realtime: 20-min window (4× overlap with 5-min schedule).
  // Full sweep: 48h window. Without this cap the Google News RSS kept
  // recycling stale "Top Story" clusters, leading to year-old headlines
  // landing in fresh hot-news emails. 48h gives weekend/holiday slack
  // while still cutting the worst of the stale noise.
  const recencyCutoffMs = mode === "realtime" ? 20 * 60 * 1000 : 48 * 60 * 60 * 1000;
  const cutoff = Date.now() - recencyCutoffMs;
  dedup = dedup.filter((m) => m.published >= cutoff);

  if (dedup.length === 0) return { flagged: 0, emailed: 0 };

  // Agent reasons about cross-asset transmission paths relative to THIS portfolio.
  const ctx = {
    tickers: pairs.map((p) => p.ticker),
    asset_classes: Array.from(new Set(pairs.map((p) => p.asset_class))),
  };

  // Realtime uses the tightest bar: only urgency-3 events and heuristic
  // score >= 85 — MSCI/FTSE rebalances, halts, Fed surprises, IDR breaks,
  // sovereign ratings. Medium-urgency stuff waits for the 3-hour sweep.
  const effectiveMinScore = mode === "realtime" ? 85 : s.hot_news_min_score;
  const effectiveMinUrgency = mode === "realtime" ? 3 : 2;
  const shortlisted = await agentShortlist(dedup, effectiveMinScore, effectiveMinUrgency, ctx);

  type HotItem = NewsItem & { ticker?: string | null; score: number; reasons: string[] };
  const hotItems: HotItem[] = shortlisted.map((it) => {
    const h = isHot(it, effectiveMinScore);
    return {
      ...it,
      score: it.score ?? h.score,
      reasons: it.reasons?.length ? it.reasons : h.reasons,
    };
  });

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
    .slice(0, mode === "realtime" ? 5 : 15);

  if (fresh.length === 0) return { flagged: hotItems.length, emailed: 0 };

  // Resolve email
  const { data: authUser } = await supabase.auth.admin.getUserById(s.user_id);
  const email = authUser?.user?.email;

  let emailed = 0;
  if (email) {
    // News-track subjects all start with "Aeternum News" so a single
    // Gmail filter (subject:"Aeternum News") forwards the hot-news stream
    // to the distribution list while Signal/Alert subjects stay local.
    const tickerSuffix = fresh[0].ticker ? ` · ${fresh[0].ticker}` : "";
    const plural = fresh.length === 1 ? "item" : "items";
    const subject = mode === "realtime"
      ? `Aeternum News ⚡ BREAKING — ${fresh[0].title.slice(0, 68)}${fresh.length > 1 ? ` (+${fresh.length - 1})` : ""}`
      : `Aeternum News — ${fresh.length} hot ${plural}${tickerSuffix}`;

    const send = await sendEmail({
      to: email,
      cc: (s.cc_emails || []).filter(Boolean),
      subject,
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
