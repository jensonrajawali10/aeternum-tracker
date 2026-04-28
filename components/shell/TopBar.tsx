import Link from "next/link";
import { BrandMark } from "./BrandMark";
import { LiveClock } from "./LiveClock";
import { MarketStatePill } from "./MarketStatePill";
import { FxTicker } from "@/components/FxTicker";
import { DensityToggle } from "@/components/DensityToggle";

/**
 * Desktop TopBar — Bloomberg-style 36px strip.  Stays put across all
 * authenticated routes; persists density/currency/clock without
 * shifting page chrome on navigation.
 *
 * Layout (left -> right):
 *   BrandMark | ⌘K trigger (Phase 3 stub) | spacer | IDX | NYSE | CRYPTO
 *   pills | FX badge | density | clock
 *
 * The ⌘K button is a styled placeholder for now — wires into cmdk in
 * Phase 3.  Clicking it does nothing yet but is keyboard-tabbable so
 * the affordance is visible.
 */
export function TopBar() {
  return (
    <div
      className="hidden md:flex items-center gap-3 px-4 border-b"
      style={{
        height: 36,
        borderColor: "var(--color-border)",
        background: "var(--color-panel)",
      }}
    >
      <Link href="/dashboard" className="shrink-0" aria-label="Aeternum home">
        <BrandMark compact />
      </Link>

      <button
        type="button"
        className="hidden lg:flex items-center gap-2 px-2.5 h-[24px] rounded-[3px] border text-muted-2 hover:text-fg transition-colors"
        style={{
          borderColor: "var(--color-border-strong)",
          background: "var(--color-panel-2)",
          minWidth: 220,
        }}
        title="Command palette (⌘K) — wires up in Phase 3"
        aria-label="Open command palette"
        disabled
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
          <circle cx="4.5" cy="4.5" r="3.2" stroke="currentColor" strokeWidth="1" />
          <line x1="7" y1="7" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
        <span className="mono text-[10.5px] flex-1 text-left">Search · jump · trigger</span>
        <span
          className="mono text-[9.5px] px-1.5 py-[1px] rounded-[2px]"
          style={{
            background: "var(--color-bg)",
            border: "1px solid var(--color-border-strong)",
            color: "var(--color-muted)",
          }}
        >
          ⌘K
        </span>
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        <MarketStatePill market="IDX" />
        <MarketStatePill market="NYSE" />
        <MarketStatePill market="CRYPTO" />
      </div>

      <div className="flex items-center gap-2 pl-2 border-l" style={{ borderColor: "var(--color-border)" }}>
        <FxTicker from="USD" to="IDR" />
      </div>

      <div className="flex items-center gap-2 pl-2 border-l" style={{ borderColor: "var(--color-border)" }}>
        <DensityToggle />
      </div>

      <div className="flex items-center pl-2 border-l" style={{ borderColor: "var(--color-border)" }}>
        <LiveClock />
      </div>
    </div>
  );
}
