"use client";

import useSWR from "swr";
import { fmtPct } from "@/lib/format";

interface Row {
  bucket: string;
  count: number;
  wins: number;
  win_rate_pct: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function HoldTimeDistribution() {
  const { data } = useSWR<{ rows: Row[] }>("/api/journal/hold-time", fetcher, { refreshInterval: 120_000 });
  const rows = data?.rows || [];
  const maxCount = Math.max(1, ...rows.map((r) => r.count));

  return (
    <div className="space-y-2">
      {rows.every((r) => r.count === 0) && (
        <div className="text-muted text-[12px]">No hold-time data yet</div>
      )}
      {rows.map((r) => (
        <div key={r.bucket}>
          <div className="flex items-center justify-between text-[12px] mb-1">
            <span className="text-muted">{r.bucket}</span>
            <span className="tabular-nums">
              {r.count}{" "}
              <span className={r.win_rate_pct >= 50 ? "pos" : r.win_rate_pct > 0 ? "" : "neg"}>
                ({fmtPct(r.win_rate_pct, 0)})
              </span>
            </span>
          </div>
          <div className="h-[6px] bg-panel-2 rounded overflow-hidden">
            <div className="h-full bg-accent/60" style={{ width: `${(r.count / maxCount) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
