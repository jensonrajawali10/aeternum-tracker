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

function BookCard({
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
  const { data: metrics } = useSWR<MetricsResp>(`/api/portfolio/metrics?book=${book}`, fetcher, {
    refreshInterval: 60_000,
  });

  const navIdr = nav?.nav_idr ?? null;
  const unreal = nav?.unrealized_pnl_idr ?? null;
  const ytd = metrics?.ytd_return_pct ?? null;
  // Flat book = cumulative realized P&L only (no open positions to mark).
  // Signal this on the card so the headline number reads honestly.
  const isFlatBook = !!nav && nav.gross_mv_idr === 0 && Math.abs(nav.nav_idr) > 0;

  return (
    <Link
      href={`/books/${slug}`}
      prefetch
      className="group block bg-panel border border-border rounded-[10px] px-4 py-3 hover:border-accent/60 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[13px] font-medium text-fg tracking-[-0.01em]">{title}</div>
          <div className="text-[10.5px] text-muted-2 mt-[1px]">
            {pm} · {budget}% target
          </div>
        </div>
        <span className="text-[10px] text-muted group-hover:text-accent transition-colors">
          →
        </span>
      </div>
      <div className="mt-3 text-[17px] mono text-fg tracking-[-0.01em]">
        {navIdr != null ? fmtCurrency(navIdr, "IDR") : "—"}
      </div>
      {isFlatBook && (
        <div className="mt-[2px] text-[9.5px] uppercase tracking-[0.12em] text-muted-2">
          realized only · no open positions
        </div>
      )}
      <div className="mt-1 flex items-center gap-3 text-[11px]">
        <span className="flex items-center gap-1">
          <span className="text-muted-2 mono">YTD</span>
          {ytd != null ? (
            <DeltaNumber value={ytd} text={fmtPct(ytd, 1, true)} />
          ) : (
            <span className="mono text-muted-2">—</span>
          )}
        </span>
        <span className="flex items-center gap-1">
          <span className="text-muted-2 mono">Unreal</span>
          {unreal != null ? (
            <DeltaNumber value={unreal} text={fmtCurrency(unreal, "IDR")} />
          ) : (
            <span className="mono text-muted-2">—</span>
          )}
        </span>
      </div>
    </Link>
  );
}

/**
 * Three mini-cards representing each trading arm.  Sits beneath the firm
 * KPI row on the Command Center dashboard so Jenson sees how each book is
 * contributing in one glance, and can click through to the arm workspace.
 */
export function BooksStrip() {
  const books = Object.values(BOOKS);
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {books.map((b) => (
        <BookCard
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
