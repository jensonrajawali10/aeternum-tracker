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
  nav_empty?: boolean;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const RANGES = ["1M", "3M", "YTD", "1Y", "ALL"] as const;

/**
 * Compute drawdown series from a rebased-to-100 NAV series.
 *
 *   drawdown_t = (nav_t / runningPeak_t - 1) × 100
 *
 * Returns negative percentages (or zero at peaks). Nulls in the input
 * carry through as nulls so the line doesn't paint through gaps.
 */
function computeDrawdown(nav: (number | null)[]): (number | null)[] {
  const out: (number | null)[] = [];
  let peak: number | null = null;
  for (const v of nav) {
    if (v == null || !Number.isFinite(v)) {
      out.push(null);
      continue;
    }
    if (peak == null || v > peak) peak = v;
    out.push(((v / peak) - 1) * 100);
  }
  return out;
}

/**
 * Drawdown chart — companion to NavVsBenchmarkChart.  Consumes the same
 * /api/portfolio/benchmark feed and computes peak-to-trough drawdown
 * client-side so we don't need a new server endpoint.
 *
 * Rendered as a filled red trace on a 0-floor axis.  The chip in the
 * header surfaces the worst drawdown in the chosen window — that's the
 * number a CIO actually wants to read off the curve.
 */
export function DrawdownChart({ book, height = 200 }: { book: string; height?: number }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>("YTD");
  const bookParam = book === "all" ? "" : `&book=${book}`;
  const { data } = useSWR<BenchResp>(
    `/api/portfolio/benchmark?range=${range}${bookParam}`,
    fetcher,
    { refreshInterval: 120_000 },
  );

  const drawdown = useMemo(() => computeDrawdown(data?.nav || []), [data?.nav]);

  const maxDd = useMemo(() => {
    let worst = 0;
    for (const v of drawdown) {
      if (v != null && Number.isFinite(v) && v < worst) worst = v;
    }
    return worst;
  }, [drawdown]);

  const chartData = useMemo(
    () => ({
      labels: data?.dates || [],
      datasets: [
        {
          label: "Drawdown",
          data: drawdown,
          borderColor: "#B86868",
          backgroundColor: "rgba(184, 104, 104, 0.18)",
          fill: true,
          pointRadius: 0,
          borderWidth: 1.4,
          tension: 0.18,
          spanGaps: true,
        },
      ],
    }),
    [data?.dates, drawdown],
  );

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
            label: (ctx: { parsed: { y: number | null } }) => {
              const y = ctx.parsed.y;
              if (y == null || !isFinite(y)) return "Drawdown: —";
              return `Drawdown: ${y.toFixed(2)}%`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: "#242428" },
          ticks: {
            color: "#6B6B73",
            maxTicksLimit: 6,
            maxRotation: 0,
            font: { family: "JetBrains Mono", size: 10 },
          },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          // Cap at 0; the floor adapts to the worst drawdown so the trace
          // fills the panel rather than collapsing into a thin line.
          max: 0,
          suggestedMin: Math.min(-2, maxDd * 1.1),
          ticks: {
            color: "#6B6B73",
            maxTicksLimit: 4,
            font: { family: "JetBrains Mono", size: 10 },
            callback: (v: number | string) => `${Number(v).toFixed(0)}%`,
          },
        },
      },
    }),
    [maxDd],
  );

  const empty = !data?.dates?.length || data?.nav_empty;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-muted">Max DD</span>
          <span className={clsx("mono", maxDd < 0 ? "neg" : "text-muted-2")}>
            {empty ? "—" : fmtPct(maxDd, 2, true)}
          </span>
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={clsx(
                "mono px-2 h-[24px] text-[10.5px] rounded-[4px] transition-colors",
                range === r
                  ? "bg-accent text-bg"
                  : "text-muted hover:text-fg hover:bg-elevated",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div style={{ height }}>
        {empty ? (
          <div className="h-full flex items-center justify-center text-muted text-[12px]">
            No NAV history yet. Daily-snapshot cron writes one row per book at 05:00 WIB —
            drawdown populates after a few sessions land.
          </div>
        ) : (
          <Line data={chartData} options={options} />
        )}
      </div>
    </div>
  );
}
