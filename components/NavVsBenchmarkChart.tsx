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
    // Track the index of the last real (non-null) NAV point so we can
    // bump the endpoint marker — the latest data point gets a fatter
    // dot (4px vs the regular 2.5px sample dots) so the eye lands there
    // first, matching the terminal-mock spec.
    const navSeries = data?.nav || [];
    let lastNavIdx = -1;
    for (let i = navSeries.length - 1; i >= 0; i--) {
      const v = navSeries[i];
      if (v != null && Number.isFinite(v)) { lastNavIdx = i; break; }
    }
    return {
      labels,
      datasets: [
        {
          label: "NAV",
          data: navSeries,
          // Terminal palette: amber for NAV (brand spine), cyan dashed
          // for JCI, magenta dashed for S&P.  Solid 1.6px on NAV vs 1.2px
          // on benchmarks so the eye reads "this is the line that matters".
          borderColor: "#FFA726",
          backgroundColor: "transparent",
          fill: false,
          pointRadius: (ctx: { dataIndex: number; raw: unknown }) => {
            if (ctx.raw == null || !isFinite(ctx.raw as number)) return 0;
            return ctx.dataIndex === lastNavIdx ? 4 : 2.5;
          },
          pointBackgroundColor: "#FFA726",
          pointBorderColor: "#FFA726",
          pointBorderWidth: 0,
          borderWidth: 1.6,
          tension: 0.18,
          spanGaps: true,
        },
        {
          label: "JCI",
          data: data?.ihsg || [],
          borderColor: "#22D3EE",
          borderDash: [4, 3],
          pointRadius: 0,
          borderWidth: 1.2,
          fill: false,
          tension: 0.18,
        },
        {
          label: "S&P 500",
          data: data?.spx || [],
          borderColor: "#D946EF",
          borderDash: [2, 3],
          pointRadius: 0,
          borderWidth: 1.2,
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
          callbacks: {
            // Series is indexed to 100; render tooltip values as signed % change
            // so the chart reads unambiguously as a performance benchmark.
            label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
              const y = ctx.parsed.y;
              if (y == null || !isFinite(y)) return `${ctx.dataset.label}: —`;
              const pct = y - 100;
              const sign = pct >= 0 ? "+" : "";
              return `${ctx.dataset.label}: ${sign}${pct.toFixed(2)}%`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: "rgba(255,255,255,0.06)" },
          ticks: {
            color: "#8A8A93",
            maxTicksLimit: 8,
            maxRotation: 0,
            font: { family: "JetBrains Mono", size: 10 },
          },
        },
        y: {
          // Faint horizontal gridlines at every major tick + bold zero
          // (the rebased-to-100 baseline).  Reading the chart should be
          // "where am I vs where I started" — the bold 100 line makes
          // the answer visible without a tooltip.
          grid: {
            display: true,
            color: (ctx: { tick: { value: number } }) =>
              ctx.tick.value === 100
                ? "rgba(255,255,255,0.18)"
                : "rgba(255,255,255,0.04)",
            lineWidth: (ctx: { tick: { value: number } }) =>
              ctx.tick.value === 100 ? 1.2 : 1,
            drawTicks: false,
          },
          border: { display: false },
          ticks: {
            color: "#8A8A93",
            maxTicksLimit: 6,
            // Axis shows performance — "+10%" / "-5%" instead of "110" / "95".
            // Rebased-to-100 series, so value − 100 = % since period start.
            callback: (v: number | string) => {
              const pct = Number(v) - 100;
              const sign = pct > 0 ? "+" : "";
              return `${sign}${pct.toFixed(0)}%`;
            },
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
          <LegendKey stroke="#FFA726" label="NAV" value={navPct} solid />
          <LegendKey stroke="#22D3EE" label="JCI" value={ihsgPct} dashed />
          <LegendKey stroke="#D946EF" label="S&P" value={spxPct} dotted />
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={clsx(
                "mono px-2 h-[24px] text-[10.5px] rounded-[4px] transition-colors",
                range === r ? "bg-accent text-bg" : "text-muted hover:text-fg hover:bg-elevated",
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
