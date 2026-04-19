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
        <div className="py-4 text-muted text-[12px] text-center">No signals yet</div>
      )}
      {signals.map((s) => {
        const sev = (s.severity === "warn" ? "warning" : s.severity) as Severity;
        return (
          <div key={s.id} className="py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <SeverityBadge sev={sev} />
                {s.ticker && <span className="text-accent text-[11px] font-medium">{s.ticker}</span>}
                <span className="text-[10px] uppercase tracking-wider text-muted">{s.agent_slug}</span>
              </div>
              <span className="text-[10px] text-muted shrink-0">
                {fmtDate(s.created_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
            <div className="mt-1 text-[12px]">{s.title}</div>
            {s.body && <div className="mt-1 text-[11px] text-muted line-clamp-2">{s.body}</div>}
          </div>
        );
      })}
    </div>
  );
}
