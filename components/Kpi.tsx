"use client";

import type { ReactNode } from "react";
import { clsx } from "@/lib/format";
import { Sparkline } from "./Sparkline";

export function Kpi({
  label,
  value,
  hint,
  delta,
  deltaClass,
  trend,
  sparkline,
  compact = false,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  delta?: ReactNode;
  deltaClass?: string;
  /** Legacy slot — small inline element rendered top-right of the tile.
      Still honoured for back-compat with callers that haven't migrated. */
  trend?: ReactNode;
  /** Preferred slot — pass a values array and the sparkline renders as a
      full-width strip across the bottom of the tile. */
  sparkline?: (number | null | undefined)[];
  compact?: boolean;
}) {
  return (
    <div
      className={clsx(
        "bg-panel border border-border rounded-[10px] flex flex-col transition-colors hover:border-border-2 overflow-hidden",
      )}
    >
      <div className={clsx("flex-1", compact ? "px-3 py-3" : "px-4 py-3")}>
        <div className="flex items-start justify-between gap-2">
          <div className="text-[11px] text-muted">{label}</div>
          {/* Legacy top-right trend slot — only shown when no bottom-strip
              sparkline was provided, so callers can opt into one or the
              other without doubling up. */}
          {trend && !sparkline && <div className="opacity-90">{trend}</div>}
        </div>
        <div className="mono mt-[4px] text-[20px] font-medium text-fg leading-tight tracking-[-0.01em]">
          {value}
        </div>
        <div className="mt-[3px] flex items-center gap-2 text-[11px] text-muted">
          {hint && <span className="mono">{hint}</span>}
          {delta && <span className={clsx("mono font-medium", deltaClass)}>{delta}</span>}
        </div>
      </div>
      {sparkline && (
        <div
          className="border-t border-border"
          style={{ background: "var(--color-bg)" }}
        >
          <Sparkline values={sparkline} height={22} />
        </div>
      )}
    </div>
  );
}
