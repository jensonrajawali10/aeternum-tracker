// TradingView scanner — fast, unofficial, no key. Backbone of the TV terminals.
// One POST can return any set of columns for any basket of symbols.
//
// Docs (reverse-engineered, community):
//   https://github.com/Mathieu2301/TradingView-API
//   https://scanner.tradingview.com/<market>/scan
//
// We only hit the scan endpoint for live quotes. Historical OHLC still comes
// from Yahoo (TV's WS/HTTP history endpoints need session tokens).

export interface TvQuote {
  ticker: string;        // bare ticker (BBRI, not IDX:BBRI)
  exchange: string;      // IDX, NASDAQ, NYSE, …
  price: number;
  prev_close: number | null;
  day_change_pct: number | null;
  volume: number | null;
  currency: string;
  at: number;
}

const COLUMNS = [
  "name",
  "close",
  "change",         // pct change vs prev close
  "change_abs",
  "volume",
  "currency",
] as const;

interface ScanRow {
  s: string;              // e.g. "IDX:BBRI"
  d: [string, number, number, number, number, string];
}

interface ScanResponse {
  data: ScanRow[];
}

async function tvScan(market: string, symbols: string[]): Promise<ScanRow[]> {
  if (!symbols.length) return [];
  const res = await fetch(`https://scanner.tradingview.com/${market}/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; aeternum-tracker)",
    },
    body: JSON.stringify({
      symbols: { tickers: symbols, query: { types: [] } },
      columns: COLUMNS,
    }),
    // TV is fast; 6s is plenty and keeps this route snappy.
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`tv_scan_${res.status}`);
  const json = (await res.json()) as ScanResponse;
  return json.data || [];
}

function rowToQuote(row: ScanRow): TvQuote | null {
  const [, close, changePct, changeAbs, volume, currency] = row.d;
  if (typeof close !== "number") return null;
  const [exchange, ticker] = row.s.split(":");
  const prev_close =
    typeof changeAbs === "number" && typeof close === "number" ? close - changeAbs : null;
  return {
    ticker,
    exchange,
    price: close,
    prev_close,
    day_change_pct: typeof changePct === "number" ? changePct : null,
    volume: typeof volume === "number" ? volume : null,
    currency: currency || "IDR",
    at: Date.now(),
  };
}

export async function tvQuoteIdx(tickers: string[]): Promise<Record<string, TvQuote>> {
  const syms = tickers.map((t) => `IDX:${t.toUpperCase().replace(/\.JK$/, "")}`);
  const rows = await tvScan("indonesia", syms);
  const out: Record<string, TvQuote> = {};
  for (const r of rows) {
    const q = rowToQuote(r);
    if (q) out[q.ticker] = q;
  }
  return out;
}

export async function tvQuoteUs(tickers: string[]): Promise<Record<string, TvQuote>> {
  // US market uses implicit exchange resolution — TV scanner accepts bare tickers
  // in the "america" market, but being explicit is safer.
  const syms = tickers.map((t) => t.toUpperCase());
  const rows = await tvScan("america", syms);
  const out: Record<string, TvQuote> = {};
  for (const r of rows) {
    const q = rowToQuote(r);
    if (q) out[q.ticker] = q;
  }
  return out;
}
