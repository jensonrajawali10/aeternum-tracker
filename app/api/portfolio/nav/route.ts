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

/**
 * Fetch the user's live Hyperliquid account value (perp + spot) and unrealized perp P&L.
 * Returns zeros if the user has no address configured or the API is unreachable —
 * the NAV endpoint degrades gracefully back to sheet-only numbers.
 */
async function getHyperliquidNav(userId: string): Promise<{ accountValueUsd: number; unrealizedUsd: number }> {
  try {
    const admin = supabaseAdmin();
    const { data } = await admin
      .from("user_settings")
      .select("hyperliquid_address")
      .eq("user_id", userId)
      .maybeSingle();
    const address = data?.hyperliquid_address;
    if (!address) return { accountValueUsd: 0, unrealizedUsd: 0 };

    const [perp, spot, mids, spotMeta] = await Promise.all([
      getClearinghouseState(address).catch(() => null),
      getSpotClearinghouseState(address).catch(() => null),
      getAllMids().catch(() => ({} as Record<string, string>)),
      getSpotMeta().catch(() => null),
    ]);

    const priceByCoin: Record<string, number> = {};
    if (spotMeta) {
      for (const u of spotMeta.universe) {
        const mid = mids[u.name];
        if (!mid) continue;
        const baseIdx = u.tokens[0];
        const base = spotMeta.tokens.find((t) => t.index === baseIdx);
        if (base) priceByCoin[base.name.toUpperCase()] = parseFloat(mid);
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

  // Live Hyperliquid snapshot — only fetch when the crypto book is actually in scope
  const needsHl = bookFilter === "crypto_trading" || bookFilter === "all";
  const hl = needsHl ? await getHyperliquidNav(user.id) : { accountValueUsd: 0, unrealizedUsd: 0 };
  const hlIdr = hl.accountValueUsd * usdIdr;
  const hlUnrealIdr = hl.unrealizedUsd * usdIdr;

  const year = new Date().getFullYear();
  const ytdStart = `${year}-01-01`;

  const byBook = (b: BookType) => {
    const exp = enriched.filter((p) => p.book === b);
    let gross_mv = exp.reduce((a, p) => a + Math.abs(p.mvIdr), 0);
    let net_mv = exp.reduce((a, p) => a + p.mvIdr, 0);
    let unreal = exp.reduce((a, p) => a + p.unrealIdr, 0);
    // Hyperliquid live account value is the source of truth for the crypto book.
    // HL accountValue already reflects unrealized drift, so replace — don't add.
    if (b === "crypto_trading" && hlIdr > 0) {
      gross_mv = hlIdr;
      net_mv = hlIdr;
      unreal = hlUnrealIdr; // perp unrealized from HL; no sheet add-on
    }
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

  // Build the aggregate: replace sheet-based crypto MV with Hyperliquid when applicable.
  const sheetMvAll = enriched.reduce((a, p) => a + Math.abs(p.mvIdr), 0);
  const sheetNetAll = enriched.reduce((a, p) => a + p.mvIdr, 0);
  const sheetMvNonCrypto = enriched
    .filter((p) => p.book !== "crypto_trading")
    .reduce((a, p) => a + Math.abs(p.mvIdr), 0);
  const sheetNetNonCrypto = enriched
    .filter((p) => p.book !== "crypto_trading")
    .reduce((a, p) => a + p.mvIdr, 0);
  const sheetUnrealAll = enriched.reduce((a, p) => a + p.unrealIdr, 0);

  let gross_mv: number;
  let net_mv: number;
  let unrealized: number;
  if (bookFilter === "crypto_trading") {
    if (hlIdr > 0) {
      // HL is the source of truth — accountValue already captures unrealized
      gross_mv = hlIdr;
      net_mv = hlIdr;
      unrealized = hlUnrealIdr;
    } else {
      // HL unavailable — fall back to sheet-based crypto positions
      // (enriched is already filtered to crypto book here)
      gross_mv = sheetMvAll;
      net_mv = sheetNetAll;
      unrealized = sheetUnrealAll;
    }
  } else if (bookFilter === "all") {
    if (hlIdr > 0) {
      const unrealNonCrypto = enriched
        .filter((p) => p.book !== "crypto_trading")
        .reduce((a, p) => a + p.unrealIdr, 0);
      gross_mv = sheetMvNonCrypto + hlIdr;
      net_mv = sheetNetNonCrypto + hlIdr;
      unrealized = unrealNonCrypto + hlUnrealIdr;
    } else {
      // HL down or no address configured — use full sheet data, including crypto,
      // so the dashboard doesn't silently drop crypto exposure/unrealized
      gross_mv = sheetMvAll;
      net_mv = sheetNetAll;
      unrealized = sheetUnrealAll;
    }
  } else {
    gross_mv = sheetMvAll;
    net_mv = sheetNetAll;
    unrealized = sheetUnrealAll;
  }

  const toRealIdr = (r: RealizedRow) =>
    toIdr(r.net_pnl_native ?? r.pnl_native ?? 0, r.pnl_currency, r.fx_rate_to_idr, usdIdr);

  // Display-side realized — shown in KPIs as "Realized P&L"
  const realized_all = realized.reduce((a, r) => a + toRealIdr(r), 0);
  const realized_ytd = realized
    .filter((r) => r.trade_date >= ytdStart)
    .reduce((a, r) => a + toRealIdr(r), 0);

  // NAV-side realized — HL compounds closed P&L inside accountValue, so strip
  // crypto realized whenever HL is present to avoid double-counting capital.
  let realizedForNav: number;
  if (bookFilter === "crypto_trading" && hlIdr > 0) {
    realizedForNav = 0;
  } else if (bookFilter === "all" && hlIdr > 0) {
    realizedForNav = realized
      .filter((r) => r.book !== "crypto_trading")
      .reduce((a, r) => a + toRealIdr(r), 0);
  } else {
    realizedForNav = realized_all;
  }

  const nav_idr = gross_mv + realizedForNav;

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
    hl: { account_value_idr: hlIdr, unrealized_idr: hlUnrealIdr },
  });
}
