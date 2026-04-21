"use client";

import useSWR from "swr";
import { SeverityBadge } from "./Badge";
import { fmtDate } from "@/lib/format";
import type { Severity } from "@/lib/types";

interface Signal {
  id: string;
  agent_slug: string;
  signal_type: string;
  ticker: string | null;
  severity: Severity | "warn";   // legacy rows used "warn"; normalise at render time
  title: string;
  body: string | null;
  created_at: string;
  acknowledged: boolean;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function SignalFeed({ limit = 10 }: { limit?: number }) {
  const { data } = useSWR<{ signals: Signal[] }>(`/api/agents/signals?limit=${limit}`, fetcher, {
    refreshInterval: 30_000,
  });
  const signals = data?.signals ?? [];

  return (
    <div className="divide-y divide-border">
      {signals.length === 0 && (
        <div className="py-6 text-muted text-[12px] text-center">No signals yet</div>
      )}
      {signals.map((s) => {
        const sev = (s.severity === "warn" ? "warning" : s.severity) as Severity;
        return (
          <div key={s.id} className="py-3 hover:bg-elevated -mx-4 px-4 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="mono text-[11px] text-muted">{s.agent_slug}</span>
                {s.ticker && <span className="mono text-[11px] text-fg">{s.ticker}</span>}
                <SeverityBadge sev={sev} />
              </div>
              <span className="mono text-[10.5px] text-muted-2 shrink-0">
                {fmtDate(s.created_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
            <div className="mt-[4px] text-[13px] text-fg leading-snug">{s.title}</div>
            {s.body && <div className="mt-[2px] text-[11.5px] text-muted line-clamp-2">{s.body}</div>}
          </div>
        );
      })}
    </div>
  );
}
