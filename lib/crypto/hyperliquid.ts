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

export function getUserFills(address: string, aggregateByTime = false) {
  return hlInfo<HlFill[]>({ type: "userFills", user: address, aggregateByTime });
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

export function fillToTrade(fill: HlFill, userId: string) {
  const direction = fill.side === "B" ? "LONG" : "SHORT";
  const sz = parseFloat(fill.sz);
  const px = parseFloat(fill.px);
  const fee = parseFloat(fill.fee || "0");
  const closedPnl = parseFloat(fill.closedPnl || "0");
  const trade_date = new Date(fill.time).toISOString().slice(0, 10);

  const isClose = /Close|Long>|Short>/.test(fill.dir);
  const isOpen = /Open/.test(fill.dir);

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
    entry_price: isOpen ? px : 0,
    exit_price: isClose ? px : null,
    position_size: sz,
    leverage: 1,
    pnl_native: isClose ? closedPnl : null,
    pnl_currency: "USD" as const,
    commission_native: fee,
    net_pnl_native: isClose ? closedPnl - fee : null,
    result: isClose ? (closedPnl > 0 ? "WIN" : closedPnl < 0 ? "LOSS" : "BREAKEVEN") : null,
    notes: `HL ${fill.dir} · tid ${fill.tid}`,
    synced_at: new Date().toISOString(),
  };
}
