"use client";

import useSWR from "swr";
import { fmtCurrency, clsx } from "@/lib/format";

type DriftStatus = "on_target" | "drifting" | "rebalance";

interface AllocationRow {
  slug: string;
  status: DriftStatus;
  drift_pp: number;
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

/**
 * Top-of-page summary strip — firm NAV in both currencies, drift status
 * headline (on-target across all arms, or N arms drifting, or N arms
 * needing rebalance), and the most recent rebalance date.
 */
export function CapitalSummary() {
  const { data } = useSWR<AllocationResp>("/api/capital/allocation", fetcher, {
    refreshInterval: 120_000,
  });

  const rebalanceCount = data?.rows.filter((r) => r.status === "rebalance").length ?? 0;
  const driftingCount = data?.rows.filter((r) => r.status === "drifting").length ?? 0;
  const onTargetCount = data?.rows.filter((r) => r.status === "on_target").length ?? 0;

  const headline =
    rebalanceCount > 0
      ? { text: `${rebalanceCount} arm${rebalanceCount > 1 ? "s" : ""} outside band — rebalance recommended`, tone: "text-red" }
      : driftingCount > 0
        ? { text: `${driftingCount} arm${driftingCount > 1 ? "s" : ""} drifting — inside band but worth a look`, tone: "text-[#d4a64a]" }
        : { text: `${onTargetCount} arm${onTargetCount > 1 ? "s" : ""} on target`, tone: "text-green" };

  return (
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
      <div className="bg-panel border border-border rounded-[10px] p-4">
        <div className="text-[9.5px] uppercase tracking-[0.14em] text-muted-2 mb-1">Last rebalance</div>
        <div className="text-[13px] font-medium text-fg">
          {data?.last_rebalance_at ?? "No rebalance on file"}
        </div>
        <div className="text-[10.5px] text-muted-2 mt-1 leading-relaxed">
          Rebalance actions write a dated entry to the capital journal (coming in the
          next iteration). Until then, intents stay in Notion / your head.
        </div>
      </div>
    </div>
  );
}
