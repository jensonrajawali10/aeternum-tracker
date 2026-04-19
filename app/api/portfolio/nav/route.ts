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
  pnl_currency: "IDR" | "USD";
  fx_rate_to_idr: number | null;
}

interface RealizedRow {
  net_pnl_native: number | null;
  pnl_native: number | null;
  pnl_currency: "IDR" | "USD";
  fx_rate_to_idr: number | null;
  book: BookType;
  trade_date: string;
}

function toIdr(value: number, ccy: "IDR" | "USD", fx: number | null, usdIdr: number): number {
  if (ccy === "IDR") return value;
  return value * (fx ?? usdIdr);
}

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const bookFilter = (req.nextUrl.searchParams.get("book") || "all") as BookFilter;
  const usdIdr = (await getUsdIdr()) ?? 16500;

  let openQuery = supabase.from("v_open_positions").select("*").eq("user_id", user.id);
  if (bookFilter !== "all") openQuery = openQuery.eq("book", bookFilter);
  const { data: openRows, error: openErr } = await openQuery;
  if (openErr) return NextResponse.json({ error: openErr.message }, { status: 500 });
  const opens = (openRows || []) as OpenPositionRow[];

  const enriched = await Promise.all(
    opens.map(async (p) => {
      const quote = await getQuote(p.ticker, p.asset_class);
      const liveNative = quote?.price ?? p.avg_entry;
      const mvNative = liveNative * p.net_qty;
      const costNative = p.avg_entry * p.net_qty;
      const mvIdr = toIdr(mvNative, p.pnl_currency, p.fx_rate_to_idr, usdIdr);
      const costIdr = toIdr(costNative, p.pnl_currency, p.fx_rate_to_idr, usdIdr);
      const unrealIdr = mvIdr - costIdr;
      return { book: p.book, mvIdr, costIdr, unrealIdr };
    }),
  );

  let realizedQuery = supabase
    .from("trades")
    .select("net_pnl_native,pnl_native,pnl_currency,fx_rate_to_idr,book,trade_date")
    .eq("user_id", user.id)
    .not("exit_price", "is", null);
  if (bookFilter !== "all") realizedQuery = realizedQuery.eq("book", bookFilter);
  const { data: realizedRows } = await realizedQuery;
  const realized = (realizedRows || []) as RealizedRow[];

  const year = new Date().getFullYear();
  const ytdStart = `${year}-01-01`;

  const byBook = (b: BookType) => {
    const exp = enriched.filter((p) => p.book === b);
    const gross_mv = exp.reduce((a, p) => a + Math.abs(p.mvIdr), 0);
    const net_mv = exp.reduce((a, p) => a + p.mvIdr, 0);
    const unreal = exp.reduce((a, p) => a + p.unrealIdr, 0);
    const realAll = realized
      .filter((r) => r.book === b)
      .reduce((a, r) => a + toIdr(r.net_pnl_native ?? r.pnl_native ?? 0, r.pnl_currency, r.fx_rate_to_idr, usdIdr), 0);
    const realYtd = realized
      .filter((r) => r.book === b && r.trade_date >= ytdStart)
      .reduce((a, r) => a + toIdr(r.net_pnl_native ?? r.pnl_native ?? 0, r.pnl_currency, r.fx_rate_to_idr, usdIdr), 0);
    return {
      book: b,
      mv_idr: gross_mv,
      net_mv_idr: net_mv,
      unrealized_pnl_idr: unreal,
      realized_pnl_idr: realAll,
      realized_ytd_idr: realYtd,
    };
  };

  const books: BookType[] = ["investing", "idx_trading", "crypto_trading", "other"];
  const perBook = books.map(byBook);

  const gross_mv = enriched.reduce((a, p) => a + Math.abs(p.mvIdr), 0);
  const net_mv = enriched.reduce((a, p) => a + p.mvIdr, 0);
  const unrealized = enriched.reduce((a, p) => a + p.unrealIdr, 0);
  const realized_all = realized.reduce(
    (a, r) => a + toIdr(r.net_pnl_native ?? r.pnl_native ?? 0, r.pnl_currency, r.fx_rate_to_idr, usdIdr),
    0,
  );
  const realized_ytd = realized
    .filter((r) => r.trade_date >= ytdStart)
    .reduce(
      (a, r) => a + toIdr(r.net_pnl_native ?? r.pnl_native ?? 0, r.pnl_currency, r.fx_rate_to_idr, usdIdr),
      0,
    );

  const nav_idr = gross_mv + realized_all;

  return NextResponse.json({
    nav_idr,
    nav_usd: nav_idr / usdIdr,
    gross_mv_idr: gross_mv,
    net_mv_idr: net_mv,
    gross_exposure_pct: nav_idr > 0 ? (gross_mv / nav_idr) * 100 : 0,
    net_exposure_pct: nav_idr > 0 ? (net_mv / nav_idr) * 100 : 0,
    unrealized_pnl_idr: unrealized,
    realized_pnl_idr: realized_all,
    realized_ytd_idr: realized_ytd,
    by_book: perBook,
    fx: { usd_idr: usdIdr },
  });
}
