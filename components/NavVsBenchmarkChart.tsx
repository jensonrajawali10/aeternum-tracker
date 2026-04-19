"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Line } from "react-chartjs-2";
import { registerCharts } from "@/lib/chart-register";
import { clsx } from "@/lib/format";

registerCharts();

interface BenchResp {
  range: string;
  dates: string[];
  nav: number[];
  ihsg: number[];
  spx: number[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const RANGES = ["1M", "3M", "YTD", "1Y", "ALL"] as const;

export function NavVsBenchmarkChart({ book }: { book: string }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>("YTD");
  const bookParam = book === "all" ? "" : `&book=${book}`;
  const { data } = useSWR<BenchResp>(`/api/portfolio/benchmark?range=${range}${bookParam}`, fetcher, {
    refreshInterval: 120_000,
  });

  const chartData = useMemo(() => {
    const labels = data?.dates || [];
    return {
      labels,
      datasets: [
        {
          label: "Aeternum",
          data: data?.nav || [],
          borderColor: "#d4a64a",
          backgroundColor: "rgba(212, 166, 74, 0.1)",
          fill: true,
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.2,
        },
        {
          label: "IHSG",
          data: data?.ihsg || [],
          borderColor: "#60a5fa",
          borderDash: [4, 4],
          pointRadius: 0,
          borderWidth: 1.5,
          fill: false,
          tension: 0.2,
        },
        {
          label: "S&P 500",
          data: data?.spx || [],
          borderColor: "#4ade80",
          borderDash: [4, 4],
          pointRadius: 0,
          borderWidth: 1.5,
          fill: false,
          tension: 0.2,
        },
      ],
    };
  }, [data]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: { labels: { usePointStyle: true, boxWidth: 8, color: "#7a8699" } },
        tooltip: { backgroundColor: "#161f2a", borderColor: "#1f2a38", borderWidth: 1, padding: 10 },
      },
      scales: {
        x: {
          grid: { color: "rgba(31,42,56,0.4)" },
          ticks: { color: "#7a8699", maxTicksLimit: 8, maxRotation: 0 },
        },
        y: {
          grid: { color: "rgba(31,42,56,0.4)" },
          ticks: { color: "#7a8699", callback: (v: number | string) => `${Number(v).toFixed(0)}` },
        },
      },
    }),
    [],
  );

  const empty = !data?.dates?.length;

  return (
    <div>
      <div className="flex justify-end gap-1 mb-2">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={clsx(
              "px-2 py-[3px] text-[10px] uppercase tracking-wider rounded border",
              range === r
                ? "bg-accent text-bg border-accent font-semibold"
                : "text-muted border-border hover:text-fg",
            )}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="h-[280px]">
        {empty ? (
          <div className="h-full flex items-center justify-center text-muted text-[12px]">
            No NAV history yet. Daily snapshots begin after first cron run.
          </div>
        ) : (
          <Line data={chartData} options={options} />
        )}
      </div>
    </div>
  );
}
