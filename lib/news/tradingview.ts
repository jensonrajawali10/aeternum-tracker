// TradingView news headlines — unofficial but stable endpoint used by the
// web terminal. Returns a curated feed per symbol or by category.
//
//   GET https://news-headlines.tradingview.com/v2/headlines?symbol=<exchange>:<ticker>&client=screener
//   GET https://news-headlines.tradingview.com/v2/categories?category=markets (global feed)

export interface NewsItem {
  id: string;
  title: string;
  published: number;   // ms since epoch
  source: string;
  url: string;
  summary?: string;
  symbols?: string[];
  urgency?: number;    // TV uses 0..3; higher = breaking
}

interface TvHeadline {
  id: string;
  title: string;
  published: number;   // TV returns seconds
  source?: string;
  link?: string;
  shortDescription?: string;
  relatedSymbols?: { symbol: string }[];
  urgency?: number;
  storyPath?: string;
}

interface TvHeadlinesResponse {
  items?: TvHeadline[];
}

const TV_BASE = "https://news-headlines.tradingview.com/v2";

function mapHeadline(h: TvHeadline): NewsItem {
  const url = h.link || (h.storyPath ? `https://www.tradingview.com${h.storyPath}` : "");
  return {
    id: h.id,
    title: h.title,
    published: (h.published || 0) * 1000,
    source: h.source || "TradingView",
    url,
    summary: h.shortDescription,
    symbols: (h.relatedSymbols || []).map((s) => s.symbol),
    urgency: h.urgency,
  };
}

// Symbol format: "IDX:BBRI", "NASDAQ:AAPL", "BINANCE:BTCUSDT".
// For our purposes we resolve asset_class → exchange prefix.
export function tvSymbol(ticker: string, assetClass: string): string {
  const bare = ticker.toUpperCase().replace(/\.JK$/, "");
  switch (assetClass) {
    case "idx_equity":
      return `IDX:${bare}`;
    case "us_equity":
      return `NASDAQ:${bare}`; // TV scanner resolves across US exchanges
    case "crypto":
      return `BINANCE:${bare}USDT`;
    default:
      return bare;
  }
}

export async function getTvNewsForSymbol(
  ticker: string,
  assetClass: string,
  limit = 30,
): Promise<NewsItem[]> {
  const symbol = tvSymbol(ticker, assetClass);
  const url = `${TV_BASE}/headlines?symbol=${encodeURIComponent(symbol)}&client=screener&lang=en`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; aeternum-tracker)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`tv_news_${res.status}`);
    const json = (await res.json()) as TvHeadlinesResponse;
    return (json.items || []).slice(0, limit).map(mapHeadline);
  } catch (e) {
    console.error(`[tv-news] ${symbol} failed:`, e);
    return [];
  }
}

export async function getTvNewsFeed(
  category: "markets" | "stock" | "crypto" | "economy" = "markets",
  limit = 40,
): Promise<NewsItem[]> {
  const url = `${TV_BASE}/categories?category=${category}&client=screener&lang=en`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; aeternum-tracker)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`tv_feed_${res.status}`);
    const json = (await res.json()) as TvHeadlinesResponse;
    return (json.items || []).slice(0, limit).map(mapHeadline);
  } catch (e) {
    console.error(`[tv-news] feed ${category} failed:`, e);
    return [];
  }
}

export async function getTvNewsForSymbols(
  pairs: { ticker: string; asset_class: string }[],
  perSymbol = 5,
): Promise<NewsItem[]> {
  const lists = await Promise.all(
    pairs.map((p) => getTvNewsForSymbol(p.ticker, p.asset_class, perSymbol)),
  );
  const seen = new Set<string>();
  const merged: NewsItem[] = [];
  for (const list of lists) {
    for (const item of list) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }
  merged.sort((a, b) => b.published - a.published);
  return merged;
}
