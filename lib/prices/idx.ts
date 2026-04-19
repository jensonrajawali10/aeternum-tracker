import { yf as yahooFinance } from "./yahoo-client";
import { getCached, setCached } from "./cache";
import { tvQuoteIdx } from "./tradingview";

export function normalizeIdxTicker(raw: string): string {
  const t = raw.trim().toUpperCase().replace(/\.JK$/, "");
  return `${t}.JK`;
}

export function bareIdxTicker(raw: string): string {
  return raw.trim().toUpperCase().replace(/\.JK$/, "");
}

export interface IdxQuote {
  ticker: string;           // normalized with .JK suffix for compatibility
  price: number;
  prev_close: number | null;
  day_change_pct: number | null;
  currency: string;
  at: number;
}

// Primary: TradingView scanner (fast). Fallback: Yahoo Finance.
export async function getIdxQuote(rawTicker: string): Promise<IdxQuote | null> {
  const sym = normalizeIdxTicker(rawTicker);
  const bare = bareIdxTicker(rawTicker);
  const key = `idx:${sym}`;
  const cached = getCached(key);
  if (cached) {
    const meta = cached.meta || {};
    return {
      ticker: sym,
      price: cached.price,
      prev_close: (meta.prev_close as number) ?? null,
      day_change_pct: (meta.day_change_pct as number) ?? null,
      currency: "IDR",
      at: cached.at,
    };
  }

  try {
    const tvMap = await tvQuoteIdx([bare]);
    const tv = tvMap[bare];
    if (tv && typeof tv.price === "number") {
      setCached(key, tv.price, { prev_close: tv.prev_close, day_change_pct: tv.day_change_pct });
      return {
        ticker: sym,
        price: tv.price,
        prev_close: tv.prev_close,
        day_change_pct: tv.day_change_pct,
        currency: "IDR",
        at: tv.at,
      };
    }
  } catch (e) {
    console.warn(`[idx] TV scanner failed for ${bare}, falling back to Yahoo:`, e);
  }

  try {
    const q = await yahooFinance.quote(sym);
    const price = q.regularMarketPrice;
    if (typeof price !== "number") return null;
    const prev_close = q.regularMarketPreviousClose ?? null;
    const day_change_pct = prev_close ? ((price - prev_close) / prev_close) * 100 : null;
    setCached(key, price, { prev_close, day_change_pct });
    return { ticker: sym, price, prev_close, day_change_pct, currency: "IDR", at: Date.now() };
  } catch (e) {
    console.error(`[idx] ${sym} quote failed:`, e);
    return null;
  }
}

// Batch quotes — one TV scan call for all tickers, Yahoo per-symbol for misses.
export async function getIdxQuotes(tickers: string[]): Promise<Record<string, IdxQuote>> {
  const results: Record<string, IdxQuote> = {};
  if (!tickers.length) return results;

  const bareTickers = tickers.map(bareIdxTicker);
  const uncachedBare: string[] = [];
  for (const bare of bareTickers) {
    const sym = `${bare}.JK`;
    const cached = getCached(`idx:${sym}`);
    if (cached) {
      const meta = cached.meta || {};
      results[sym] = {
        ticker: sym,
        price: cached.price,
        prev_close: (meta.prev_close as number) ?? null,
        day_change_pct: (meta.day_change_pct as number) ?? null,
        currency: "IDR",
        at: cached.at,
      };
    } else {
      uncachedBare.push(bare);
    }
  }
  if (!uncachedBare.length) return results;

  let tvMap: Record<string, import("./tradingview").TvQuote> = {};
  try {
    tvMap = await tvQuoteIdx(uncachedBare);
  } catch (e) {
    console.warn("[idx] batch TV scan failed, per-symbol Yahoo fallback:", e);
  }

  const missing: string[] = [];
  for (const bare of uncachedBare) {
    const sym = `${bare}.JK`;
    const tv = tvMap[bare];
    if (tv && typeof tv.price === "number") {
      setCached(`idx:${sym}`, tv.price, {
        prev_close: tv.prev_close,
        day_change_pct: tv.day_change_pct,
      });
      results[sym] = {
        ticker: sym,
        price: tv.price,
        prev_close: tv.prev_close,
        day_change_pct: tv.day_change_pct,
        currency: "IDR",
        at: tv.at,
      };
    } else {
      missing.push(bare);
    }
  }

  await Promise.all(
    missing.map(async (bare) => {
      const q = await getIdxQuote(bare);
      if (q) results[q.ticker] = q;
    }),
  );

  return results;
}

// Historical series still comes from Yahoo — TV history endpoints need a session.
export async function getIdxHistory(
  rawTicker: string,
  period1: string | Date,
  period2: string | Date = new Date(),
): Promise<{ date: string; close: number }[]> {
  const sym = normalizeIdxTicker(rawTicker);
  try {
    const rows = await yahooFinance.historical(sym, {
      period1,
      period2,
      interval: "1d",
    });
    return rows
      .filter((r) => r.close != null)
      .map((r) => ({ date: r.date.toISOString().slice(0, 10), close: r.close! }));
  } catch (e) {
    console.error(`[idx] ${sym} history failed:`, e);
    return [];
  }
}
