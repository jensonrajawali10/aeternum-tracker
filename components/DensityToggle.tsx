"use client";

import { useDensity } from "./DensityProvider";
import { clsx } from "@/lib/format";

/**
 * Two-pill density toggle — Comfortable / Compact.  Lives in the
 * TopHeader next to CurrencyToggle so Jenson can flip density per
 * session.  Preference persists in localStorage via DensityProvider.
 */
export function DensityToggle() {
  const { density, setDensity } = useDensity();
  return (
    <div className="inline-flex items-center border border-border rounded overflow-hidden bg-panel-2">
      <button
        type="button"
        onClick={() => setDensity("comfortable")}
        className={clsx(
          "px-2 py-[4px] text-[10px] uppercase tracking-[0.12em] transition-colors",
          density === "comfortable"
            ? "bg-elevated text-fg"
            : "text-muted hover:text-fg",
        )}
        aria-pressed={density === "comfortable"}
        title="Comfortable density"
      >
        Roomy
      </button>
      <button
        type="button"
        onClick={() => setDensity("compact")}
        className={clsx(
          "px-2 py-[4px] text-[10px] uppercase tracking-[0.12em] transition-colors border-l border-border",
          density === "compact"
            ? "bg-elevated text-fg"
            : "text-muted hover:text-fg",
        )}
        aria-pressed={density === "compact"}
        title="Compact density"
      >
        Compact
      </button>
    </div>
  );
}
