const HL_BASE = "https://api.hyperliquid.xyz/info";

async function hlInfo<T>(body: Record<string, unknown>): Promise<T> {
  const r = await fetch(HL_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`hl_http_${r.status}: ${await r.text().catch(() => "")}`);
  return r.json() as Promise<T>;
}

export interface HlAssetPosition {
  position: {
    coin: string;
    szi: string;
    entryPx: string | null;
    positionValue: string;
    unrealizedPnl: string;
    returnOnEquity: string;
    liquidationPx: string | null;
    marginUsed: string;
    maxLeverage: number;
    leverage: { type: string; value: number };
  };
  type: string;
}

export interface HlClearinghouseState {
  marginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  crossMarginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  crossMaintenanceMarginUsed: string;
  withdrawable: string;
  assetPositions: HlAssetPosition[];
  time: number;
}

export interface HlFill {
  coin: string;
  px: string;
  sz: string;
  side: "A" | "B";
  time: number;
  startPosition: string;
  dir: string;
  closedPnl: string;
  hash: string;
  oid: number;
  crossed: boolean;
  fee: string;
  feeToken: string;
  tid: number;
  builderFee?: string;
}

export interface HlSpotBalance {
  coin: string;
  token: number;
  total: string;
  hold: string;
  entryNtl: string;
}

export interface HlSpotClearinghouseState {
  balances: HlSpotBalance[];
}

export function getClearinghouseState(address: string) {
  return hlInfo<HlClearinghouseState>({ type: "clearinghouseState", user: address });
}

export function getSpotClearinghouseState(address: string) {
  return hlInfo<HlSpotClearinghouseState>({ type: "spotClearinghouseState", user: address });
}

export function getAllMids() {
  return hlInfo<Record<string, string>>({ type: "allMids" });
}

export function getSpotMeta() {
  return hlInfo<{ tokens: { name: string; szDecimals: number; weiDecimals: number; index: number; tokenId: string; isCanonical: boolean }[]; universe: { name: string; tokens: [number, number]; index: number; isCanonical: boolean }[] }>({ type: "spotMeta" });
}

export function getUserFills(address: string, aggregateByTime = false) {
  return hlInfo<HlFill[]>({ type: "userFills", user: address, aggregateByTime });
}

export type HlPortfolioWindow =
  | "day"
  | "week"
  | "month"
  | "allTime"
  | "perpDay"
  | "perpWeek"
  | "perpMonth"
  | "perpAllTime";

export interface HlPortfolioWindowData {
  accountValueHistory: [number, string][]; // [ms, valueUsd]
  pnlHistory: [number, string][];
  vlm: string;
}

export type HlPortfolioResponse = [HlPortfolioWindow, HlPortfolioWindowData][];

export function getPortfolio(address: string) {
  return hlInfo<HlPortfolioResponse>({ type: "portfolio", user: address });
}

export function getUserFillsByTime(address: string, startMs: number, endMs?: number) {
  const body: Record<string, unknown> = { type: "userFillsByTime", user: address, startTime: startMs };
  if (endMs) body.endTime = endMs;
  return hlInfo<HlFill[]>(body);
}

export function normalizeAddress(addr: string): string | null {
  const t = (addr || "").trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(t)) return null;
  return t;
}

// `fill.dir` is the authoritative direction string from HL:
//   "Open Long" | "Open Short" | "Close Long" | "Close Short" | "Long > Short" | "Short > Long"
//   (the latter two are flips; treat them as a close of the old side).
// `fill.side` is order-side ("B" buy / "A" ask), which is NOT the position direction
// for a short close (closing a short is a BUY order) — using it misclassifies flips.
function deriveDirection(dir: string): "LONG" | "SHORT" {
  const d = dir.toLowerCase();
  if (/long/.test(d)) return "LONG";
  if (/short/.test(d)) return "SHORT";
  return "LONG"; // fallback for odd strings like spot fills
}

// Convert ms timestamp to Asia/Jakarta (WIB) calendar date so trade_date lines
// up with Jenson's local day and journal rollups don't drift across midnight.
function toWibDate(ms: number): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date(ms)); // en-CA yields YYYY-MM-DD
}

export function fillToTrade(fill: HlFill, userId: string) {
  const direction = deriveDirection(fill.dir);
  const sz = parseFloat(fill.sz);
  const px = parseFloat(fill.px);
  const fee = parseFloat(fill.fee || "0");
  const closedPnl = parseFloat(fill.closedPnl || "0");
  const trade_date = toWibDate(fill.time);

  const isClose = /close|>/i.test(fill.dir);
  const isOpen = /open/i.test(fill.dir);

  // `entry_price` is NOT NULL in the schema. The `v_open_positions` view filters
  // `WHERE exit_price IS NULL`, so close fills (which have exit_price set) are
  // excluded from the avg_entry weighted-average math — 0 is safe here.
  const entry_price = isOpen ? px : 0;

  // DB enum for `result` is WIN | LOSS | BE (not BREAKEVEN).
  const result = isClose ? (closedPnl > 0 ? "WIN" : closedPnl < 0 ? "LOSS" : "BE") : null;

  return {
    user_id: userId,
    source: "hyperliquid" as const,
    source_sheet_row_id: `hl_${fill.tid}`,
    trade_date,
    asset_type: "crypto",
    asset_class: "crypto" as const,
    ticker: fill.coin.toUpperCase(),
    direction,
    strategy: "hyperliquid_fill",
    book: "crypto_trading" as const,
    entry_price,
    exit_price: isClose ? px : null,
    position_size: sz,
    leverage: 1,
    pnl_native: isClose ? closedPnl : null,
    pnl_currency: "USD" as const,
    commission_native: fee,
    net_pnl_native: isClose ? closedPnl - fee : null,
    result,
    notes: `HL ${fill.dir} · tid ${fill.tid}`,
    synced_at: new Date().toISOString(),
  };
}
