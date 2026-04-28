"use client";

import { useEffect, useState, type ReactNode } from "react";
import useSWR from "swr";

interface HealthResp {
  checked_at: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Anything older than 5 min and the heartbeat is stale; the indicator
// flips from green LIVE to red STALE and the seconds counter switches
// to "Xm ago" copy.
const STALE_THRESHOLD_MS = 5 * 60_000;

/**
 * Compact crumb strip that replaces TopHeader on the Command Center.
 *
 * Layout (single row, mb-4 pb-3 border-b):
 *   [01 · COMMAND CENTER · FIRM PULSE] | [Good morning, Jenson]   (spacer)   [● LIVE · last sync Ns]  [optional children · ccy toggle]
 *
 * The "last sync Ns" counter ticks once per second off the most recent
 * /api/health checked_at value.  When the heartbeat is stale (>5min) the
 * dot turns red and copy flips to "STALE · sync Xm ago".
 */
export function DashboardCrumb({
  greeting,
  children,
}: {
  greeting: string;
  children?: ReactNode;
}) {
  // Lazy useState initialiser keeps Date.now() out of render body
  // (React 19 strict-purity rule).  Tick once per second so the
  // seconds-counter feels live.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data } = useSWR<HealthResp>("/api/health", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
    keepPreviousData: true,
  });

  const checkedAt = data ? new Date(data.checked_at).getTime() : null;
  const ageMs = checkedAt != null ? now - checkedAt : null;
  const stale = checkedAt == null || (ageMs != null && ageMs > STALE_THRESHOLD_MS);

  const dotColor = stale ? "var(--color-down)" : "var(--color-up)";
  const dotShadow = stale ? "none" : "0 0 6px 0 var(--color-up)";
  const stateLabel = stale ? "Stale" : "Live";
  const stateTextColor = stale ? "var(--color-down)" : "var(--color-up)";

  let syncCopy = "syncing…";
  if (ageMs != null) {
    if (stale) {
      const minutes = Math.floor(ageMs / 60_000);
      syncCopy = `sync ${minutes}m ago`;
    } else {
      const seconds = Math.max(0, Math.floor(ageMs / 1000));
      syncCopy = `last sync ${seconds}s`;
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 pb-3 border-b border-border">
      {/* Step / breadcrumb cluster — amber 01, fg COMMAND CENTER, muted FIRM PULSE */}
      <div className="flex items-center gap-2 mono uppercase text-[10.5px]" style={{ letterSpacing: "0.18em" }}>
        <span className="text-amber">01</span>
        <span className="text-muted-2">·</span>
        <span className="text-fg">Command Center</span>
        <span className="text-muted-2">·</span>
        <span className="text-muted">Firm Pulse</span>
      </div>

      <span className="hidden md:inline text-muted-2">|</span>

      {/* Greeting — serif italic, muted */}
      <div className="serif italic text-[13px] text-muted">{greeting}</div>

      <div className="flex-1" />

      {/* Live / stale indicator */}
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block rounded-full"
          style={{
            width: 5,
            height: 5,
            background: dotColor,
            boxShadow: dotShadow,
          }}
          aria-hidden
        />
        <span
          className="mono uppercase"
          style={{
            fontSize: 10,
            letterSpacing: "0.14em",
            color: stateTextColor,
          }}
        >
          {stateLabel}
        </span>
        <span className="text-muted-2">·</span>
        <span
          className="mono uppercase text-muted-2"
          style={{ fontSize: 10, letterSpacing: "0.14em" }}
        >
          {syncCopy}
        </span>
      </div>

      {children && (
        <>
          <span style={{ color: "var(--color-border-strong)" }}>|</span>
          <div className="flex items-center gap-2">{children}</div>
        </>
      )}
    </div>
  );
}
