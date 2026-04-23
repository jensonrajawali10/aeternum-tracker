"use client";

import type { ReactNode } from "react";
import { DensityToggle } from "./DensityToggle";

/**
 * Top-of-page header — the Level 1 typography block.  Page title at
 * 22px (was 18px) and an italic serif subtitle underneath; children
 * slot on the right holds per-page controls followed by the global
 * density toggle so it lives on every screen without page-level code.
 *
 * Typography hierarchy enforced in globals.css + this file:
 *   L1  Page title           22px medium, tight tracking
 *   L2  Section/Panel title  14px medium  (see components/Panel.tsx)
 *   L3  Card label           10.5px uppercase, tracking 0.14em
 *   L4  Body data            mono + tabular-nums
 */
export function TopHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="ae-topheader flex flex-wrap items-end justify-between gap-3 pb-4 border-b border-border mb-5">
      <div>
        <h1 className="ae-h1 text-[22px] font-medium tracking-[-0.015em] text-fg leading-tight">
          {title}
        </h1>
        {subtitle && (
          <div className="ae-h1-sub serif italic text-[13px] text-muted mt-[4px]">{subtitle}</div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <DensityToggle />
      </div>
    </div>
  );
}
