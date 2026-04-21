import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getQuote, getUsdIdr } from "@/lib/prices";
import { getIdxHistory, getUsHistory } from "@/lib/prices";
import {
  getClearinghouseState,
  getSpotClearinghouseState,
  getAllMids,
  getSpotMeta,
} from "@/lib/crypto/hyperliquid";
import type { AssetClass, BookType } from "@/lib/types";

const STABLES = new Set(["USDC", "USDT", "USDE", "DAI", "FDUSD", "USDB"]);

interface HlSnapshot {
  accountValueUsd: number;
  unrealizedUsd: number;
}

async function getHyperliquidSnapshot(address: string): Promise<HlSnapshot> {
  try {
    const [perp, spot, mids, spotMeta] = await Promise.all([
      getClearinghouseState(address).catch(() => null),
      getSpotClearinghouseState(address).catch(() => null),
      getAllMids().catch(() => ({} as Record<string, string>)),
      getSpotMeta().catch(() => null),
    ]);
    const priceByCoin: Record<string, number> = {};
    if (spotMeta) {
      for (const u of spotMeta.universe) {
        const m = mids[u.name];
        if (!m) continue;
        const baseIdx = u.tokens[0];
        const base = spotMeta.tokens.find((t) => t.index === baseIdx);
        if (base) priceByCoin[base.name.toUpperCase()] = parseFloat(m);
      }
    }
    let spotValueUsd = 0;
    if (spot?.balances) {
      for (const b of spot.balances) {
        const total = parseFloat(b.total);
        if (total === 0) continue;
        const coin = b.coin.toUpperCase();
        let px = 0;
        if (STABLES.has(coin)) px = 1;
        else if (priceByCoin[coin]) px = priceByCoin[coin];
        else px = parseFloat(b.entryNtl) / (total || 1);
        spotValueUsd += total * px;
      }
    }
    const perpAccountValue = perp ? parseFloat(perp.marginSummary.accountValue) : 0;
    const perpUnrealized = perp
      ? perp.assetPositions.reduce((a, ap) => a + parseFloat(ap.position.unrealizedPnl), 0)
      : 0;
    return {
      accountValueUsd: perpAccountValue + spotValueUsd,
      unrealizedUsd: perpUnrealized,
    };
  } catch {
    return { accountValueUsd: 0, unrealizedUsd: 0 };
  }
}

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
  // Cron runs at 22:00 UTC (05:00 WIB next day). UTC-stamping the snapshot
  // labels it with the PREVIOUS WIB day, so today's P&L shows up under
  // yesterday's date in the journal. Stamp in Asia/Jakarta instead.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

  // Collect users from trades AND user_settings (to catch HL-only users)
  const [{ data: tradeUserRows }, { data: settingsUserRows }] = await Promise.all([
    supabase.from("trades").select("user_id").limit(10000),
    supabase.from("user_settings").select("user_id,hyperliquid_address").not("hyperliquid_address", "is", null),
  ]);
  const hlByUser = new Map<string, string>();
  for (const r of settingsUserRows || []) {
    if (r.hyperliquid_address) hlByUser.set(r.user_id, r.hyperliquid_address);
  }
  const users = [
    ...new Set([
      ...(tradeUserRows || []).map((r) => r.user_id),
      ...hlByUser.keys(),
    ]),
  ];

  for (const user_id of users) {
    await snapshotUser(supabase, user_id, today, usdIdr, hlByUser.get(user_id) ?? null);
  }

  return NextResponse.json({ ok: true, users: users.length, date: today });
}

async function snapshotUser(
  supabase: ReturnType<typeof supabaseAdmin>,
  user_id: string,
  date: string,
  usdIdr: number,
  hyperliquidAddress: string | null,
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

  // Live Hyperliquid snapshot for crypto book (if address configured)
  const hl = hyperliquidAddress
    ? await getHyperliquidSnapshot(hyperliquidAddress)
    : { accountValueUsd: 0, unrealizedUsd: 0 };
  const hlIdr = hl.accountValueUsd * usdIdr;
  const hlUnrealIdr = hl.unrealizedUsd * usdIdr;

  const books: BookType[] = ["investing", "idx_trading", "crypto_trading", "other"];

  const sumRealized = (rows: RealizedRow[]) =>
    rows.reduce(
      (a, r) => a + toIdr(r.net_pnl_native ?? r.pnl_native ?? 0, r.pnl_currency, r.fx_rate_to_idr, usdIdr),
      0,
    );

  const calc = (filterBook: BookType | "all") => {
    // --- MV / net / unreal ------------------------------------------------
    // When HL is present, the crypto book's live value IS Hyperliquid's
    // accountValue. Sheet-sourced crypto positions are dropped to avoid
    // counting the same capital twice.
    const sheetForMv =
      filterBook === "all"
        ? hlIdr > 0
          ? enriched.filter((p) => p.book !== "crypto_trading")
          : enriched
        : enriched.filter((p) => p.book === filterBook);
    let mv = sheetForMv.reduce((a, p) => a + Math.abs(p.mvIdr), 0);
    let netMv = sheetForMv.reduce((a, p) => a + p.mvIdr, 0);
    // Sheet-side unrealized. For crypto_trading / all with HL, we replace or
    // augment below so the HL perp unrealized is actually represented in
    // nav_history.unrealized_pnl_idr (previously it was dropped on the floor).
    let unreal = sheetForMv.reduce((a, p) => a + p.unrealIdr, 0);

    if (filterBook === "crypto_trading" && hlIdr > 0) {
      mv = hlIdr;
      netMv = hlIdr;
      // HL accountValue already reflects crypto drift — use HL's explicit
      // perp unrealized number, not sheet (sheet is empty for crypto now).
      unreal = hlUnrealIdr;
    } else if (filterBook === "all" && hlIdr > 0) {
      mv += hlIdr;
      netMv += hlIdr;
      unreal += hlUnrealIdr;
    }

    // --- Realized for display (KPI line) ---------------------------------
    const realizedDisplay =
      filterBook === "all" ? realized : realized.filter((r) => r.book === filterBook);
    const realSumDisplay = sumRealized(realizedDisplay);

    // --- Realized that feeds the NAV formula -----------------------------
    // HL's accountValue already compounds closed-trade P&L inside the
    // account. Adding crypto realized on top would double-count — so we
    // strip crypto realized whenever HL is present.
    let realSumForNav: number;
    if (hlIdr > 0 && filterBook === "crypto_trading") {
      realSumForNav = 0;
    } else if (hlIdr > 0 && filterBook === "all") {
      realSumForNav = sumRealized(realized.filter((r) => r.book !== "crypto_trading"));
    } else {
      realSumForNav = realSumDisplay;
    }

    const nav = mv + realSumForNav;
    return {
      nav_idr: nav,
      realized_pnl_idr: realSumDisplay,
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
