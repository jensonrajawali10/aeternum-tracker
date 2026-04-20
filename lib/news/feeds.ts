// News feeds — uses Yahoo Finance RSS for per-symbol news and Google News RSS
// for category feeds. Both are free, stable, and don't require auth.
//
// Yahoo:  https://feeds.finance.yahoo.com/rss/2.0/headline?s=<TICKER>&region=US&lang=en-US
// Google: https://news.google.com/rss/search?q=<query>&hl=en-US&gl=US&ceid=US:en

export interface NewsItem {
  id: string;
  title: string;
  published: number; // ms since epoch
  source: string;
  url: string;
  summary?: string;
  symbols?: string[];
  urgency?: number;
}

const UA = { "User-Agent": "Mozilla/5.0 (compatible; aeternum-tracker)" };
const TIMEOUT = 8000;

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function parseRssItems(xml: string, sourceFallback: string): NewsItem[] {
  const out: NewsItem[] = [];
  const items = xml.match(/<item[\s\S]*?<\/item>/g) || [];
  for (const raw of items) {
    const pick = (tag: string) => {
      const m = raw.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return m ? decode(m[1]) : "";
    };
    const title = pick("title");
    const link = pick("link");
    const pubDate = pick("pubDate");
    const guid = pick("guid") || link || title;
    const desc = pick("description").replace(/<[^>]+>/g, "").trim();
    const srcMatch = raw.match(/<source[^>]*>([\s\S]*?)<\/source>/);
    const source = srcMatch ? decode(srcMatch[1]) : sourceFallback;
    const published = pubDate ? new Date(pubDate).getTime() : Date.now();
    if (!title || !link) continue;
    out.push({
      id: guid || link,
      title,
      published,
      source,
      url: link,
      summary: desc || undefined,
    });
  }
  return out;
}

async function fetchRss(url: string, fallbackSource: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, {
      headers: { ...UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
      signal: AbortSignal.timeout(TIMEOUT),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[news-rss] ${url} → ${res.status}`);
      return [];
    }
    const xml = await res.text();
    return parseRssItems(xml, fallbackSource);
  } catch (e) {
    console.error(`[news-rss] ${url} failed:`, e);
    return [];
  }
}

export function yahooSymbol(ticker: string, assetClass: string): string {
  const bare = ticker.toUpperCase();
  switch (assetClass) {
    case "idx_equity":
      return bare.endsWith(".JK") ? bare : `${bare}.JK`;
    case "us_equity":
      return bare;
    case "crypto":
      return `${bare}-USD`;
    default:
      return bare;
  }
}

export async function getNewsForSymbol(
  ticker: string,
  assetClass: string,
  limit = 30,
): Promise<NewsItem[]> {
  const sym = yahooSymbol(ticker, assetClass);
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(sym)}&region=US&lang=en-US`;
  const items = await fetchRss(url, "Yahoo Finance");
  if (items.length === 0 && assetClass === "idx_equity") {
    // Yahoo's IDX coverage is sparse — fall back to Google News search
    const q = `${ticker.replace(/\.JK$/i, "")} IDX stock`;
    const gn = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-ID&gl=ID&ceid=ID:en`;
    return (await fetchRss(gn, "Google News")).slice(0, limit).map((x) => ({ ...x, symbols: [ticker] }));
  }
  return items.slice(0, limit).map((x) => ({ ...x, symbols: [ticker] }));
}

export async function getNewsForSymbols(
  pairs: { ticker: string; asset_class: string }[],
  perSymbol = 5,
): Promise<NewsItem[]> {
  const lists = await Promise.all(pairs.map((p) => getNewsForSymbol(p.ticker, p.asset_class, perSymbol)));
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

const CATEGORY_QUERIES: Record<string, string> = {
  markets: "stock market",
  stock: "stocks earnings",
  crypto: "cryptocurrency bitcoin",
  economy: "economy federal reserve inflation",
};

export async function getNewsFeed(
  category: "markets" | "stock" | "crypto" | "economy" = "markets",
  limit = 40,
): Promise<NewsItem[]> {
  const q = CATEGORY_QUERIES[category] || CATEGORY_QUERIES.markets;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
  const items = await fetchRss(url, "Google News");
  return items.slice(0, limit);
}
