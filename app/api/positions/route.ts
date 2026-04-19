import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getQuote, getUsdIdr } from "@/lib/prices";
import type { AssetClass, BookFilter, BookType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OpenPositionRow {
  ticker: string;
  asset_class: AssetClass;
  book: BookType;
  net_qty: number;
  avg_entry: number;
  stop_loss: number | null;
  take_profit: number | null;
  pnl_currency: "IDR" | "USD";
  fx_rate_to_idr: number | null;
  opened_at: string;
  leg_count: number;
}

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const bookFilter = (req.nextUrl.searchParams.get("book") || "all") as BookFilter;
  const displayCurrency = (req.nextUrl.searchParams.get("ccy") || "IDR") as "IDR" | "USD";

  let q = supabase.from("v_open_positions").select("*").eq("user_id", user.id);
  if (bookFilter !== "all") q = q.eq("book", bookFilter);
  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const positions = (rows || []) as OpenPositionRow[];
  const usdIdr = (await getUsdIdr()) ?? 16500;

  const enriched = await Promise.all(
    positions.map(async (p) => {
      const quote = await getQuote(p.ticker, p.asset_class);
      const liveNative = quote?.price ?? null;
      const fxToIdr = p.pnl_currency === "IDR" ? 1 : p.fx_rate_to_idr ?? usdIdr;
      const liveIdr = liveNative != null ? liveNative * (p.pnl_currency === "IDR" ? 1 : usdIdr) : null;
      const entryIdr = p.avg_entry * (p.pnl_currency === "IDR" ? 1 : fxToIdr);
      const marketValueIdr = liveIdr != null ? liveIdr * p.net_qty : null;
      const unrealizedIdr = liveIdr != null ? (liveIdr - entryIdr) * p.net_qty : null;
      const unrealizedPct = liveNative != null && p.avg_entry ? ((liveNative - p.avg_entry) / p.avg_entry) * 100 : null;
      const marketValueUsd = marketValueIdr != null ? marketValueIdr / usdIdr : null;
      const unrealizedUsd = unrealizedIdr != null ? unrealizedIdr / usdIdr : null;
      return {
        ticker: p.ticker,
        asset_class: p.asset_class,
        book: p.book,
        qty: p.net_qty,
        avg_entry: p.avg_entry,
        stop_loss: p.stop_loss,
        take_profit: p.take_profit,
        live_price: liveNative,
        currency: p.pnl_currency,
        day_change_pct: quote?.day_change_pct ?? null,
        market_value_idr: marketValueIdr,
        market_value_usd: marketValueUsd,
        unrealized_pnl_idr: unrealizedIdr,
        unrealized_pnl_usd: unrealizedUsd,
        unrealized_pnl_pct: unrealizedPct,
        opened_at: p.opened_at,
        leg_count: p.leg_count,
      };
    }),
  );

  const totalMV = enriched.reduce((a, p) => a + (p.market_value_idr || 0), 0);
  const withPct = enriched.map((p) => ({
    ...p,
    pct_of_nav: totalMV > 0 && p.market_value_idr != null ? (p.market_value_idr / totalMV) * 100 : null,
  }));

  return NextResponse.json({
    positions: withPct,
    fx: { usd_idr: usdIdr },
    display_currency: displayCurrency,
  });
}
