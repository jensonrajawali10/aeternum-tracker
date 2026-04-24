"use client";

import useSWR from "swr";
import { fmtPct, fmtNumber, signClass } from "@/lib/format";

interface Bucket {
  bucket: "HIGH" | "MED" | "LOW";
  count: number;
  win_rate_pct: number;
  avg_realized_r: number | null;
  avg_pnl_pct: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ConvictionCalibration() {
  const { data } = useSWR<{ buckets: Bucket[] }>("/api/journal/conviction", fetcher, { refreshInterval: 120_000 });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px] tabular-nums min-w-[360px]">
        <thead>
          <tr className="text-muted text-[10px] uppercase tracking-wider border-b border-border">
            <th className="py-2 text-left font-normal">Conviction</th>
            <th className="py-2 text-right font-normal">N</th>
            <th className="py-2 text-right font-normal">Win%</th>
            <th className="py-2 text-right font-normal">Avg R</th>
            <th className="py-2 text-right font-normal">Avg P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {(data?.buckets || []).map((b) => (
            <tr key={b.bucket} className="border-b border-border">
              <td className="py-[7px]">{b.bucket}</td>
              <td className="py-[7px] text-right">{b.count}</td>
              <td className={`py-[7px] text-right ${b.win_rate_pct >= 50 ? "pos" : ""}`}>
                {fmtPct(b.win_rate_pct, 1)}
              </td>
              <td className="py-[7px] text-right">
                {b.avg_realized_r != null ? fmtNumber(b.avg_realized_r, 2) : "—"}
              </td>
              <td className={`py-[7px] text-right ${signClass(b.avg_pnl_pct)}`}>
                {fmtPct(b.avg_pnl_pct, 2, true)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
