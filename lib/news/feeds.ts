// News feeds — uses Yahoo Finance RSS for per-symbol news and Google News RSS
// for category feeds. Both are free, stable, and don't require auth.
//
// Yahoo:  https://feeds.finance.yahoo.com/rss/2.0/headline?s=<TICKER>&region=US&lang=en-US
// Google: https://news.google.com/rss/search?q=<query>&hl=en-US&gl=US&ceid=US:en

import { scoreHeadline } from "./hotness";

export interface NewsItem {
  id: string;
  title: string;
  published: number; // ms since epoch
  source: string;
  url: string;
  summary?: string;
  symbols?: string[];
  urgency?: number; // 0..3, derived from hotness score
  score?: number;   // 0..100
  reasons?: string[];
}

function enrich(item: NewsItem): NewsItem {
  const { score, reasons } = scoreHeadline(item.title, item.summary || "");
  const urgency = score >= 80 ? 3 : score >= 60 ? 2 : score >= 40 ? 1 : 0;
  return { ...item, score, reasons, urgency };
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
    return (await fetchRss(gn, "Google News")).slice(0, limit).map((x) => enrich({ ...x, symbols: [ticker] }));
  }
  return items.slice(0, limit).map((x) => enrich({ ...x, symbols: [ticker] }));
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

// Category queries. Each category fans out across several sub-queries so we
// get broad coverage of the stuff that actually moves markets — no "just
// stock market today" single-query feed.
const CATEGORY_QUERIES: Record<string, string[]> = {
  markets: [
    // Core index-level queries. US-index news was under-covered before —
    // previously four queries all roughly aliasing "stock market today", which
    // Google clustered down to <5 unique items. Fanned out to cover index
    // moves, records, breadth, volatility, and intraday context separately.
    "S&P 500 index today",
    "S&P 500 record high close",
    "Nasdaq 100 close today",
    "Dow Jones Industrial Average close",
    "Russell 2000 small cap index",
    "VIX volatility index spike",
    "Wall Street stocks rally selloff",
    "US stock market close",
    "US equities futures premarket",
    "market breadth decliners advancers",
    "sector rotation technology financials energy",
    "magnificent seven mega cap tech",
  ],
  stock: [
    "US stocks earnings report",
    "large cap movers",
    "tech stocks Nvidia Apple Microsoft",
    "analyst upgrade downgrade",
  ],
  crypto: [
    "bitcoin ethereum price",
    "crypto market sentiment",
    "crypto ETF spot",
    "stablecoin USDT USDC",
    "solana XRP altcoin",
  ],
  economy: [
    "federal reserve rate decision",
    "US CPI inflation report",
    "jobs report nonfarm payrolls",
    "treasury yields 10 year",
    "consumer spending retail sales",
  ],
  macro: [
    "federal reserve interest rate",
    "FOMC decision",
    "US CPI inflation",
    "oil price OPEC",
    "dollar index DXY",
    "China PBOC stimulus",
    "commodities iron ore coal nickel",
    "geopolitics middle east russia",
    "bank Indonesia rupiah",
    "ECB rate decision",
    "Japan yen BOJ",
    "gold silver price",
  ],
  idx: [
    "IHSG Indonesia stock exchange",
    "Bank Indonesia policy rate",
    "Indonesia coal nickel export",
    "IDX listed companies earnings",
    "rupiah USD exchange rate",
    "Indonesia economy inflation",
    "Jakarta composite index",
    // Structural-catalyst queries — these used to be missing, which is why
    // MSCI Indonesia rebalance announcements never surfaced in the feed.
    "MSCI Indonesia index review",
    "MSCI rebalance Indonesia add remove",
    "LQ45 IDX30 index review",
    "Kompas100 JII70 index rebalance",
    "IDX index inclusion exclusion announcement",
    "OJK POJK Indonesia regulation",
    "Indonesia KBMI bank classification",
    "IDX rights issue backdoor listing",
  ],
};

export type NewsCategory = keyof typeof CATEGORY_QUERIES;

export async function getNewsFeed(
  category: NewsCategory = "markets",
  limit = 40,
): Promise<NewsItem[]> {
  const queries = CATEGORY_QUERIES[category] || CATEGORY_QUERIES.markets;
  const region = category === "idx" ? "ID" : "US";
  const lists = await Promise.all(
    queries.map((q) => {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-${region}&gl=${region}&ceid=${region}:en`;
      return fetchRss(url, "Google News");
    }),
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
  return merged.slice(0, limit).map(enrich);
}
