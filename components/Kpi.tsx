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
        "bg-panel border border-border rounded-[4px]",
        compact ? "px-3 py-2" : "px-4 py-3",
      )}
    >
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-[2px] text-[17px] font-semibold tabular-nums">{value}</div>
      <div className="mt-[2px] flex items-center gap-2 text-[11px] text-muted tabular-nums">
        {hint && <span>{hint}</span>}
        {delta && <span className={deltaClass}>{delta}</span>}
      </div>
    </div>
  );
}
