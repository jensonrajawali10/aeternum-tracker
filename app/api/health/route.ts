import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Quote-feed heartbeat — fans out to each external data provider used
 * by the dashboard, returns per-provider latency + status. Drives the
 * footer's "YAHOO ✓ COINGECKO ✓ HL ✓" health row, and lets us swap
 * primary/failover providers when one degrades.
 *
 * Each probe is wrapped in a 4s timeout; a request that hangs longer
 * than that is reported as `down` rather than blocking the page. We
 * fire them in parallel via Promise.allSettled so one provider's slow
 * response can't gate the others.
 *
 * Response shape:
 *   {
 *     checked_at: ISO timestamp,
 *     providers: [
 *       { name: 'yahoo',       status: 'ok' | 'slow' | 'down', latency_ms: number | null },
 *       { name: 'coingecko',   ... },
 *       { name: 'frankfurter', ... },
 *       { name: 'hyperliquid', ... },
 *     ]
 *   }
 *
 * The footer polls this every 60s with a 5min staleness threshold —
 * if checked_at is older than 5min the dot goes red regardless of the
 * provider statuses.
 */

const PROVIDERS = [
  {
    name: "yahoo",
    // ^JKSE is the JCI composite — gives us a real IDX-relevant probe
    // rather than just hitting a status page.
    url: "https://query1.finance.yahoo.com/v8/finance/chart/%5EJKSE?range=1d&interval=1d",
    method: "GET" as const,
    body: null as string | null,
  },
  {
    name: "coingecko",
    url: "https://api.coingecko.com/api/v3/ping",
    method: "GET" as const,
    body: null as string | null,
  },
  {
    name: "frankfurter",
    url: "https://api.frankfurter.app/latest?from=USD&to=IDR",
    method: "GET" as const,
    body: null as string | null,
  },
  {
    name: "hyperliquid",
    url: "https://api.hyperliquid.xyz/info",
    method: "POST" as const,
    body: JSON.stringify({ type: "meta" }),
  },
];

const TIMEOUT_MS = 4_000;
// Anything slower than this counts as "slow" — visually distinct from
// "down" so the user can tell the difference between "provider is up
// but laggy" and "provider is unreachable".
const SLOW_THRESHOLD_MS = 1_500;

interface ProviderHealth {
  name: string;
  status: "ok" | "slow" | "down";
  latency_ms: number | null;
}

async function probe(provider: (typeof PROVIDERS)[number]): Promise<ProviderHealth> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(provider.url, {
      method: provider.method,
      headers: provider.body
        ? { "Content-Type": "application/json" }
        : undefined,
      body: provider.body,
      signal: ac.signal,
      // No need to read the body for liveness — `ok` status + reachable
      // is enough. Skipping the parse keeps the probe cheap.
      cache: "no-store",
    });
    const latency = Date.now() - start;
    if (!res.ok) {
      return { name: provider.name, status: "down", latency_ms: latency };
    }
    return {
      name: provider.name,
      status: latency > SLOW_THRESHOLD_MS ? "slow" : "ok",
      latency_ms: latency,
    };
  } catch {
    return { name: provider.name, status: "down", latency_ms: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const results = await Promise.all(PROVIDERS.map(probe));
  return NextResponse.json(
    { checked_at: new Date().toISOString(), providers: results },
    {
      // Cache lightly so a flurry of footer polls from open tabs doesn't
      // stampede the upstreams. 30s server-side, but the client SWR also
      // throttles to 60s polling so this is mostly defensive.
      headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
    },
  );
}
