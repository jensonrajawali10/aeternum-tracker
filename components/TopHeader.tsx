"use client";

import type { ReactNode } from "react";
import { DensityToggle } from "./DensityToggle";

/**
 * Top-of-page header — the Level 1 typography block.
 *
 * `step` (optional) renders a hyperlane-style "01 / SECTION" label
 * above the page title with an accent dot leading.  Use it on the
 * primary firm pages (00 Command Center, 01 Capital, 02 Risk, 03
 * Journal, 04 Memos) to give the dashboard a consistent numbered
 * spine.
 *
 * Page title sizes up to 24px (was 22) for hyperlane-ish heroic
 * scale; serif italic subtitle stays for editorial voice.  Children
 * slot on the right holds per-page controls followed by the global
 * density toggle so it lives on every screen without page-level code.
 *
 * Typography hierarchy enforced in globals.css + this file:
 *   L0  Step label             10.5px mono uppercase, accent dot
 *   L1  Page title             24px medium, tight tracking
 *   L2  Section/Panel title    14px medium  (see components/Panel.tsx)
 *   L3  Card label             10.5px uppercase, tracking 0.14em
 *   L4  Body data              mono + tabular-nums
 */
export function TopHeader({
  step,
  stepLabel,
  title,
  subtitle,
  children,
}: {
  step?: string;
  stepLabel?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="ae-topheader flex flex-wrap items-end justify-between gap-3 pb-4 border-b border-border mb-5">
      <div>
        {(step || stepLabel) && (
          <div className="ae-step-label mb-2">
            {step && <span className="ae-step-num">{step}</span>}
            {stepLabel && <span>{stepLabel}</span>}
          </div>
        )}
        <h1 className="ae-h1 text-[24px] font-medium tracking-[-0.02em] text-fg leading-[1.1]">
          {title}
        </h1>
        {subtitle && (
          <div className="ae-h1-sub serif italic text-[13.5px] text-muted mt-[6px]">
            {subtitle}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <DensityToggle />
      </div>
    </div>
  );
}
