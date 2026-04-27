"use client";

import type { ReactNode } from "react";
import { clsx } from "@/lib/format";

export function Kpi({
  label,
  value,
  hint,
  delta,
  deltaClass,
  trend,
  compact = false,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: string;
  deltaClass?: string;
  /** Optional sparkline / trend element rendered top-right of the tile.  Pass
      a Sparkline or any inline SVG; the tile reserves space for it so layout
      stays steady whether or not a trend is provided. */
  trend?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={clsx(
        "bg-panel border border-border rounded-[10px] transition-colors hover:border-border-2",
        compact ? "px-3 py-3" : "px-4 py-[14px]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] text-muted">{label}</div>
        {trend && <div className="opacity-90">{trend}</div>}
      </div>
      <div className="mono mt-[4px] text-[20px] font-medium text-fg leading-tight tracking-[-0.01em]">
        {value}
      </div>
      <div className="mt-[3px] flex items-center gap-2 text-[11px] text-muted">
        {hint && <span className="mono">{hint}</span>}
        {delta && <span className={clsx("mono font-medium", deltaClass)}>{delta}</span>}
      </div>
    </div>
  );
}
