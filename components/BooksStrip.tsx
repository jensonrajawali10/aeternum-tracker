"use client";

import Link from "next/link";
import useSWR from "swr";
import { fmtCurrency, fmtPct } from "@/lib/format";
import { DeltaNumber } from "./shell/DeltaNumber";
import { BOOKS } from "@/lib/books/meta";
import type { BookType } from "@/lib/types";

interface NavResp {
  nav_idr: number;
  gross_mv_idr: number;
  unrealized_pnl_idr: number;
  realized_ytd_idr: number;
}

interface MetricsResp {
  ytd_return_pct: number;
}

const fetcher = (u: string) => fetch(u).then((r) => r.json());

// Single rail colour for every book — the categorical hues read as
// noise at this density (3px rails on calm chrome). Going monochrome
// amber lets the titles differentiate the books and ties the strip
// into the brand accent already used elsewhere on the dashboard.
const BOOK_COLOR: Record<BookType, string> = {
  investing: "var(--color-accent)",
  idx_trading: "var(--color-accent)",
  crypto_trading: "var(--color-accent)",
  other: "var(--color-accent)",
};

function BookRow({
  slug,
  book,
  title,
  pm,
  budget,
}: {
  slug: string;
  book: BookType;
  title: string;
  pm: string;
  budget: number;
}) {
  const { data: nav } = useSWR<NavResp>(`/api/portfolio/nav?book=${book}`, fetcher, {
    refreshInterval: 60_000,
  });
  const { data: metrics } = useSWR<MetricsResp>(
    `/api/portfolio/metrics?book=${book}`,
    fetcher,
    { refreshInterval: 60_000 },
  );

  const navIdr = nav?.nav_idr ?? null;
  const unreal = nav?.unrealized_pnl_idr ?? null;
  const ytd = metrics?.ytd_return_pct ?? null;
  const isFlatBook = !!nav && nav.gross_mv_idr === 0 && Math.abs(nav.nav_idr) > 0;

  return (
    <Link
      href={`/books/${slug}`}
      prefetch
      className="group relative block bg-panel border border-border rounded-[6px] pl-4 pr-3 py-2.5 hover:border-border-2 transition-colors overflow-hidden"
    >
      {/* 3px coloured rail on the left edge — categorical book key */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0"
        style={{ width: 3, background: BOOK_COLOR[book] }}
      />

      <div className="flex items-center gap-3">
        {/* Name + meta — left column, takes whatever's left */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-medium text-fg tracking-[-0.01em] truncate">
              {title}
            </span>
            <span className="text-[10px] mono uppercase tracking-[0.10em] text-muted-2 shrink-0">
              {pm} · {budget}%
            </span>
          </div>
          {isFlatBook && (
            <div className="text-[9.5px] uppercase tracking-[0.12em] text-muted-2 mt-[1px]">
              realized only · no positions
            </div>
          )}
        </div>

        {/* NAV (right-aligned, mono) */}
        <div className="text-right shrink-0">
          <div className="mono text-[14px] text-fg tracking-[-0.01em] leading-none">
            {navIdr != null ? fmtCurrency(navIdr, "IDR") : "—"}
          </div>
          <div className="flex items-center justify-end gap-2 text-[10.5px] mt-1">
            <span className="text-muted-2 mono uppercase tracking-[0.10em]">YTD</span>
            {ytd != null ? (
              <DeltaNumber value={ytd} text={fmtPct(ytd, 1, true)} />
            ) : (
              <span className="mono text-muted-2">—</span>
            )}
            <span className="text-muted-2 mono uppercase tracking-[0.10em]">PnL</span>
            {unreal != null ? (
              <DeltaNumber value={unreal} text={fmtCurrency(unreal, "IDR")} />
            ) : (
              <span className="mono text-muted-2">—</span>
            )}
          </div>
        </div>

        <span
          aria-hidden
          className="text-[10px] text-muted-2 group-hover:text-accent-text transition-colors shrink-0"
        >
          →
        </span>
      </div>
    </Link>
  );
}

/**
 * Compact one-row-per-book strip on the Command Center.  Each row has a
 * 3px categorical rail (cyan/amber/magenta) on the left edge so the
 * book key is readable at a glance, name + PM/budget meta in the middle,
 * and NAV / YTD / unrealised P&L right-aligned in mono.  Replaces the
 * previous large square cards — same data per book, ~55% the vertical
 * footprint, much higher density.
 */
export function BooksStrip() {
  const books = Object.values(BOOKS);
  return (
    <div className="grid grid-cols-1 gap-2">
      {books.map((b) => (
        <BookRow
          key={b.slug}
          slug={b.slug}
          book={b.book}
          title={b.title}
          pm={b.pm}
          budget={b.risk_budget_pct}
        />
      ))}
    </div>
  );
}
