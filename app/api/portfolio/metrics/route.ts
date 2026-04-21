import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { computeMetrics } from "@/lib/analytics/metrics";
import type { BookFilter } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface NavRow {
  snapshot_date: string;
  nav_idr: number;
  book: string;
}
interface BenchRow {
  snapshot_date: string;
  close: number;
  symbol: string;
}

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const bookFilter = (req.nextUrl.searchParams.get("book") || "all") as BookFilter;
  const bookKey = bookFilter === "all" ? "all" : bookFilter;

  const { data: navRows } = await supabase
    .from("nav_history")
    .select("snapshot_date, nav_idr, book")
    .eq("user_id", user.id)
    .eq("book", bookKey)
    .order("snapshot_date", { ascending: true });

  const { data: benchRows } = await supabase
    .from("benchmark_history")
    .select("snapshot_date, close, symbol")
    .in("symbol", ["^JKSE", "^GSPC"])
    .order("snapshot_date", { ascending: true });

  const portfolio = (navRows || []).map((r: NavRow) => ({ date: r.snapshot_date, value: Number(r.nav_idr) }));
  const ihsg = ((benchRows || []) as BenchRow[])
    .filter((r) => r.symbol === "^JKSE")
    .map((r) => ({ date: r.snapshot_date, value: Number(r.close) }));
  const spx = ((benchRows || []) as BenchRow[])
    .filter((r) => r.symbol === "^GSPC")
    .map((r) => ({ date: r.snapshot_date, value: Number(r.close) }));

  // Crypto trades 24/7 → √365 annualization. Equity books → √252.
  // For `all`, 252 is the honest pragmatic choice since IDX+US dominate the
  // book and crypto noise on non-trading days is just the crypto book tracking
  // itself (no forced weekend bias).
  const periods = bookFilter === "crypto_trading" ? 365 : 252;
  const metrics = computeMetrics(portfolio, ihsg, spx, new Date(), periods);
  return NextResponse.json(metrics);
}
