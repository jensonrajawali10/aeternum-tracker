import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getQuote, getUsdIdr } from "@/lib/prices";
import type { AssetClass } from "@/lib/types";
import { sendEmail, marketRecapEmailHtml } from "@/lib/email/resend";
import { sessionBrief } from "@/lib/news/llm-brief";

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

type Session = "idx_close" | "us_close";

function parseSession(req: NextRequest): Session {
  const s = req.nextUrl.searchParams.get("session");
  return s === "us_close" ? "us_close" : "idx_close";
}

/**
 * Session → benchmark symbols shown at the top of the recap.
 * IDX close emphasises IHSG + USD/IDR, US close emphasises S&P + Nasdaq.
 */
const SESSION_BENCHMARKS: Record<Session, { symbol: string; name: string }[]> = {
  idx_close: [
    { symbol: "^JKSE", name: "IHSG" },
    { symbol: "^GSPC", name: "S&P 500" },
  ],
  us_close: [
    { symbol: "^GSPC", name: "S&P 500" },
    { symbol: "^IXIC", name: "Nasdaq" },
    { symbol: "^JKSE", name: "IHSG" },
  ],
};

function sessionLabel(s: Session): string {
  return s === "idx_close" ? "IDX Close" : "US Close";
}

function sessionDateKey(s: Session, now = new Date()): string {
  // IDX close recap belongs to the Asia/Jakarta calendar day.
  // US close recap belongs to the America/New_York calendar day.
  const tz = s === "idx_close" ? "Asia/Jakarta" : "America/New_York";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Pull latest close + previous close for each benchmark from benchmark_history.
 * Fall back to live quote if today's close isn't in the table yet (daily-snapshot
 * runs at 22:00 UTC which is after US close, so we usually have fresh data).
 */
async function getBenchmarkState(
  supabase: ReturnType<typeof supabaseAdmin>,
  symbols: { symbol: string; name: string }[],
): Promise<{ name: string; symbol: string; close: number | null; day_pct: number | null; ccy: string }[]> {
  const out: { name: string; symbol: string; close: number | null; day_pct: number | null; ccy: string }[] = [];
  for (const s of symbols) {
    const { data } = await supabase
      .from("benchmark_history")
      .select("snapshot_date, close")
      .eq("symbol", s.symbol)
      .order("snapshot_date", { ascending: false })
      .limit(2);
    const rows = (data || []) as { snapshot_date: string; close: number }[];
    let close: number | null = rows[0]?.close ?? null;
    let prev: number | null = rows[1]?.close ?? null;

    // Live-quote fallback — benchmark_history may be stale by a day.
    const live = await getQuote(s.symbol, "idx_equity" as AssetClass).catch(() => null);
    if (live?.price) {
      close = live.price;
      if (live.prev_close) prev = live.prev_close;
    }

    const day_pct = close !== null && prev !== null && prev !== 0 ? ((close - prev) / prev) * 100 : null;
    out.push({
      name: s.name,
      symbol: s.symbol,
      close,
      day_pct,
      ccy: s.symbol === "^JKSE" ? "IDR" : "USD",
    });
  }
  return out;
}

interface NewsRow {
  news_id: string;
  ticker: string | null;
  title: string;
  url: string;
  source: string;
  score: number;
  reasons: string[] | null;
  sent_at: string;
}

/**
 * Pull recently flagged hot-news items for this user. Look back 14 hours for
 * IDX close (covers the full WIB trading day) and 14 hours for US close.
 * This intentionally overlaps sessions so the US close recap still surfaces
 * the big IDX story if it hit overnight.
 */
async function getSessionNews(
  supabase: ReturnType<typeof supabaseAdmin>,
  user_id: string,
  session: Session,
): Promise<NewsRow[]> {
  const hoursBack = 14;
  const cutoff = new Date(Date.now() - hoursBack * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("news_alert_sent")
    .select("news_id, ticker, title, url, source, score, reasons, sent_at")
    .eq("user_id", user_id)
    .gte("sent_at", cutoff)
    .order("score", { ascending: false })
    .limit(20);
  void session; // kept for future session-specific filtering
  return (data || []) as NewsRow[];
}

interface RecapUserRow {
  user_id: string;
  market_recap_email: boolean;
  cc_emails: string[] | null;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return run(req, undefined);
}

export async function POST(req: NextRequest) {
  if (isAuthorized(req)) return run(req, undefined);
  const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return run(req, user.id);
}

async function run(req: NextRequest, onlyUserId: string | undefined) {
  const session = parseSession(req);
  const supabase = supabaseAdmin();
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";

  let settingsQuery = supabase
    .from("user_settings")
    .select("user_id, market_recap_email, cc_emails")
    .eq("market_recap_email", true);
  if (onlyUserId) settingsQuery = settingsQuery.eq("user_id", onlyUserId);
  const { data: settings, error } = await settingsQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!settings?.length) return NextResponse.json({ users: 0, emailed: 0, session });

  const dateKey = sessionDateKey(session);
  const sessionKey = `${session}_${dateKey}`;

  const benchmarks = await getBenchmarkState(supabase, SESSION_BENCHMARKS[session]);
  // USD/IDR is not a benchmark in the Chart sense but it anchors the recap.
  const usdIdr = (await getUsdIdr().catch(() => null)) ?? null;
  if (usdIdr) {
    benchmarks.push({
      name: "USD/IDR",
      symbol: "USDIDR=X",
      close: usdIdr,
      day_pct: null,
      ccy: "IDR",
    });
  }

  const results: { user_id: string; emailed: boolean; reason?: string }[] = [];

  for (const s of settings as RecapUserRow[]) {
    // Dedup: already sent this session?
    const { data: already } = await supabase
      .from("market_recap_sent")
      .select("session")
      .eq("user_id", s.user_id)
      .eq("session", sessionKey)
      .maybeSingle();
    if (already) {
      results.push({ user_id: s.user_id, emailed: false, reason: "already_sent" });
      continue;
    }

    const news = await getSessionNews(supabase, s.user_id, session);

    const { data: authUser } = await supabase.auth.admin.getUserById(s.user_id);
    const email = authUser?.user?.email;
    if (!email) {
      results.push({ user_id: s.user_id, emailed: false, reason: "no_email" });
      continue;
    }

    const newsForTemplate = news.map((n) => ({
      title: n.title,
      url: n.url,
      source: n.source,
      ticker: n.ticker,
      score: n.score,
      reasons: n.reasons || [],
      published: new Date(n.sent_at).getTime(),
    }));

    const benchLead = benchmarks.find((b) => b.symbol === (session === "idx_close" ? "^JKSE" : "^GSPC"));
    const leadPct = benchLead?.day_pct;
    const leadSuffix =
      leadPct === null || leadPct === undefined || !Number.isFinite(leadPct)
        ? ""
        : ` · ${benchLead?.name} ${leadPct > 0 ? "+" : ""}${leadPct.toFixed(2)}%`;

    const subject = `Aeternum News — ${sessionLabel(session)} Recap${leadSuffix}`;

    // LLM narrative brief — 3-4 sentences on what happened this session.
    const brief = await sessionBrief({
      session_label: sessionLabel(session),
      benchmarks,
      headlines: newsForTemplate.map((n) => ({
        title: n.title,
        source: n.source,
        ticker: n.ticker,
        score: n.score,
      })),
    });

    const html = marketRecapEmailHtml({
      session_label: sessionLabel(session),
      session_date: dateKey,
      brief,
      benchmarks,
      news: newsForTemplate,
      app_url: appUrl,
    });

    const send = await sendEmail({
      to: email,
      cc: (s.cc_emails || []).filter(Boolean),
      subject,
      html,
    });

    await supabase.from("market_recap_sent").upsert(
      {
        user_id: s.user_id,
        session: sessionKey,
        email_ok: send.ok,
        headline_count: newsForTemplate.length,
      },
      { onConflict: "user_id,session", ignoreDuplicates: false },
    );

    await supabase
      .from("user_settings")
      .update({ market_recap_last_run_at: new Date().toISOString() })
      .eq("user_id", s.user_id);

    results.push({ user_id: s.user_id, emailed: send.ok, reason: send.ok ? undefined : send.error });
  }

  const emailed = results.filter((r) => r.emailed).length;
  return NextResponse.json({ users: results.length, emailed, session: sessionKey, results });
}
