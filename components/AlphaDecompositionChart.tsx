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
          label: "vs JCI",
          data: sorted.map((d) => ihsgMap.get(d) ?? null),
          // Blue for IHSG-relative alpha — matches main NAV chart palette.
          borderColor: "#7fa2d6",
          backgroundColor: "transparent",
          fill: false,
          pointRadius: 0,
          borderWidth: 1.5,
          tension: 0.18,
        },
        {
          label: "vs S&P 500",
          data: sorted.map((d) => spxMap.get(d) ?? null),
          // Green for S&P-relative alpha — matches main NAV chart palette.
          borderColor: "#7fb98c",
          borderDash: [4, 3],
          backgroundColor: "transparent",
          fill: false,
          pointRadius: 0,
          borderWidth: 1.3,
          tension: 0.18,
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
        legend: {
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            color: "#A1A1AA",
            font: { family: "JetBrains Mono", size: 10 },
          },
        },
        tooltip: {
          backgroundColor: "#141418",
          borderColor: "#242428",
          borderWidth: 1,
          padding: 10,
          titleColor: "#E4E4E7",
          bodyColor: "#A1A1AA",
          titleFont: { family: "JetBrains Mono", size: 10 },
          bodyFont: { family: "JetBrains Mono", size: 11 },
          callbacks: {
            label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
              `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1) ?? "—"} bps`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: "#242428" },
          ticks: { color: "#6B6B73", maxTicksLimit: 8, font: { family: "JetBrains Mono", size: 10 } },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: "#6B6B73",
            callback: (v: number | string) => `${Number(v).toFixed(0)}bps`,
            font: { family: "JetBrains Mono", size: 10 },
          },
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
