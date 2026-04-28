"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";

interface ProviderHealth {
  name: string;
  status: "ok" | "slow" | "down";
  latency_ms: number | null;
}

interface HealthResp {
  checked_at: string;
  providers: ProviderHealth[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Anything older than this and the connection-state pill goes red
// regardless of per-provider status — the heartbeat itself is stale.
const STALE_THRESHOLD_MS = 5 * 60_000;

const PROVIDER_LABELS: Record<string, string> = {
  yahoo: "YAHOO",
  coingecko: "COINGECKO",
  frankfurter: "FX",
  hyperliquid: "HL",
};

function statusGlyph(s: ProviderHealth["status"]): { glyph: string; color: string } {
  if (s === "ok") return { glyph: "✓", color: "var(--color-up)" };
  if (s === "slow") return { glyph: "~", color: "var(--color-accent)" };
  return { glyph: "✗", color: "var(--color-down)" };
}

/**
 * Footer status strip — terminal-feel 22px row pinned to the bottom of
 * every authenticated page.
 *
 * Heartbeat behaviour (per the data-aggregator brief):
 *   - SWR polls /api/health every 60s with revalidateOnFocus = true.
 *   - Each provider gets a glyph: ✓ ok, ~ slow (>1500ms), ✗ down.
 *   - The CONNECTED dot goes green only if at least one provider is ok
 *     AND the heartbeat itself is fresh (checked_at < 5min ago).
 *   - When stale or all-down, the dot drops to red.
 */
export function Footer() {
  const [version] = useState<string>(
    () => process.env.NEXT_PUBLIC_APP_VERSION || "dev",
  );
  // Tick a "now" reference every 30s so staleness recomputes without
  // calling Date.now() during render (React 19 strict-purity rule).
  // Lazy initialiser keeps the first read out of render; the interval
  // re-stamps it on a cadence, which then drives the stale comparison.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const { data } = useSWR<HealthResp>("/api/health", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
    keepPreviousData: true,
  });

  const checkedAt = data ? new Date(data.checked_at).getTime() : null;
  const stale = checkedAt == null || now - checkedAt > STALE_THRESHOLD_MS;
  const anyOk = (data?.providers || []).some((p) => p.status === "ok");
  const connected = !stale && anyOk;

  return (
    <footer
      className="flex items-center gap-3 px-4 border-t"
      style={{
        height: 22,
        borderColor: "var(--color-border)",
        background: "var(--color-panel)",
        fontSize: 10,
      }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block rounded-full"
          style={{
            width: 5,
            height: 5,
            background: connected ? "var(--color-up)" : "var(--color-down)",
            boxShadow: connected ? "0 0 5px 0 var(--color-up)" : "none",
          }}
          aria-hidden
        />
        <span
          className="mono uppercase"
          style={{
            letterSpacing: "0.14em",
            color: connected ? "var(--color-up)" : "var(--color-down)",
          }}
        >
          {connected ? "Connected" : stale && !data ? "Probing…" : "Degraded"}
        </span>
      </div>

      <span style={{ color: "var(--color-border-strong)" }}>·</span>

      <div className="flex items-center gap-2.5 overflow-x-auto">
        {(data?.providers || []).map((p) => {
          const { glyph, color } = statusGlyph(p.status);
          return (
            <span
              key={p.name}
              className="flex items-center gap-1 mono uppercase shrink-0"
              style={{ letterSpacing: "0.14em", color: "var(--color-muted-2)" }}
              title={
                p.latency_ms != null
                  ? `${PROVIDER_LABELS[p.name]} · ${p.status} · ${p.latency_ms}ms`
                  : `${PROVIDER_LABELS[p.name]} · ${p.status}`
              }
            >
              <span style={{ color }}>{glyph}</span>
              <span>{PROVIDER_LABELS[p.name] || p.name.toUpperCase()}</span>
            </span>
          );
        })}
        {!data && (
          <span
            className="mono uppercase text-muted-2"
            style={{ letterSpacing: "0.14em" }}
          >
            quote feed: probing…
          </span>
        )}
      </div>

      <div className="flex-1" />

      <span
        className="mono uppercase text-muted-2 hidden md:inline"
        style={{ letterSpacing: "0.14em" }}
      >
        v{version}
      </span>

      <span style={{ color: "var(--color-border-strong)" }} className="hidden md:inline">
        ·
      </span>

      <span
        className="mono uppercase text-muted hidden md:inline"
        style={{ letterSpacing: "0.14em" }}
      >
        ⌘K · Command
      </span>
    </footer>
  );
}
