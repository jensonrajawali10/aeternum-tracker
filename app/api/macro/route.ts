import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * FRED macro feed — audit-grade source for KPI sparklines on the dashboard.
 *
 * Series we surface:
 *   - DGS10     : 10Y Treasury yield (redundant with /api/quotes ^TNX, but
 *                 FRED is the official source so this is what gets cited)
 *   - DFF       : Effective Federal Funds Rate
 *   - CPIAUCSL  : CPI-U All Items, used for YoY headline inflation calc
 *   - DTWEXBGS  : Trade-Weighted USD Index (broad)
 *
 * Auth: process.env.FRED_API_KEY. When unset we don't 500 — we return
 * { error: "fred_key_missing", series: {} } with status 200 so the consumer
 * can render an em-dash placeholder rather than crashing the page. Same goes
 * for individual series upstream errors: each series request is independent
 * and Promise.all-ed; a failed series leaves that key undefined in `series`.
 *
 * Cache header is generous (1h s-maxage, 24h SWR) because FRED updates daily —
 * polling tighter than that just wastes round-trips for the same numbers.
 *
 * Response shape:
 *   {
 *     series: {
 *       DGS10:    { value, prev, change, asof },
 *       DFF:      { value, prev, change, asof },
 *       CPIAUCSL: { value, prev, change, asof },  // change here = YoY-style delta
 *       DTWEXBGS: { value, prev, change, asof }
 *     },
 *     fetched_at: "2026-04-28T12:34:56.789Z"
 *   }
 */

const TIMEOUT_MS = 4_000;

const SERIES_IDS = ["DGS10", "DFF", "CPIAUCSL", "DTWEXBGS"] as const;
type SeriesId = (typeof SERIES_IDS)[number];

interface SeriesPoint {
  value: number;
  prev: number;
  change: number;
  asof: string; // YYYY-MM-DD
}

interface FredObservation {
  date: string;
  value: string;
}

interface FredResponse {
  observations?: FredObservation[];
}

/**
 * Fetch a single FRED series and reduce to (value, prev, change, asof).
 *
 * For CPIAUCSL we want a YoY change rather than month-over-month — CPI MoM is
 * noisy and not what the dashboard surfaces — so we ask for 13 observations
 * and diff the latest against ~12 months ago. Other series stay as a simple
 * latest-vs-previous-print delta which is the natural comparison for them.
 */
async function fetchSeries(id: SeriesId, apiKey: string): Promise<SeriesPoint | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    // CPIAUCSL needs 13 monthly observations to compute a YoY delta;
    // other series only need the latest two observations for a simple change.
    const limit = id === "CPIAUCSL" ? 13 : 2;
    const url =
      `https://api.stlouisfed.org/fred/series/observations` +
      `?series_id=${encodeURIComponent(id)}` +
      `&api_key=${encodeURIComponent(apiKey)}` +
      `&file_type=json&sort_order=desc&limit=${limit}`;
    const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as FredResponse;
    const obs = (json.observations || []).filter((o) => o.value !== "." && o.value !== "");
    if (obs.length < 2) return null;
    const latest = obs[0];
    const value = parseFloat(latest.value);
    if (!isFinite(value)) return null;

    let prevPoint: FredObservation;
    if (id === "CPIAUCSL") {
      // We requested 13 sorted desc — index 12 is the print 12 months ago.
      // Fall back to the oldest available if a publication gap shrunk the run.
      prevPoint = obs[12] || obs[obs.length - 1];
    } else {
      prevPoint = obs[1];
    }
    const prev = parseFloat(prevPoint.value);
    if (!isFinite(prev)) return null;

    // For CPIAUCSL the "change" is YoY pct; for everything else it's the
    // absolute delta between the two prints (rates and indices already live
    // in their natural units, so no division).
    const change = id === "CPIAUCSL" ? ((value / prev) - 1) * 100 : value - prev;

    return { value, prev, change, asof: latest.date };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    // 200 + empty series so the consumer renders "—" instead of crashing.
    return NextResponse.json(
      {
        error: "fred_key_missing",
        series: {},
        fetched_at: new Date().toISOString(),
      },
      {
        headers: {
          // Even the "no key" branch gets cached briefly — repeat polls during
          // a deploy with a missing env var don't deserve N round-trips.
          "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  }

  const results = await Promise.all(SERIES_IDS.map((id) => fetchSeries(id, apiKey)));
  const series: Partial<Record<SeriesId, SeriesPoint>> = {};
  SERIES_IDS.forEach((id, i) => {
    const point = results[i];
    if (point) series[id] = point;
  });

  return NextResponse.json(
    {
      series,
      fetched_at: new Date().toISOString(),
    },
    {
      headers: {
        // FRED publishes daily — caching ~1h trades a tiny freshness window
        // for far fewer upstream calls when the dashboard is hot.
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
