"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { Doughnut } from "react-chartjs-2";
import { registerCharts } from "@/lib/chart-register";
import type { AssetClass } from "@/lib/types";

registerCharts();

interface Position {
  ticker: string;
  asset_class: AssetClass;
  market_value_idr: number | null;
}

interface PositionsResp {
  positions: Position[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const COLORS = ["#d4a64a", "#60a5fa", "#4ade80", "#a78bfa", "#f59e0b", "#6ee7b7", "#f87171", "#e879f9"];

export function SectorDoughnut({ book }: { book: string }) {
  const bookParam = book === "all" ? "" : `?book=${book}`;
  const { data } = useSWR<PositionsResp>(`/api/positions${bookParam}`, fetcher, { refreshInterval: 60_000 });

  const chartData = useMemo(() => {
    const positions = data?.positions || [];
    const tickerMap = new Map<string, number>();
    positions.forEach((p) => {
      const mv = Math.abs(p.market_value_idr || 0);
      tickerMap.set(p.ticker, (tickerMap.get(p.ticker) || 0) + mv);
    });
    const sorted = [...tickerMap.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 7);
    const rest = sorted.slice(7).reduce((a, [, v]) => a + v, 0);
    const labels = top.map(([k]) => k);
    const values = top.map(([, v]) => v);
    if (rest > 0) {
      labels.push("Other");
      values.push(rest);
    }
    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((_, i) => COLORS[i % COLORS.length]),
          borderColor: "#111820",
          borderWidth: 2,
        },
      ],
    };
  }, [data]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "right" as const, labels: { color: "#7a8699", boxWidth: 10, padding: 8, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx: { label: string; parsed: number; dataset: { data: number[] } }) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : "0";
              return `${ctx.label}: ${pct}%`;
            },
          },
        },
      },
      cutout: "65%",
    }),
    [],
  );

  const empty = !data?.positions?.length;

  return (
    <div className="h-[240px]">
      {empty ? (
        <div className="h-full flex items-center justify-center text-muted text-[12px]">No positions</div>
      ) : (
        <Doughnut data={chartData} options={options} />
      )}
    </div>
  );
}
