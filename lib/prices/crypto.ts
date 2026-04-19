import { getCached, setCached } from "./cache";

const COMMON_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
  DOGE: "dogecoin",
  TRX: "tron",
  LTC: "litecoin",
  NEAR: "near",
  TON: "the-open-network",
  SUI: "sui",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  INJ: "injective-protocol",
  RNDR: "render-token",
  TAO: "bittensor",
  HYPE: "hyperliquid",
  FET: "fetch-ai",
  KAS: "kaspa",
  XLM: "stellar",
  BCH: "bitcoin-cash",
  FIL: "filecoin",
};

const idCache = new Map<string, string>();

export interface CryptoQuote {
  ticker: string;
  id: string;
  price: number;
  prev_close: number | null;
  day_change_pct: number | null;
  currency: string;
  at: number;
}

const CG_BASE = "https://api.coingecko.com/api/v3";
const CG_HEADERS: Record<string, string> = process.env.COINGECKO_API_KEY
  ? { "x-cg-demo-api-key": process.env.COINGECKO_API_KEY }
  : {};

async function resolveId(rawTicker: string): Promise<string | null> {
  const t = rawTicker.trim().toUpperCase();
  if (COMMON_MAP[t]) return COMMON_MAP[t];
  if (idCache.has(t)) return idCache.get(t)!;
  try {
    const r = await fetch(`${CG_BASE}/search?query=${encodeURIComponent(t)}`, { headers: CG_HEADERS });
    if (!r.ok) return null;
    const j = (await r.json()) as { coins?: Array<{ id: string; symbol: string; market_cap_rank?: number }> };
    const exact = (j.coins || []).filter((c) => c.symbol.toUpperCase() === t);
    exact.sort((a, b) => (a.market_cap_rank ?? 9999) - (b.market_cap_rank ?? 9999));
    const pick = exact[0]?.id || j.coins?.[0]?.id || null;
    if (pick) idCache.set(t, pick);
    return pick;
  } catch (e) {
    console.error(`[crypto] resolveId ${t}:`, e);
    return null;
  }
}

export async function getCryptoQuote(rawTicker: string, vs = "usd"): Promise<CryptoQuote | null> {
  const t = rawTicker.trim().toUpperCase();
  const key = `crypto:${t}:${vs}`;
  const cached = getCached(key);
  if (cached) {
    const meta = cached.meta || {};
    return {
      ticker: t,
      id: (meta.id as string) || "",
      price: cached.price,
      prev_close: (meta.prev_close as number) ?? null,
      day_change_pct: (meta.day_change_pct as number) ?? null,
      currency: vs.toUpperCase(),
      at: cached.at,
    };
  }
  const id = await resolveId(t);
  if (!id) return null;
  try {
    const r = await fetch(
      `${CG_BASE}/simple/price?ids=${id}&vs_currencies=${vs}&include_24hr_change=true`,
      { headers: CG_HEADERS },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as Record<string, Record<string, number>>;
    const price = j?.[id]?.[vs];
    if (typeof price !== "number") return null;
    const day_change_pct = j[id][`${vs}_24h_change`] ?? null;
    const prev_close = day_change_pct != null ? price / (1 + day_change_pct / 100) : null;
    setCached(key, price, { id, prev_close, day_change_pct });
    return {
      ticker: t,
      id,
      price,
      prev_close,
      day_change_pct,
      currency: vs.toUpperCase(),
      at: Date.now(),
    };
  } catch (e) {
    console.error(`[crypto] ${t} quote failed:`, e);
    return null;
  }
}

export async function getCryptoQuotes(tickers: string[], vs = "usd"): Promise<Record<string, CryptoQuote>> {
  const results: Record<string, CryptoQuote> = {};
  await Promise.all(
    tickers.map(async (t) => {
      const q = await getCryptoQuote(t, vs);
      if (q) results[q.ticker] = q;
    }),
  );
  return results;
}

export async function getCryptoHistory(
  rawTicker: string,
  days: number = 365,
  vs = "usd",
): Promise<{ date: string; close: number }[]> {
  const id = await resolveId(rawTicker);
  if (!id) return [];
  try {
    const r = await fetch(
      `${CG_BASE}/coins/${id}/market_chart?vs_currency=${vs}&days=${days}&interval=daily`,
      { headers: CG_HEADERS },
    );
    if (!r.ok) return [];
    const j = (await r.json()) as { prices?: [number, number][] };
    return (j.prices || []).map(([ts, close]) => ({
      date: new Date(ts).toISOString().slice(0, 10),
      close,
    }));
  } catch (e) {
    console.error(`[crypto] ${rawTicker} history failed:`, e);
    return [];
  }
}
