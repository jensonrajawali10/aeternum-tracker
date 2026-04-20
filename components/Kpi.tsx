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
        "panel-gradient panel-elev border border-border rounded-[6px] transition-colors hover:border-border-2",
        compact ? "px-3 py-2" : "px-4 py-[14px]",
      )}
    >
      <div className="text-[9.5px] uppercase tracking-[0.18em] text-muted font-medium">
        {label}
      </div>
      <div className="mt-[4px] text-[20px] font-semibold tabular-nums leading-tight tracking-tight">
        {value}
      </div>
      <div className="mt-[3px] flex items-center gap-2 text-[10.5px] text-muted tabular-nums">
        {hint && <span>{hint}</span>}
        {delta && <span className={clsx("font-medium", deltaClass)}>{delta}</span>}
      </div>
    </div>
  );
}
