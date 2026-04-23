"use client";

import Link from "next/link";
import useSWR from "swr";
import { fmtCurrency, fmtPct, signClass, clsx } from "@/lib/format";
import { BOOKS } from "@/lib/books/meta";
import type { BookType } from "@/lib/types";

interface NavResp {
  nav_idr: number;
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
      <div className="mt-1 flex items-center gap-3 text-[11px]">
        <span className={clsx("mono", signClass(ytd))}>
          YTD {ytd != null ? fmtPct(ytd, 1, true) : "—"}
        </span>
        <span className={clsx("mono", signClass(unreal))}>
          Unreal {unreal != null ? fmtCurrency(unreal, "IDR") : "—"}
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
