"use client";

import useSWR from "swr";
import { fmtCurrency } from "@/lib/format";

interface Row {
  label: string;
  count: number;
  cost_idr: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function MistakesTaxonomy() {
  const { data } = useSWR<{ mistakes: Row[]; total_trades_with_mistakes: number }>(
    "/api/journal/mistakes",
    fetcher,
    { refreshInterval: 120_000 },
  );
  const rows = data?.mistakes || [];
  const maxCost = Math.abs(rows.reduce((m, r) => Math.min(m, r.cost_idr), 0)) || 1;

  return (
    <div>
      <div className="text-[11px] text-muted mb-3">
        {data ? `${data.total_trades_with_mistakes} trades tagged with mistakes` : "Loading…"}
      </div>
      <div className="space-y-2">
        {rows.length === 0 && <div className="text-muted text-[12px]">No tagged mistakes yet</div>}
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-center justify-between text-[12px] mb-1">
              <span>{r.label}</span>
              <span className="text-muted tabular-nums">
                {r.count}× · <span className="neg">{fmtCurrency(r.cost_idr, "IDR")}</span>
              </span>
            </div>
            <div className="h-[5px] bg-panel-2 rounded overflow-hidden">
              <div
                className="h-full bg-red-500/70"
                style={{ width: `${(Math.abs(r.cost_idr) / maxCost) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
