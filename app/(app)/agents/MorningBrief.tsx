"use client";

import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import { SeverityBadge } from "@/components/Badge";
import { fmtDate } from "@/lib/format";
import type { Severity } from "@/lib/types";

interface Signal {
  id: string;
  agent_slug: string;
  signal_type: string;
  ticker: string | null;
  severity: Severity | "warn";
  title: string;
  body: string | null;
  created_at: string;
  acknowledged: boolean;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Morning brief — the CIO's first read of the day.  Surfaces the most
 * recent universe-brief signal if one landed within the last 24h,
 * otherwise prompts a request.  Positioned at the top of the Analysts
 * page so it's the first thing seen when checking the advisory circle.
 */
export function MorningBrief() {
  const { data } = useSWR<{ signals: Signal[] }>(
    "/api/agents/signals?limit=40",
    fetcher,
    { refreshInterval: 60_000 },
  );
  const [busy, setBusy] = useState(false);
  // now is re-read every 5 min so "isToday" flips at WIB midnight without a reload.
  // Lazy init means Date.now() runs once at mount, not on every render.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const latestBrief =
    data?.signals?.find((s) => s.agent_slug === "universe-brief") ?? null;

  const isToday =
    latestBrief != null && now - new Date(latestBrief.created_at).getTime() < 24 * 3600 * 1000;

  async function requestBrief() {
    setBusy(true);
    await fetch("/api/agents/universe-brief/trigger", { method: "POST" });
    setBusy(false);
    mutate("/api/agents/signals?limit=40");
    mutate("/api/agents/signals?limit=200");
  }

  // Compute the date string from the ticker, not from a fresh new Date(),
  // so render stays pure w.r.t. the react-hooks/purity rule.
  const today = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(now));

  const sev = latestBrief
    ? ((latestBrief.severity === "warn" ? "warning" : latestBrief.severity) as Severity)
    : null;

  return (
    <div className="bg-panel border border-border rounded-[10px] p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-[9.5px] uppercase tracking-[0.16em] text-muted-2 mb-1">
            Morning brief
          </div>
          <div className="text-[15px] font-semibold text-fg tracking-[-0.01em]">{today}</div>
          <div className="text-[11px] text-muted-2 mt-[1px]">Asia/Jakarta (WIB)</div>
        </div>
        <button
          onClick={requestBrief}
          disabled={busy}
          className="bg-accent text-bg hover:bg-accent/90 px-4 py-[8px] rounded text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-60 shrink-0"
        >
          {busy ? "Requesting…" : isToday ? "Refresh brief" : "Request brief"}
        </button>
      </div>

      {latestBrief && isToday && sev ? (
        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex items-center gap-2">
            {latestBrief.ticker && (
              <span className="mono text-[11.5px] text-fg">{latestBrief.ticker}</span>
            )}
            <SeverityBadge sev={sev} />
            <span className="mono text-[10.5px] text-muted-2 ml-auto">
              Posted{" "}
              {fmtDate(latestBrief.created_at, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="text-[15px] text-fg font-medium leading-snug">{latestBrief.title}</div>
          {latestBrief.body && (
            <div className="text-[12px] text-muted leading-relaxed whitespace-pre-wrap">
              {latestBrief.body}
            </div>
          )}
        </div>
      ) : latestBrief && !isToday && sev ? (
        <div className="border-t border-border pt-3 space-y-2">
          <div className="text-[11px] text-muted-2 mb-1">
            Last brief is stale (
            {fmtDate(latestBrief.created_at, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            ) — request a fresh one before the open.
          </div>
          <div className="flex items-center gap-2">
            <SeverityBadge sev={sev} />
            <div className="text-[12.5px] text-muted leading-snug">{latestBrief.title}</div>
          </div>
        </div>
      ) : (
        <div className="border-t border-border pt-3 text-[11.5px] text-muted leading-relaxed">
          No universe-brief on file yet. Kick off a run to generate overnight moves,
          calendar flags, and watchlist triggers — the brief will appear here once the
          skill posts back via webhook.
        </div>
      )}
    </div>
  );
}
