"use client";

import { useState } from "react";
import useSWR from "swr";
import { fmtCurrency, clsx } from "@/lib/format";
import { RebalanceDialog, type DriftRow } from "./RebalanceDialog";

interface AllocationResp {
  firm_nav_idr: number;
  firm_nav_usd: number;
  usd_idr: number;
  rows: DriftRow[];
  tolerance_pp: number;
  rebalance_pp: number;
  last_rebalance_at: string | null;
}

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function formatLastRebalance(iso: string | null): string {
  if (!iso) return "No rebalance on file";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(d);
  } catch {
    return iso;
  }
}

/**
 * Top-of-page summary strip — firm NAV in both currencies, drift status
 * headline (on-target across all arms, or N arms drifting, or N arms
 * needing rebalance), most recent rebalance date, and the primary
 * "Record rebalance" CTA that opens the decision-log dialog.
 */
export function CapitalSummary() {
  const { data } = useSWR<AllocationResp>("/api/capital/allocation", fetcher, {
    refreshInterval: 120_000,
  });
  const [dialogOpen, setDialogOpen] = useState(false);

  const rebalanceCount = data?.rows.filter((r) => r.status === "rebalance").length ?? 0;
  const driftingCount = data?.rows.filter((r) => r.status === "drifting").length ?? 0;
  const onTargetCount = data?.rows.filter((r) => r.status === "on_target").length ?? 0;

  const headline =
    rebalanceCount > 0
      ? {
          text: `${rebalanceCount} arm${rebalanceCount > 1 ? "s" : ""} outside band — rebalance recommended`,
          tone: "text-red",
        }
      : driftingCount > 0
        ? {
            text: `${driftingCount} arm${driftingCount > 1 ? "s" : ""} drifting — inside band but worth a look`,
            tone: "text-[#d4a64a]",
          }
        : {
            text: `${onTargetCount} arm${onTargetCount > 1 ? "s" : ""} on target`,
            tone: "text-green",
          };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr] gap-3">
        <div className="bg-panel border border-border rounded-[10px] p-4">
          <div className="text-[9.5px] uppercase tracking-[0.14em] text-muted-2 mb-1">Firm NAV</div>
          <div className="mono text-[22px] text-fg tracking-[-0.01em] leading-tight">
            {data ? fmtCurrency(data.firm_nav_idr, "IDR") : "—"}
          </div>
          <div className="mono text-[11px] text-muted mt-1">
            {data ? fmtCurrency(data.firm_nav_usd, "USD") : "—"}
            {data && (
              <span className="ml-2 text-muted-2">
                · USD/IDR {Math.round(data.usd_idr).toLocaleString("en-US")}
              </span>
            )}
          </div>
        </div>
        <div className="bg-panel border border-border rounded-[10px] p-4">
          <div className="text-[9.5px] uppercase tracking-[0.14em] text-muted-2 mb-1">Drift status</div>
          <div className={clsx("text-[13px] font-medium leading-snug", headline.tone)}>
            {data ? headline.text : "—"}
          </div>
          <div className="mt-2 flex gap-3 text-[10.5px]">
            <span className="text-green">● {onTargetCount} on target</span>
            <span className="text-[#d4a64a]">● {driftingCount} drifting</span>
            <span className="text-red">● {rebalanceCount} rebalance</span>
          </div>
        </div>
        <div className="bg-panel border border-border rounded-[10px] p-4 flex flex-col">
          <div className="text-[9.5px] uppercase tracking-[0.14em] text-muted-2 mb-1">Last rebalance</div>
          <div className="text-[13px] font-medium text-fg">
            {formatLastRebalance(data?.last_rebalance_at ?? null)}
          </div>
          <div className="text-[10.5px] text-muted-2 mt-1 leading-relaxed">
            Writes a dated entry to the capital journal. Execution still happens in sheets /
            broker portals.
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            disabled={!data}
            className="mt-2 self-start bg-accent text-bg hover:bg-accent/90 px-3 py-[6px] rounded text-[10.5px] font-semibold uppercase tracking-[0.12em] disabled:opacity-60"
          >
            Record rebalance
          </button>
        </div>
      </div>
      {data && dialogOpen && (
        <RebalanceDialog
          onClose={() => setDialogOpen(false)}
          firmNavIdr={data.firm_nav_idr}
          rows={data.rows}
        />
      )}
    </>
  );
}
