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
    <div className="flex flex-wrap items-end justify-between gap-3 pb-4 border-b border-border mb-5">
      <div>
        <h1 className="text-[18px] font-medium tracking-[-0.01em] text-fg leading-tight">
          {title}
        </h1>
        {subtitle && (
          <div className="serif italic text-[13px] text-muted mt-[3px]">{subtitle}</div>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}
