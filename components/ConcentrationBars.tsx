"use client";

import Link from "next/link";
import { useMemo } from "react";
import useSWR from "swr";
import type { AssetClass } from "@/lib/types";
import { fmtPct } from "@/lib/format";

interface Position {
  ticker: string;
  asset_class: AssetClass;
  market_value_idr: number | null;
}

interface PositionsResp {
  positions: Position[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/* Categorical palette for the concentration rows. Order matches the
   terminal brief: cyan, amber, magenta, teal, yellow, purple, then a
   muted token for tail rows / "Rest". */
const ROW_COLORS = [
  "var(--color-cyan)",
  "var(--color-accent)",
  "var(--color-magenta)",
  "var(--color-teal)",
  "var(--color-yellow)",
  "var(--color-purple)",
];
const TAIL_COLOR = "var(--color-muted-2)";

interface Row {
  label: string;
  pct: number;
  color: string;
}

/**
 * Concentration bars — replaces SectorDoughnut with a denser horizontal-
 * bar list of the top 7 holdings + a "Rest" row.
 *
 * Layout per row:
 *   [ticker · mono]  [bar · h-[10px], coloured fill on bg-panel-2 track]  [pct · mono right]
 *
 * Single-holding edge case (e.g. crypto book sitting 100% in USDC) renders
 * the single bar plus an inline amber CTA reminding the operator that
 * 100% in one name is 0 diversification.  Zero-holdings renders the CTA
 * banner alone.
 */
export function ConcentrationBars({
  book = "all",
}: {
  book?: string;
}) {
  const bookParam = book === "all" ? "" : `?book=${book}`;
  const { data, isLoading } = useSWR<PositionsResp>(
    `/api/positions${bookParam}`,
    fetcher,
    { refreshInterval: 60_000, keepPreviousData: true },
  );

  const rows: Row[] = useMemo(() => {
    const positions = data?.positions || [];
    const tickerMap = new Map<string, number>();
    for (const p of positions) {
      const mv = Math.abs(p.market_value_idr || 0);
      tickerMap.set(p.ticker, (tickerMap.get(p.ticker) || 0) + mv);
    }
    const total = [...tickerMap.values()].reduce((a, v) => a + v, 0);
    if (total <= 0) return [];
    const sorted = [...tickerMap.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 7);
    const restValue = sorted.slice(7).reduce((a, [, v]) => a + v, 0);

    const out: Row[] = top.map(([ticker, value], i) => ({
      label: ticker,
      pct: (value / total) * 100,
      color: ROW_COLORS[i] ?? TAIL_COLOR,
    }));
    if (restValue > 0) {
      out.push({
        label: "Rest",
        pct: (restValue / total) * 100,
        color: TAIL_COLOR,
      });
    }
    return out;
  }, [data]);

  const positions = data?.positions || [];
  const totalMv = positions.reduce(
    (a, p) => a + Math.abs(p.market_value_idr || 0),
    0,
  );

  // Single-holding case: just one bar with 100% weight.  Whole-book
  // concentration is itself the story, so we still render the single
  // bar AND a CTA reminding the operator that 1-name = 0 diversification.
  const singleHolding = rows.length === 1 && Math.abs(rows[0].pct - 100) < 0.01;
  const empty = !isLoading && rows.length === 0;

  if (isLoading && !data) {
    // Skeleton — 7 rows of placeholder bars so the section reserves its
    // vertical real estate before data arrives.
    return (
      <div className="space-y-[6px]">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 h-[16px]"
          >
            <span className="skel h-[10px] w-[60px] block" />
            <span className="skel h-[10px] flex-1 block" />
            <span className="skel h-[10px] w-[40px] block" />
          </div>
        ))}
      </div>
    );
  }

  if (empty) {
    return <CashDeployBanner />;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-[6px]">
        {rows.map((r) => (
          <BarRow key={r.label} row={r} />
        ))}
      </div>
      {singleHolding && <CashDeployBanner singleTicker={rows[0].label} />}
      {!singleHolding && totalMv > 0 && (
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-2 pt-1">
          {rows.length} row{rows.length === 1 ? "" : "s"} · weight by abs
          market value
        </div>
      )}
    </div>
  );
}

function BarRow({ row }: { row: Row }) {
  const widthPct = Math.max(2, Math.min(100, row.pct));
  return (
    <div className="flex items-center gap-3">
      <span
        className="mono text-[11px] text-fg"
        style={{ width: 72, flexShrink: 0 }}
      >
        {row.label}
      </span>
      <div
        className="flex-1 h-[10px] rounded-[2px] overflow-hidden"
        style={{ background: "var(--color-panel-2)" }}
      >
        <div
          className="h-full rounded-[2px]"
          style={{
            width: `${widthPct}%`,
            background: row.color,
            opacity: 0.9,
          }}
        />
      </div>
      <span
        className="mono text-[11px] text-fg text-right tabular-nums"
        style={{ width: 44, flexShrink: 0 }}
      >
        {fmtPct(row.pct, 1)}
      </span>
    </div>
  );
}

function CashDeployBanner({ singleTicker }: { singleTicker?: string }) {
  return (
    <div
      className="rounded-[6px] border px-3 py-3"
      style={{
        borderColor: "color-mix(in srgb, var(--color-accent) 30%, transparent)",
        background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
      }}
    >
      <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-amber">
        Cash deploy needed
      </div>
      <div className="text-[11.5px] text-muted leading-relaxed mt-1">
        {singleTicker ? (
          <>
            100% sitting in <span className="mono text-fg">{singleTicker}</span>
            {" "}— that&apos;s zero diversification across the book.
          </>
        ) : (
          <>No open positions in this book.</>
        )}{" "}
        Add a candidate via{" "}
        <Link href="/watchlist" className="text-amber hover:underline">
          /watchlist
        </Link>{" "}
        or write up an idea on{" "}
        <Link href="/memos" className="text-amber hover:underline">
          /memos
        </Link>
        .
      </div>
    </div>
  );
}
