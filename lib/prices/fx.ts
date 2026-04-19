import { getCached, setCached } from "./cache";

export interface FxQuote {
  pair: string;
  rate: number;
  at: number;
}

export async function getLiveFxRate(from: string, to: string): Promise<FxQuote | null> {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return { pair: `${f}/${t}`, rate: 1, at: Date.now() };
  const key = `fx:${f}:${t}`;
  const cached = getCached(key);
  if (cached) return { pair: `${f}/${t}`, rate: cached.price, at: cached.at };
  try {
    const r = await fetch(`https://api.exchangerate.host/latest?base=${f}&symbols=${t}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { rates?: Record<string, number> };
    const rate = j?.rates?.[t];
    if (typeof rate !== "number") return null;
    setCached(key, rate);
    return { pair: `${f}/${t}`, rate, at: Date.now() };
  } catch (e) {
    console.error(`[fx] live ${f}/${t} failed:`, e);
    return null;
  }
}

export async function getUsdIdr(): Promise<number | null> {
  const q = await getLiveFxRate("USD", "IDR");
  return q?.rate ?? null;
}
