"use client";

import useSWR, { mutate } from "swr";
import { useEffect, useState } from "react";
import { SeverityBadge } from "./Badge";
import { fmtDate } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Severity } from "@/lib/types";

interface Signal {
  id: string;
  agent_slug: string;
  signal_type: string;
  ticker: string | null;
  severity: Severity | "warn"; // legacy rows used "warn"; normalise at render time
  title: string;
  body: string | null;
  created_at: string;
  acknowledged: boolean;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Map an agent slug to a short uppercase tag for the FeedItem left
// column.  Falls back to the slug uppercased when an unknown agent
// posts a signal — covers future agents without code changes.
function sourceTag(agentSlug: string): string {
  const map: Record<string, string> = {
    "alpha-generator": "ALPHA-GEN",
    "macro-intelligence": "MACRO",
    "risk-sentinel": "RISK",
    "universe-brief": "BRIEF",
    catalyst: "CATALYST",
    exception: "EXCEPTION",
  };
  return map[agentSlug] || agentSlug.toUpperCase().slice(0, 12);
}

/**
 * SignalFeed — dense terminal-style FeedItem rows.  Each row is a
 * three-column grid:
 *   left (60px)  amber mono uppercase source tag (ALPHA-GEN, RISK, etc.)
 *   middle       title + ticker chip + SeverityTag chip + body preview
 *   right        monospace timestamp (HH:MM <24h, "DD MMM HH:MM" else)
 *
 * Realtime: any agent_signals INSERT triggers an immediate SWR
 * revalidation so signals land without a poll delay.
 *
 * Date formatting uses a ticking `now` ref (60s cadence) so "younger
 * than 24h" recomputes without a Date.now() call in render body
 * (React 19 strict-purity rule).
 */
export function SignalFeed({ limit = 10 }: { limit?: number }) {
  const key = `/api/agents/signals?limit=${limit}`;
  const { data } = useSWR<{ signals: Signal[] }>(key, fetcher, {
    refreshInterval: 30_000,
    keepPreviousData: true,
  });
  const signals = data?.signals ?? [];

  // Tick `now` every 60s so day-boundary timestamps refresh format
  // (HH:MM ↔ DD MMM HH:MM) without calling Date.now() during render.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const sb = supabaseBrowser();
    const ch = sb
      .channel(`signals-live-${limit}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agent_signals" },
        () => mutate(key),
      )
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [key, limit]);

  function formatTimestamp(iso: string): string {
    const ts = new Date(iso).getTime();
    const ageMs = now - ts;
    const dayMs = 24 * 60 * 60 * 1000;
    if (ageMs < dayMs) {
      return fmtDate(iso, {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      });
    }
    return fmtDate(iso, {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    });
  }

  if (signals.length === 0) {
    return (
      <div
        className="py-6 text-center text-[10.5px] uppercase text-muted-2"
        style={{ letterSpacing: "0.14em" }}
      >
        No signals yet · Run an analyst skill in Claude Code to populate
      </div>
    );
  }

  return (
    <div
      className="divide-y"
      style={{ borderColor: "var(--color-border)" }}
    >
      {signals.map((s) => {
        const sev = (s.severity === "warn" ? "warning" : s.severity) as Severity;
        const tag = sourceTag(s.agent_slug);
        return (
          <div
            key={s.id}
            className="grid grid-cols-[60px_1fr_auto] items-start gap-3 py-2.5 transition-colors hover:bg-elevated/50 -mx-4 px-4"
            style={{ borderColor: "var(--color-border)" }}
          >
            <span
              className="mono uppercase pt-[2px]"
              style={{
                fontSize: 9.5,
                letterSpacing: "0.10em",
                color: "var(--color-accent)",
              }}
            >
              {tag}
            </span>
            <div className="min-w-0">
              <div className="text-[12.5px] text-fg leading-snug truncate">
                {s.title}
              </div>
              <div className="mt-[3px] flex items-center gap-2 flex-wrap">
                {s.ticker && (
                  <span
                    className="mono uppercase text-fg"
                    style={{ fontSize: 10, letterSpacing: "0.08em" }}
                  >
                    {s.ticker}
                  </span>
                )}
                <SeverityBadge sev={sev} />
                {s.body && (
                  <span className="text-[10.5px] text-muted-2 truncate flex-1 min-w-0">
                    {s.body}
                  </span>
                )}
              </div>
            </div>
            <span
              className="mono text-muted-2 pt-[2px] shrink-0 uppercase"
              style={{ fontSize: 10, letterSpacing: "0.06em" }}
              title={s.created_at}
            >
              {formatTimestamp(s.created_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
