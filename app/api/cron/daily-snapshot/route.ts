import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getQuote, getUsdIdr } from "@/lib/prices";
import { getIdxHistory, getUsHistory } from "@/lib/prices";
import type { AssetClass, BookType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface OpenRow {
  user_id: string;
  ticker: string;
  asset_class: AssetClass;
  book: BookType;
  net_qty: number;
  avg_entry: number;
  pnl_currency: "IDR" | "USD";
  fx_rate_to_idr: number | null;
}

interface RealizedRow {
  user_id: string;
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

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization");
  if (bearer === `Bearer ${secret}`) return true;
  // Vercel Cron sets this header
  if (req.headers.get("x-vercel-cron") === "1") return true;
  return false;
}

export async function POST(req: NextRequest) {
  return run(req);
}

export async function GET(req: NextRequest) {
  return run(req);
}

async function run(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const usdIdr = (await getUsdIdr()) ?? 16500;

  await supabase.from("fx_snapshots").upsert(
    { snapshot_date: today, base_currency: "USD", quote_currency: "IDR", rate: usdIdr },
    { onConflict: "snapshot_date,base_currency,quote_currency" },
  );

  // Benchmarks: fetch last 7 days' closes to fill any gaps
  const start = new Date();
  start.setDate(start.getDate() - 10);
  for (const sym of ["^JKSE", "^GSPC"]) {
    try {
      const hist = await getIdxHistory(sym, start, new Date()).then((rows) =>
        rows.length ? rows : getUsHistory(sym, start, new Date()),
      );
      for (const r of hist) {
        await supabase
          .from("benchmark_history")
          .upsert({ symbol: sym, snapshot_date: r.date, close: r.close }, { onConflict: "symbol,snapshot_date" });
      }
    } catch (e) {
      console.error(`[cron] benchmark ${sym} failed:`, e);
    }
  }

  // Get all users with any trades
  const { data: userRows } = await supabase.from("trades").select("user_id").limit(10000);
  const users = [...new Set((userRows || []).map((r) => r.user_id))];

  for (const user_id of users) {
    await snapshotUser(supabase, user_id, today, usdIdr);
  }

  return NextResponse.json({ ok: true, users: users.length, date: today });
}

async function snapshotUser(
  supabase: ReturnType<typeof supabaseAdmin>,
  user_id: string,
  date: string,
  usdIdr: number,
) {
  const { data: openRows } = await supabase
    .from("v_open_positions")
    .select("*")
    .eq("user_id", user_id);
  const opens = (openRows || []) as OpenRow[];

  const enriched = await Promise.all(
    opens.map(async (p) => {
      const quote = await getQuote(p.ticker, p.asset_class);
      const liveNative = quote?.price ?? p.avg_entry;
      const mvNative = liveNative * p.net_qty;
      const costNative = p.avg_entry * p.net_qty;
      const mvIdr = toIdr(mvNative, p.pnl_currency, p.fx_rate_to_idr, usdIdr);
      const costIdr = toIdr(costNative, p.pnl_currency, p.fx_rate_to_idr, usdIdr);
      return { book: p.book, mvIdr, unrealIdr: mvIdr - costIdr };
    }),
  );

  const { data: realizedRows } = await supabase
    .from("trades")
    .select("user_id,net_pnl_native,pnl_native,pnl_currency,fx_rate_to_idr,book,trade_date")
    .eq("user_id", user_id)
    .not("exit_price", "is", null);
  const realized = (realizedRows || []) as RealizedRow[];

  const books: BookType[] = ["investing", "idx_trading", "crypto_trading", "other"];

  const calc = (filterBook: BookType | "all") => {
    const exp = filterBook === "all" ? enriched : enriched.filter((p) => p.book === filterBook);
    const mv = exp.reduce((a, p) => a + Math.abs(p.mvIdr), 0);
    const netMv = exp.reduce((a, p) => a + p.mvIdr, 0);
    const unreal = exp.reduce((a, p) => a + p.unrealIdr, 0);
    const r = filterBook === "all" ? realized : realized.filter((r) => r.book === filterBook);
    const realSum = r.reduce(
      (a, r) => a + toIdr(r.net_pnl_native ?? r.pnl_native ?? 0, r.pnl_currency, r.fx_rate_to_idr, usdIdr),
      0,
    );
    const nav = mv + realSum;
    return {
      nav_idr: nav,
      realized_pnl_idr: realSum,
      unrealized_pnl_idr: unreal,
      gross_exposure_pct: nav > 0 ? (mv / nav) * 100 : 0,
      net_exposure_pct: nav > 0 ? (netMv / nav) * 100 : 0,
    };
  };

  for (const scope of ["all", ...books] as const) {
    const c = calc(scope);
    await supabase.from("nav_history").upsert(
      {
        user_id,
        snapshot_date: date,
        book: scope,
        nav_idr: c.nav_idr,
        realized_pnl_idr: c.realized_pnl_idr,
        unrealized_pnl_idr: c.unrealized_pnl_idr,
        gross_exposure_pct: c.gross_exposure_pct,
        net_exposure_pct: c.net_exposure_pct,
      },
      { onConflict: "user_id,snapshot_date,book" },
    );
  }
}
