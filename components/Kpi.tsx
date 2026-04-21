"use client";

import { clsx } from "@/lib/format";

export function Kpi({
  label,
  value,
  hint,
  delta,
  deltaClass,
  compact = false,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: string;
  deltaClass?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={clsx(
        "bg-panel border border-border rounded-[10px] transition-colors hover:border-border-2",
        compact ? "px-3 py-3" : "px-4 py-[14px]",
      )}
    >
      <div className="text-[11px] text-muted">{label}</div>
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
