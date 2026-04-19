"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { Line } from "react-chartjs-2";
import { registerCharts } from "@/lib/chart-register";

registerCharts();

interface AlphaResp {
  rolling: {
    vs_ihsg: { date: string; alpha_bps: number }[];
    vs_spx: { date: string; alpha_bps: number }[];
  };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function AlphaDecompositionChart({ book }: { book: string }) {
  const bookParam = book === "all" ? "" : `?book=${book}`;
  const { data } = useSWR<AlphaResp>(`/api/portfolio/alpha${bookParam}`, fetcher, {
    refreshInterval: 120_000,
  });

  const chartData = useMemo(() => {
    const dates = new Set<string>();
    (data?.rolling.vs_ihsg || []).forEach((p) => dates.add(p.date));
    (data?.rolling.vs_spx || []).forEach((p) => dates.add(p.date));
    const sorted = [...dates].sort();
    const ihsgMap = new Map((data?.rolling.vs_ihsg || []).map((p) => [p.date, p.alpha_bps]));
    const spxMap = new Map((data?.rolling.vs_spx || []).map((p) => [p.date, p.alpha_bps]));
    return {
      labels: sorted,
      datasets: [
        {
          label: "vs IHSG",
          data: sorted.map((d) => ihsgMap.get(d) ?? null),
          borderColor: "#60a5fa",
          backgroundColor: "rgba(96,165,250,0.1)",
          fill: true,
          pointRadius: 0,
          borderWidth: 1.5,
          tension: 0.2,
        },
        {
          label: "vs S&P 500",
          data: sorted.map((d) => spxMap.get(d) ?? null),
          borderColor: "#4ade80",
          backgroundColor: "rgba(74,222,128,0.05)",
          fill: false,
          pointRadius: 0,
          borderWidth: 1.5,
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
        tooltip: {
          callbacks: {
            label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
              `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1) ?? "—"} bps`,
          },
        },
      },
      scales: {
        x: { grid: { color: "rgba(31,42,56,0.4)" }, ticks: { maxTicksLimit: 8 } },
        y: {
          grid: { color: "rgba(31,42,56,0.4)" },
          ticks: { callback: (v: number | string) => `${Number(v).toFixed(0)}bps` },
        },
      },
    }),
    [],
  );

  const empty = !data?.rolling.vs_ihsg?.length && !data?.rolling.vs_spx?.length;

  return (
    <div className="h-[240px]">
      {empty ? (
        <div className="h-full flex items-center justify-center text-muted text-[12px]">
          Need at least 30 days of NAV + benchmark history.
        </div>
      ) : (
        <Line data={chartData} options={options} />
      )}
    </div>
  );
}
