"use client";

import type { ReactNode } from "react";

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
    <div className="flex items-end justify-between pb-4 border-b border-border mb-5">
      <div>
        <h1 className="text-[18px] font-semibold tracking-wide text-fg">{title}</h1>
        {subtitle && <div className="text-[11px] text-muted tracking-wide mt-1">{subtitle}</div>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
