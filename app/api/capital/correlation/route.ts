import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { pearson, alignedLogReturns, type SeriesPoint } from "@/lib/analytics/correlation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOOKS = ["investing", "idx_trading", "crypto_trading"] as const;
type Book = (typeof BOOKS)[number];

/**
 * Cross-arm correlation — pairwise Pearson on daily log-returns of NAV
 * per book over the requested window.  Default 90d.
 *
 * Response:
 *   {
 *     window_days: number,
 *     aligned_days: number,      // actual overlapping observations
 *     pairs: [{ a, b, correlation: number | null }, ...]
 *   }
 *
 * Correlation is null when any series has < 5 aligned observations.
 * The UI shows "insufficient history" in that case rather than a
 * number that looks real.
 */
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const days = Math.min(365, Math.max(14, Number(req.nextUrl.searchParams.get("days") || "90")));
  const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("nav_history")
    .select("snapshot_date, nav_idr, book")
    .eq("user_id", user.id)
    .in("book", BOOKS as unknown as string[])
    .gte("snapshot_date", startDate)
    .order("snapshot_date", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const series: Record<Book, SeriesPoint[]> = {
    investing: [],
    idx_trading: [],
    crypto_trading: [],
  };
  for (const r of data || []) {
    const b = r.book as Book;
    if (!series[b]) continue;
    const v = Number(r.nav_idr);
    if (!Number.isFinite(v) || v <= 0) continue;
    series[b].push({ date: r.snapshot_date, value: v });
  }

  const { dates, returns } = alignedLogReturns({
    investing: series.investing,
    idx_trading: series.idx_trading,
    crypto_trading: series.crypto_trading,
  });

  const pairs = [
    { a: "investing", b: "idx_trading", correlation: pearson(returns.investing, returns.idx_trading) },
    { a: "investing", b: "crypto_trading", correlation: pearson(returns.investing, returns.crypto_trading) },
    { a: "idx_trading", b: "crypto_trading", correlation: pearson(returns.idx_trading, returns.crypto_trading) },
  ];

  return NextResponse.json({
    window_days: days,
    aligned_days: dates.length,
    pairs,
  });
}
