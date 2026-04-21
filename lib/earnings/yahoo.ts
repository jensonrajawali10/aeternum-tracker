// Earnings data from Yahoo Finance via yahoo-finance2.
//
// Replaces the Perplexity-based implementation — no LLM, no API key required.
// Uses quoteSummary modules: calendarEvents (next date + estimates),
// earningsHistory (recent actuals + surprise%), earningsTrend (guidance).
//
// News "highlights" are pulled from Yahoo's per-symbol RSS and treated as
// recent call/filing headlines; we don't pretend they're verbatim transcripts.

import { yf } from "@/lib/prices/yahoo-client";
import { getNewsForSymbol, yahooSymbol } from "@/lib/news/feeds";
import type { AssetClass } from "@/lib/types";

export interface EarningsSummary {
  ticker: string;
  asset_class: AssetClass;
  next_earnings_date: string | null;
  last_report_date: string | null;
  consensus: { eps: number | null; revenue: string | null };
  recent_reported: {
    eps: number | null;
    revenue: string | null;
    surprise_pct: number | null;
  } | null;
  highlights: string[];
  risks: string[];
  guidance: string | null;
  sources: { title: string; url: string }[];
  generated_at: number;
}

export interface EarningsCalendarRow {
  ticker: string;
  company: string;
  date: string;
  session: "pre" | "post" | "during" | "unknown";
  eps_consensus: number | null;
  revenue_consensus: string | null;
  asset_class?: AssetClass;
}

function fmtDate(d: Date | undefined | null): string | null {
  if (!d) return null;
  try {
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function fmtRevenue(n: number | null | undefined, currency = "USD"): string | null {
  if (n == null || !isFinite(n)) return null;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${currency} ${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${currency} ${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${currency} ${(abs / 1e6).toFixed(1)}M`;
  return `${sign}${currency} ${abs.toFixed(0)}`;
}

function sessionFromHour(h: number | null): EarningsCalendarRow["session"] {
  if (h == null) return "unknown";
  if (h < 9) return "pre";      // before 9:30am ET
  if (h >= 16) return "post";   // after 4pm ET
  return "during";
}

export async function getEarningsSummary(
  ticker: string,
  assetClass: AssetClass,
): Promise<EarningsSummary> {
  const sym = yahooSymbol(ticker, assetClass);
  let data: Record<string, unknown> = {};
  try {
    data = await yf.quoteSummary(sym, {
      modules: ["calendarEvents", "earnings", "earningsHistory", "earningsTrend", "price"],
    }) as unknown as Record<string, unknown>;
  } catch (e) {
    console.error("[earnings.yahoo] quoteSummary failed", ticker, e);
  }

  const cal = (data.calendarEvents as { earnings?: {
    earningsDate?: Date[];
    earningsAverage?: number;
    earningsLow?: number;
    earningsHigh?: number;
    revenueAverage?: number;
    revenueLow?: number;
    revenueHigh?: number;
  } } | undefined)?.earnings;

  const hist = (data.earningsHistory as { history?: Array<{
    epsActual?: number;
    epsEstimate?: number;
    epsDifference?: number;
    surprisePercent?: number;
    quarter?: Date;
    period?: string;
  }> } | undefined)?.history || [];

  const trend = (data.earningsTrend as { trend?: Array<{
    period?: string;
    growth?: number;
    earningsEstimate?: { avg?: number };
    revenueEstimate?: { avg?: number };
  }> } | undefined)?.trend || [];

  const price = data.price as { currency?: string; longName?: string; shortName?: string } | undefined;
  const currency = price?.currency || (assetClass === "idx_equity" ? "IDR" : "USD");

  const nextDate = cal?.earningsDate?.[0];
  const latestHist = hist.length ? hist[hist.length - 1] : null;
  const lastQuarter = latestHist?.quarter;

  const recentReported = latestHist
    ? {
        eps: latestHist.epsActual ?? null,
        revenue: null,
        surprise_pct:
          latestHist.surprisePercent != null ? latestHist.surprisePercent * 100 : null,
      }
    : null;

  // Guidance — next-period estimate deltas vs current
  let guidance: string | null = null;
  const nextQtr = trend.find((t) => t.period === "+1q");
  if (nextQtr?.earningsEstimate?.avg != null) {
    const eps = nextQtr.earningsEstimate.avg;
    const growth = nextQtr.growth != null ? `${(nextQtr.growth * 100).toFixed(1)}% YoY growth` : null;
    guidance = `Next Q EPS est ${eps.toFixed(2)}${growth ? ` · ${growth}` : ""}`;
  }

  // Pull recent news as highlights (headlines only — disclaimed in UI)
  const news = await getNewsForSymbol(ticker, assetClass, 6).catch(() => []);
  const highlights = news.slice(0, 5).map((n) => n.title).filter(Boolean);
  const sources = news.slice(0, 6).map((n) => ({ title: n.source, url: n.url }));

  return {
    ticker,
    asset_class: assetClass,
    next_earnings_date: fmtDate(nextDate),
    last_report_date: fmtDate(lastQuarter),
    consensus: {
      eps: cal?.earningsAverage ?? null,
      revenue: fmtRevenue(cal?.revenueAverage, currency),
    },
    recent_reported: recentReported,
    highlights,
    risks: [],
    guidance,
    sources,
    generated_at: Date.now(),
  };
}

export async function getEarningsCalendar(
  tickers: { ticker: string; asset_class: AssetClass }[],
): Promise<EarningsCalendarRow[]> {
  if (!tickers.length) return [];

  const results = await Promise.all(
    tickers.slice(0, 30).map(async (t): Promise<EarningsCalendarRow | null> => {
      const sym = yahooSymbol(t.ticker, t.asset_class);
      try {
        const data = (await yf.quoteSummary(sym, {
          modules: ["calendarEvents", "price"],
        })) as unknown as Record<string, unknown>;
        const cal = (data.calendarEvents as { earnings?: {
          earningsDate?: Date[];
          earningsAverage?: number;
          revenueAverage?: number;
        } } | undefined)?.earnings;
        const price = data.price as { longName?: string; shortName?: string; currency?: string } | undefined;
        const nextDate = cal?.earningsDate?.[0];
        if (!nextDate) return null;
        const now = Date.now();
        const nextMs = nextDate.getTime();
        // Skip rows outside the 90-day horizon.
        if (nextMs < now - 24 * 3600_000 || nextMs > now + 90 * 24 * 3600_000) return null;
        const hour = nextDate.getUTCHours();
        return {
          ticker: t.ticker,
          company: price?.longName || price?.shortName || t.ticker,
          date: fmtDate(nextDate)!,
          session: sessionFromHour(hour),
          eps_consensus: cal?.earningsAverage ?? null,
          revenue_consensus: fmtRevenue(cal?.revenueAverage, price?.currency || "USD"),
          asset_class: t.asset_class,
        };
      } catch (e) {
        console.error("[earnings.yahoo] calendar failed", t.ticker, e);
        return null;
      }
    }),
  );

  return results
    .filter((r): r is EarningsCalendarRow => r !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}
