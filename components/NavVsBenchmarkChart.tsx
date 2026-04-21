"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Line } from "react-chartjs-2";
import { registerCharts } from "@/lib/chart-register";
import { clsx, fmtPct } from "@/lib/format";

registerCharts();

interface BenchResp {
  range: string;
  dates: string[];
  nav: (number | null)[];
  ihsg: (number | null)[];
  spx: (number | null)[];
  nav_empty?: boolean;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const RANGES = ["1M", "3M", "YTD", "1Y", "ALL"] as const;

function lastPct(arr?: (number | null)[]): number | null {
  if (!arr || arr.length === 0) return null;
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i];
    if (v != null && isFinite(v)) return v - 100;
  }
  return null;
}

export function NavVsBenchmarkChart({ book, height = 260 }: { book: string; height?: number }) {
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
          label: "NAV",
          data: data?.nav || [],
          borderColor: "#E4E4E7",
          backgroundColor: "transparent",
          fill: false,
          // Show a dot on each real NAV point so a single-point NAV is still visible
          pointRadius: (ctx: { raw: unknown }) =>
            ctx.raw == null || !isFinite(ctx.raw as number) ? 0 : 2,
          pointBackgroundColor: "#E4E4E7",
          pointBorderWidth: 0,
          borderWidth: 1.3,
          tension: 0.18,
          spanGaps: false,
        },
        {
          label: "JCI",
          data: data?.ihsg || [],
          borderColor: "#A1A1AA",
          borderDash: [4, 3],
          pointRadius: 0,
          borderWidth: 1,
          fill: false,
          tension: 0.18,
        },
        {
          label: "S&P 500",
          data: data?.spx || [],
          borderColor: "#6B6B73",
          borderDash: [2, 3],
          pointRadius: 0,
          borderWidth: 1,
          fill: false,
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
        legend: { display: false },
        tooltip: {
          backgroundColor: "#141418",
          borderColor: "#242428",
          borderWidth: 1,
          padding: 10,
          titleColor: "#E4E4E7",
          bodyColor: "#A1A1AA",
          titleFont: { family: "JetBrains Mono", size: 10 },
          bodyFont: { family: "JetBrains Mono", size: 11 },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: "#242428" },
          ticks: { color: "#6B6B73", maxTicksLimit: 8, maxRotation: 0, font: { family: "JetBrains Mono", size: 10 } },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: "#6B6B73",
            maxTicksLimit: 5,
            callback: (v: number | string) => `${Number(v).toFixed(0)}`,
            font: { family: "JetBrains Mono", size: 10 },
          },
        },
      },
    }),
    [],
  );

  const empty = !data?.dates?.length;
  const navEmpty = data?.nav_empty;

  const navPct = lastPct(data?.nav);
  const ihsgPct = lastPct(data?.ihsg);
  const spxPct = lastPct(data?.spx);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-5 text-[11px]">
          <LegendKey stroke="#E4E4E7" label="NAV" value={navPct} solid />
          <LegendKey stroke="#A1A1AA" label="JCI" value={ihsgPct} dashed />
          <LegendKey stroke="#6B6B73" label="S&P" value={spxPct} dotted />
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={clsx(
                "mono px-2 h-[24px] text-[10.5px] rounded-[4px] transition-colors",
                range === r ? "bg-elevated text-fg" : "text-muted hover:text-fg hover:bg-elevated",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      {navEmpty && !empty && (
        <div className="text-[11px] text-muted mb-2">
          Benchmarks only — sync trades or add open positions to see your line.
        </div>
      )}
      <div style={{ height }}>
        {empty ? (
          <div className="h-full flex items-center justify-center text-muted text-[12px]">
            No benchmark history available.
          </div>
        ) : (
          <Line data={chartData} options={options} />
        )}
      </div>
    </div>
  );
}

function LegendKey({
  stroke,
  label,
  value,
  solid,
  dashed,
  dotted,
}: {
  stroke: string;
  label: string;
  value: number | null;
  solid?: boolean;
  dashed?: boolean;
  dotted?: boolean;
}) {
  const strokeDasharray = dashed ? "4 3" : dotted ? "2 3" : undefined;
  const signed = value == null ? "—" : fmtPct(value, 1, true);
  const cls = value == null ? "text-muted" : value >= 0 ? "pos" : "neg";
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="6" aria-hidden>
        <line
          x1="0" y1="3" x2="22" y2="3"
          stroke={stroke}
          strokeWidth={solid ? 1.4 : 1}
          strokeDasharray={strokeDasharray}
        />
      </svg>
      <span className="text-muted">{label}</span>
      <span className={`mono ${cls}`}>{signed}</span>
    </div>
  );
}
