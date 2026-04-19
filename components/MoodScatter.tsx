"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { Scatter } from "react-chartjs-2";
import { registerCharts } from "@/lib/chart-register";
import { fmtPct, fmtCurrency } from "@/lib/format";

registerCharts();

interface Point {
  mood: number;
  pnl_idr: number;
  pnl_pct: number | null;
}

interface Bucket {
  range: string;
  count: number;
  win_rate_pct: number;
  net_pnl_idr: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function MoodScatter() {
  const { data } = useSWR<{ points: Point[]; buckets: Bucket[] }>("/api/journal/mood-correlation", fetcher, {
    refreshInterval: 120_000,
  });

  const chartData = useMemo(
    () => ({
      datasets: [
        {
          label: "Trades",
          data: (data?.points || []).map((p) => ({ x: p.mood, y: p.pnl_pct ?? 0 })),
          backgroundColor: (data?.points || []).map((p) =>
            (p.pnl_pct ?? 0) >= 0 ? "rgba(74,222,128,0.6)" : "rgba(248,113,113,0.6)",
          ),
          pointRadius: 4,
        },
      ],
    }),
    [data],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          title: { display: true, text: "Mood (1-10)", color: "#7a8699" },
          min: 0,
          max: 10,
          grid: { color: "rgba(31,42,56,0.4)" },
        },
        y: {
          title: { display: true, text: "Trade P&L (%)", color: "#7a8699" },
          grid: { color: "rgba(31,42,56,0.4)" },
          ticks: { callback: (v: number | string) => `${Number(v).toFixed(0)}%` },
        },
      },
    }),
    [],
  );

  const empty = !data?.points?.length;

  return (
    <div>
      <div className="h-[220px] mb-3">
        {empty ? (
          <div className="h-full flex items-center justify-center text-muted text-[12px]">
            Tag mood on trades to see correlation
          </div>
        ) : (
          <Scatter data={chartData} options={options} />
        )}
      </div>
      {!empty && (
        <table className="w-full text-[11px] tabular-nums">
          <thead>
            <tr className="text-muted text-[10px] uppercase tracking-wider border-b border-border">
              <th className="py-1 text-left font-normal">Mood</th>
              <th className="py-1 text-right font-normal">N</th>
              <th className="py-1 text-right font-normal">Win%</th>
              <th className="py-1 text-right font-normal">Net P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {(data?.buckets || []).map((b) => (
              <tr key={b.range} className="border-b border-border">
                <td className="py-1 text-muted">{b.range}</td>
                <td className="py-1 text-right">{b.count}</td>
                <td className="py-1 text-right">{fmtPct(b.win_rate_pct, 1)}</td>
                <td className={`py-1 text-right ${b.net_pnl_idr >= 0 ? "pos" : "neg"}`}>
                  {fmtCurrency(b.net_pnl_idr, "IDR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
