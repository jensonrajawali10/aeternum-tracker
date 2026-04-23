"use client";

import Link from "next/link";
import useSWR from "swr";
import { clsx, fmtCurrency } from "@/lib/format";

type DriftStatus = "on_target" | "drifting" | "rebalance";

interface AllocationRow {
  slug: string;
  book: string;
  title: string;
  pm: string;
  target_pct: number;
  actual_nav_idr: number;
  actual_pct: number;
  drift_pp: number;
  status: DriftStatus;
}

interface AllocationResp {
  firm_nav_idr: number;
  firm_nav_usd: number;
  usd_idr: number;
  rows: AllocationRow[];
  tolerance_pp: number;
  rebalance_pp: number;
  last_rebalance_at: string | null;
}

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function statusPill(status: DriftStatus): { label: string; cls: string } {
  if (status === "on_target") return { label: "On target", cls: "bg-green/15 text-green border-green/30" };
  if (status === "drifting") return { label: "Drifting", cls: "bg-[#d4a64a]/15 text-[#d4a64a] border-[#d4a64a]/30" };
  return { label: "Rebalance", cls: "bg-red/15 text-red border-red/30" };
}

/**
 * Per-arm drift bar — target band sits centred at target_pct ± tolerance
 * along the 0..100% axis, actual dot sits at actual_pct.  Tight visual
 * way to see both the target and whether we're inside or outside the
 * acceptable band.
 */
function DriftBar({
  target,
  actual,
  tolerance,
  status,
}: {
  target: number;
  actual: number;
  tolerance: number;
  status: DriftStatus;
}) {
  const bandLeft = Math.max(0, target - tolerance);
  const bandRight = Math.min(100, target + tolerance);
  const dotLeft = Math.max(0, Math.min(100, actual));
  const dotColor =
    status === "on_target" ? "bg-green" : status === "drifting" ? "bg-[#d4a64a]" : "bg-red";
  return (
    <div className="relative h-[8px] w-full bg-bg rounded-full border border-border overflow-hidden">
      {/* tolerance band */}
      <div
        className="absolute top-0 bottom-0 bg-accent/15 border-x border-accent/35"
        style={{ left: `${bandLeft}%`, width: `${Math.max(0, bandRight - bandLeft)}%` }}
      />
      {/* target marker */}
      <div
        className="absolute top-[-2px] bottom-[-2px] w-[1.5px] bg-accent"
        style={{ left: `calc(${target}% - 0.75px)` }}
      />
      {/* actual dot */}
      <div
        className={clsx("absolute top-1/2 -translate-y-1/2 w-[10px] h-[10px] rounded-full border-2 border-panel", dotColor)}
        style={{ left: `calc(${dotLeft}% - 5px)` }}
      />
    </div>
  );
}

/**
 * Drift table — one row per arm with target %, actual %, actual IDR,
 * drift pp, drift bar, status pill, and a "View book" link.  Sorted
 * by abs(drift) desc so the arm that needs the most attention floats.
 */
export function AllocationDriftTable() {
  const { data, error, isLoading } = useSWR<AllocationResp>(
    "/api/capital/allocation",
    fetcher,
    { refreshInterval: 120_000 },
  );

  if (isLoading) {
    return <div className="text-[11.5px] text-muted py-4">Loading allocation…</div>;
  }
  if (error || !data) {
    return <div className="text-[11.5px] text-red py-4">Failed to load allocation.</div>;
  }

  const rows = [...data.rows].sort((a, b) => Math.abs(b.drift_pp) - Math.abs(a.drift_pp));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px] tabular-nums">
        <thead className="text-muted text-[10px] uppercase tracking-[0.14em] border-b border-border">
          <tr>
            <th className="text-left py-2">Arm</th>
            <th className="text-left">PM</th>
            <th className="text-right">Target</th>
            <th className="text-right">Actual</th>
            <th className="text-right">Drift (pp)</th>
            <th className="text-left pl-3 w-[240px]">Band · target ± {data.tolerance_pp}pp</th>
            <th className="text-right pr-1">NAV (IDR)</th>
            <th className="text-right">Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pill = statusPill(r.status);
            const driftSign =
              r.drift_pp > 0 ? "text-[#d4a64a]" : r.drift_pp < 0 ? "text-muted" : "text-fg";
            return (
              <tr key={r.slug} className="border-b border-border">
                <td className="py-[10px] font-medium text-fg">{r.title}</td>
                <td className="text-muted">{r.pm}</td>
                <td className="text-right text-fg">{r.target_pct.toFixed(1)}%</td>
                <td className="text-right text-fg">{r.actual_pct.toFixed(1)}%</td>
                <td className={clsx("text-right mono", driftSign)}>
                  {r.drift_pp > 0 ? "+" : ""}
                  {r.drift_pp.toFixed(1)}
                </td>
                <td className="pl-3">
                  <DriftBar
                    target={r.target_pct}
                    actual={r.actual_pct}
                    tolerance={data.tolerance_pp}
                    status={r.status}
                  />
                </td>
                <td className="text-right text-fg mono pr-1">
                  {fmtCurrency(r.actual_nav_idr, "IDR")}
                </td>
                <td className="text-right">
                  <span className={clsx("inline-block text-[9.5px] uppercase tracking-[0.14em] border rounded px-2 py-[2px]", pill.cls)}>
                    {pill.label}
                  </span>
                </td>
                <td className="text-right pl-3">
                  <Link
                    href={`/books/${r.slug}`}
                    prefetch
                    className="text-[10.5px] text-muted hover:text-accent uppercase tracking-wide"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 text-[10.5px] text-muted-2 leading-relaxed">
        Bands: within ±{data.tolerance_pp}pp = on target · {data.tolerance_pp}pp to{" "}
        {data.rebalance_pp}pp = drifting · beyond {data.rebalance_pp}pp = rebalance recommended.
        Actual % derived from most recent nav_history snapshot per arm (written nightly by the
        daily-snapshot cron).
      </div>
    </div>
  );
}
