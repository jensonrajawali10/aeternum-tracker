import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getQuote, getUsdIdr } from "@/lib/prices";
import {
  getClearinghouseState,
  getSpotClearinghouseState,
  getAllMids,
  getSpotMeta,
} from "@/lib/crypto/hyperliquid";
import type { AssetClass, BookFilter, BookType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STABLES = new Set(["USDC", "USDT", "USDE", "DAI", "FDUSD", "USDB"]);

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

interface PositionRow {
  ticker: string;
  asset_class: AssetClass;
  book: BookType;
  qty: number;
  avg_entry: number;
  stop_loss: number | null;
  take_profit: number | null;
  live_price: number | null;
  currency: "IDR" | "USD";
  day_change_pct: number | null;
  market_value_idr: number | null;
  market_value_usd: number | null;
  unrealized_pnl_idr: number | null;
  unrealized_pnl_usd: number | null;
  unrealized_pnl_pct: number | null;
  opened_at: string;
  leg_count: number;
  venue?: "hyperliquid" | "sheet";
}

/**
 * Pull live Hyperliquid perp + spot positions and shape them to match the rest
 * of the positions table. Empty array if the user has no HL address or the
 * API hiccups — caller falls back cleanly to sheet-backed data.
 */
async function getHyperliquidPositions(userId: string, usdIdr: number): Promise<PositionRow[]> {
  try {
    const admin = supabaseAdmin();
    const { data: settings } = await admin
      .from("user_settings")
      .select("hyperliquid_address")
      .eq("user_id", userId)
      .maybeSingle();
    const address = settings?.hyperliquid_address;
    if (!address) return [];

    const [perp, spot, mids, spotMeta] = await Promise.all([
      getClearinghouseState(address).catch(() => null),
      getSpotClearinghouseState(address).catch(() => null),
      getAllMids().catch(() => ({} as Record<string, string>)),
      getSpotMeta().catch(() => null),
    ]);

    const out: PositionRow[] = [];

    // Perp positions — signed szi, leverage baked into returnOnEquity
    if (perp?.assetPositions) {
      for (const ap of perp.assetPositions) {
        const p = ap.position;
        const szi = parseFloat(p.szi);
        if (szi === 0) continue;
        const entryPx = p.entryPx ? parseFloat(p.entryPx) : 0;
        const mid = mids[p.coin];
        const livePx = mid ? parseFloat(mid) : entryPx;
        const positionValueUsd = parseFloat(p.positionValue);
        const unrealPnlUsd = parseFloat(p.unrealizedPnl);
        // ROE captures leverage effect; raw unlevered pct = (live-entry)/entry for longs
        const roe = parseFloat(p.returnOnEquity) * 100;
        out.push({
          ticker: `${p.coin}-PERP`,
          asset_class: "crypto",
          book: "crypto_trading",
          qty: szi,
          avg_entry: entryPx,
          stop_loss: p.liquidationPx ? parseFloat(p.liquidationPx) : null,
          take_profit: null,
          live_price: livePx,
          currency: "USD",
          day_change_pct: null,
          market_value_idr: positionValueUsd * usdIdr,
          market_value_usd: positionValueUsd,
          unrealized_pnl_idr: unrealPnlUsd * usdIdr,
          unrealized_pnl_usd: unrealPnlUsd,
          unrealized_pnl_pct: isFinite(roe) ? roe : null,
          opened_at: "",
          leg_count: 1,
          venue: "hyperliquid",
        });
      }
    }

    // Spot balances — derive live price from spot mids, stables pinned at 1
    if (spot?.balances) {
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
      for (const b of spot.balances) {
        const total = parseFloat(b.total);
        if (total === 0) continue;
        const coin = b.coin.toUpperCase();
        const entryNtlRaw = parseFloat(b.entryNtl);
        const isStable = STABLES.has(coin);
        // Stables bug fix: Hyperliquid reports entryNtl=0 for on-chain
        // deposits (not purchases). The old math did mvUsd=total*1 and
        // upnlUsd = mvUsd - 0 = mvUsd — which made every USDC deposit
        // show its full balance as unrealized P&L. Treat stables with
        // no recorded entry cost as cash (entry notional = current MV).
        const entryNtl =
          isStable && (!isFinite(entryNtlRaw) || entryNtlRaw === 0) ? total : entryNtlRaw;
        const entryPx = total > 0 ? entryNtl / total : 0;
        let livePx = 0;
        if (isStable) livePx = 1;
        else if (priceByCoin[coin]) livePx = priceByCoin[coin];
        else livePx = entryPx;
        const mvUsd = total * livePx;
        const upnlUsd = mvUsd - entryNtl;
        const upnlPct = entryPx ? ((livePx - entryPx) / entryPx) * 100 : null;
        out.push({
          ticker: coin,
          asset_class: "crypto",
          book: "crypto_trading",
          qty: total,
          avg_entry: entryPx,
          stop_loss: null,
          take_profit: null,
          live_price: livePx,
          currency: "USD",
          day_change_pct: null,
          market_value_idr: mvUsd * usdIdr,
          market_value_usd: mvUsd,
          unrealized_pnl_idr: upnlUsd * usdIdr,
          unrealized_pnl_usd: upnlUsd,
          unrealized_pnl_pct: upnlPct,
          opened_at: "",
          leg_count: 1,
          venue: "hyperliquid",
        });
      }
    }

    return out;
  } catch {
    return [];
  }
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

  const enriched: PositionRow[] = await Promise.all(
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
        venue: "sheet" as const,
      };
    }),
  );

  // For the crypto book, Hyperliquid is the live source of truth. Strip any
  // sheet-backed crypto rows (they're usually stale or placeholder) and append
  // fresh perp + spot positions. Applies when bookFilter is crypto_trading OR all.
  let combined: PositionRow[];
  if (bookFilter === "crypto_trading" || bookFilter === "all") {
    const hlRows = await getHyperliquidPositions(user.id, usdIdr);
    const nonCrypto = enriched.filter((p) => p.book !== "crypto_trading");
    combined = [...nonCrypto, ...hlRows];
  } else {
    combined = enriched;
  }

  // Use absolute MV so shorts (negative MV) count toward gross exposure
  // instead of canceling out longs — a short position should show as ~X% of
  // NAV, not as a negative percentage that implies it's shrinking total size.
  const totalMV = combined.reduce((a, p) => a + Math.abs(p.market_value_idr || 0), 0);
  const withPct = combined.map((p) => ({
    ...p,
    pct_of_nav:
      totalMV > 0 && p.market_value_idr != null
        ? (Math.abs(p.market_value_idr) / totalMV) * 100
        : null,
  }));

  return NextResponse.json({
    positions: withPct,
    fx: { usd_idr: usdIdr },
    display_currency: displayCurrency,
  });
}
