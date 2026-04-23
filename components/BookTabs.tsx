"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/format";

interface Tab {
  href: string;
  label: string;
}

/**
 * Pill-style secondary navigation for book workspaces (Overview ·
 * Performance · Risk · Trades · Notes).  Renders below the TopHeader
 * inside /books/[book]/layout.tsx.
 */
export function BookTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  // Overview is always the first tab — its href has the shortest segment
  // count (e.g. /books/investing). Use strict-equality for it; prefix match
  // for every other tab so nested routes stay lit.
  const overviewHref = tabs[0]?.href ?? "";
  return (
    <nav className="flex items-center gap-1 border-b border-border mb-4 overflow-x-auto">
      {tabs.map((t) => {
        const active =
          t.href === overviewHref
            ? pathname === t.href
            : pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            prefetch
            className={clsx(
              "relative px-3 py-2 text-[11.5px] tracking-wide transition-colors whitespace-nowrap",
              active
                ? "text-fg"
                : "text-muted hover:text-fg",
            )}
          >
            {t.label}
            {active && (
              <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-accent rounded-t" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
