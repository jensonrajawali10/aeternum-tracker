import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ticker-tape quote feed for the redesign dashboard.
 *
 * Symbols covered (the 11-ticker tape per AETERNUM_DATA_SOURCES.md):
 *   - IDX  : ^JKSE (composite), BBCA.JK, BBRI.JK, TLKM.JK, MAPB.JK
 *   - US   : ^GSPC (S&P), DX-Y.NYB (DXY), ^TNX (UST10Y yield)
 *   - Crypto: BTC, ETH, SOL (via CoinGecko)
 *
 * Architecture mirrors /api/health: parallel fan-out via Promise.all, each
 * call wrapped in a 4s AbortController timeout, failures drop silently from
 * the response rather than failing the whole request. The TickerTape SWR-polls
 * this so a missing symbol just leaves a blank cell — better than a stale
 * tape or a red error.
 *
 * Cache header is tighter than /api/health (20s s-maxage vs 30s) since the
 * tape is the visible consumer and 20s is enough latency to feel live without
 * stampeding upstream — Vercel's edge cache absorbs the bulk of repeat polls.
 *
 * Response contract (sister agent's TickerTape consumes this exactly):
 *   GET /api/quotes
 *   {
 *     quotes: [
 *       { symbol: "^JKSE",   price: 7321.45, change_pct: 0.34,  currency: "IDR" },
 *       { symbol: "BBCA.JK", price: 9750,    change_pct: -0.51, currency: "IDR" },
 *       { symbol: "BTC",     price: 92340.18, change_pct: 2.14, currency: "USD" },
 *       ...
 *     ],
 *     fetched_at: "2026-04-28T12:34:56.789Z"
 *   }
 */

interface QuoteRow {
  symbol: string;
  price: number;
  change_pct: number;
  currency: "IDR" | "USD";
}

const TIMEOUT_MS = 4_000;

// Yahoo symbols — anything with a .JK suffix is rendered in IDR; everything
// else is treated as USD. ^TNX is the 10Y treasury YIELD (in percent units),
// so for that symbol the "price" we surface is the yield itself.
const YAHOO_SYMBOLS: string[] = [
  "^JKSE",
  "BBCA.JK",
  "BBRI.JK",
  "TLKM.JK",
  "MAPB.JK",
  "^GSPC",
  "DX-Y.NYB",
  "^TNX",
];

// CoinGecko id -> public symbol the tape consumer expects to render.
const COINGECKO_MAP: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
};

function isJk(symbol: string): boolean {
  return symbol.endsWith(".JK");
}

// IDX composite (^JKSE) is quoted in IDR even though it doesn't carry the
// .JK suffix. Treat it as IDR alongside any explicit .JK ticker; everything
// else is USD by default.
const IDR_INDEX_SYMBOLS = new Set(["^JKSE"]);

function currencyFor(symbol: string): "IDR" | "USD" {
  if (isJk(symbol)) return "IDR";
  if (IDR_INDEX_SYMBOLS.has(symbol)) return "IDR";
  return "USD";
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
      };
    }> | null;
    error?: unknown;
  };
}

/**
 * Fetch a single Yahoo chart endpoint and reduce to a QuoteRow.
 * Returns null on any non-OK response, abort, parse failure, or missing fields —
 * the route filters nulls out so a failing symbol just drops from the tape.
 */
async function fetchYahoo(symbol: string): Promise<QuoteRow | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const res = await fetch(url, {
      signal: ac.signal,
      cache: "no-store",
      // Yahoo blocks default Node UA in some regions; mimic a browser to keep
      // the response stable. Same trick used by yahoo-finance2 internally.
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AeternumTracker/1.0)" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as YahooChartResponse;
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose ?? meta.previousClose;
    if (typeof price !== "number" || !isFinite(price)) return null;
    if (typeof prev !== "number" || !isFinite(prev) || prev === 0) {
      // No prev close — emit zero change rather than dropping; the tape can
      // still display "—" if it wants, and a finite number won't poison sums.
      return { symbol, price, change_pct: 0, currency: currencyFor(symbol) };
    }
    const change_pct = (price / prev - 1) * 100;
    return { symbol, price, change_pct, currency: currencyFor(symbol) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface CoinGeckoResponse {
  [id: string]: {
    usd?: number;
    usd_24h_change?: number;
  };
}

/**
 * One CoinGecko fan-in for all three crypto symbols — saves three round-trips
 * vs per-symbol calls. Returns an array of QuoteRows; failures yield an empty
 * array so the route can still serve the rest of the tape.
 */
async function fetchCoinGecko(): Promise<QuoteRow[]> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const ids = Object.keys(COINGECKO_MAP).join(",");
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
    const headers: Record<string, string> = {};
    // Demo key bumps the public rate limit but is optional — public endpoints
    // work without it. We read the same key your existing crypto.ts uses, plus
    // the COINGECKO_DEMO_KEY alias documented in .env.example for clarity.
    const cgKey = process.env.COINGECKO_API_KEY || process.env.COINGECKO_DEMO_KEY;
    if (cgKey) headers["x-cg-demo-api-key"] = cgKey;
    const res = await fetch(url, { signal: ac.signal, cache: "no-store", headers });
    if (!res.ok) return [];
    const json = (await res.json()) as CoinGeckoResponse;
    const out: QuoteRow[] = [];
    for (const [id, symbol] of Object.entries(COINGECKO_MAP)) {
      const row = json[id];
      const price = row?.usd;
      const change_pct = row?.usd_24h_change;
      if (typeof price !== "number" || !isFinite(price)) continue;
      out.push({
        symbol,
        price,
        change_pct: typeof change_pct === "number" && isFinite(change_pct) ? change_pct : 0,
        currency: "USD",
      });
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  // One coroutine per Yahoo symbol + one CoinGecko fan-in for crypto. All in
  // parallel so the slowest call dictates total latency, not the sum.
  const [yahooResults, cryptoResults] = await Promise.all([
    Promise.all(YAHOO_SYMBOLS.map((s) => fetchYahoo(s))),
    fetchCoinGecko(),
  ]);

  const quotes: QuoteRow[] = [
    ...yahooResults.filter((q): q is QuoteRow => q != null),
    ...cryptoResults,
  ];

  return NextResponse.json(
    {
      quotes,
      fetched_at: new Date().toISOString(),
    },
    {
      headers: {
        // 20s edge cache + SWR window — chosen to balance "feels live" against
        // Yahoo/CoinGecko rate limits when many tabs are open at once.
        "Cache-Control": "s-maxage=20, stale-while-revalidate=60",
      },
    },
  );
}
