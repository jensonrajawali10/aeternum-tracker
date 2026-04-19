import { yf as yahooFinance } from "./yahoo-client";
import { getCached, setCached } from "./cache";

export interface UsQuote {
  ticker: string;
  price: number;
  prev_close: number | null;
  day_change_pct: number | null;
  currency: string;
  at: number;
}

export async function getUsQuote(rawTicker: string): Promise<UsQuote | null> {
  const sym = rawTicker.trim().toUpperCase();
  const key = `us:${sym}`;
  const cached = getCached(key);
  if (cached) {
    const meta = cached.meta || {};
    return {
      ticker: sym,
      price: cached.price,
      prev_close: (meta.prev_close as number) ?? null,
      day_change_pct: (meta.day_change_pct as number) ?? null,
      currency: (meta.currency as string) || "USD",
      at: cached.at,
    };
  }
  try {
    const q = await yahooFinance.quote(sym);
    const price = q.regularMarketPrice;
    if (typeof price !== "number") return null;
    const prev_close = q.regularMarketPreviousClose ?? null;
    const day_change_pct = prev_close ? ((price - prev_close) / prev_close) * 100 : null;
    const currency = q.currency || "USD";
    setCached(key, price, { prev_close, day_change_pct, currency });
    return { ticker: sym, price, prev_close, day_change_pct, currency, at: Date.now() };
  } catch (e) {
    console.error(`[us] ${sym} quote failed:`, e);
    return null;
  }
}

export async function getUsQuotes(tickers: string[]): Promise<Record<string, UsQuote>> {
  const results: Record<string, UsQuote> = {};
  await Promise.all(
    tickers.map(async (t) => {
      const q = await getUsQuote(t);
      if (q) results[q.ticker] = q;
    }),
  );
  return results;
}

export async function getUsHistory(
  rawTicker: string,
  period1: string | Date,
  period2: string | Date = new Date(),
): Promise<{ date: string; close: number }[]> {
  const sym = rawTicker.trim().toUpperCase();
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
    console.error(`[us] ${sym} history failed:`, e);
    return [];
  }
}
