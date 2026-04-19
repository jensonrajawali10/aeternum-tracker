import type { AssetClass } from "@/lib/types";
import { getIdxQuote, getIdxHistory } from "./idx";
import { getUsQuote, getUsHistory } from "./us";
import { getCryptoQuote, getCryptoHistory } from "./crypto";
import { getLiveFxRate } from "./fx";

export interface Quote {
  ticker: string;
  price: number;
  prev_close: number | null;
  day_change_pct: number | null;
  currency: string;
  at: number;
}

export async function getQuote(ticker: string, assetClass: AssetClass): Promise<Quote | null> {
  switch (assetClass) {
    case "idx_equity":
      return getIdxQuote(ticker);
    case "us_equity":
      return getUsQuote(ticker);
    case "crypto":
      return getCryptoQuote(ticker);
    case "fx": {
      const [from, to] = ticker.includes("/") ? ticker.split("/") : [ticker.slice(0, 3), ticker.slice(3, 6)];
      const q = await getLiveFxRate(from, to);
      if (!q) return null;
      return {
        ticker: `${from}/${to}`,
        price: q.rate,
        prev_close: null,
        day_change_pct: null,
        currency: to,
        at: q.at,
      };
    }
    default:
      return null;
  }
}

export async function getHistory(
  ticker: string,
  assetClass: AssetClass,
  period1: string | Date,
  period2: string | Date = new Date(),
): Promise<{ date: string; close: number }[]> {
  switch (assetClass) {
    case "idx_equity":
      return getIdxHistory(ticker, period1, period2);
    case "us_equity":
      return getUsHistory(ticker, period1, period2);
    case "crypto": {
      const p1 = typeof period1 === "string" ? new Date(period1) : period1;
      const days = Math.max(1, Math.ceil((Date.now() - p1.getTime()) / (1000 * 60 * 60 * 24)));
      return getCryptoHistory(ticker, days);
    }
    default:
      return [];
  }
}

export { getIdxQuote, getIdxQuotes, getIdxHistory } from "./idx";
export { getUsQuote, getUsQuotes, getUsHistory } from "./us";
export { getCryptoQuote, getCryptoQuotes, getCryptoHistory } from "./crypto";
export { getLiveFxRate, getUsdIdr } from "./fx";
