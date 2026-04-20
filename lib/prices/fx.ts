import { yf } from "./yahoo-client";
import { getCached, setCached } from "./cache";

export interface FxQuote {
  pair: string;
  rate: number;
  prev_close: number | null;
  day_change_pct: number | null;
  at: number;
}

export async function getLiveFxRate(from: string, to: string): Promise<FxQuote | null> {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return { pair: `${f}/${t}`, rate: 1, prev_close: 1, day_change_pct: 0, at: Date.now() };
  const key = `fx:${f}:${t}`;
  const cached = getCached(key);
  if (cached) {
    const meta = cached.meta || {};
    return {
      pair: `${f}/${t}`,
      rate: cached.price,
      prev_close: (meta.prev_close as number) ?? null,
      day_change_pct: (meta.day_change_pct as number) ?? null,
      at: cached.at,
    };
  }
  try {
    const sym = `${f}${t}=X`;
    const q = await yf.quote(sym);
    const rate = q.regularMarketPrice;
    if (typeof rate !== "number") return null;
    const prev_close = q.regularMarketPreviousClose ?? null;
    const day_change_pct = prev_close ? ((rate - prev_close) / prev_close) * 100 : null;
    setCached(key, rate, { prev_close, day_change_pct });
    return { pair: `${f}/${t}`, rate, prev_close, day_change_pct, at: Date.now() };
  } catch (e) {
    console.error(`[fx] yahoo ${f}/${t} failed, trying frankfurter:`, e);
    try {
      const r = await fetch(`https://api.frankfurter.app/latest?from=${f}&to=${t}`);
      if (!r.ok) return null;
      const j = (await r.json()) as { rates?: Record<string, number> };
      const rate = j?.rates?.[t];
      if (typeof rate !== "number") return null;
      setCached(key, rate, { prev_close: null, day_change_pct: null });
      return { pair: `${f}/${t}`, rate, prev_close: null, day_change_pct: null, at: Date.now() };
    } catch (e2) {
      console.error(`[fx] both sources failed for ${f}/${t}:`, e2);
      return null;
    }
  }
}

export async function getUsdIdr(): Promise<number | null> {
  const q = await getLiveFxRate("USD", "IDR");
  return q?.rate ?? null;
}
