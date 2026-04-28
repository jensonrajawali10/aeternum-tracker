"use client";

import useSWR from "swr";
import Link from "next/link";
import { fmtPct, fmtCurrency } from "@/lib/format";
import { DeltaNumber } from "./shell/DeltaNumber";
import type { AssetClass } from "@/lib/types";

interface Position {
  ticker: string;
  asset_class: AssetClass;
  day_change_pct: number | null;
  unrealized_pnl_idr: number | null;
  market_value_idr: number | null;
}

interface PositionsResp {
  positions: Position[];
}

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function Row({
  p,
  rank,
}: {
  p: Position;
  rank: number;
}) {
  return (
    <div className="flex items-center justify-between py-[6px] px-1 text-[11.5px] tabular-nums">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-muted-2 text-[10px] w-[14px]">{rank}</span>
        <span className="font-semibold text-fg truncate">{p.ticker}</span>
        <span className="text-muted-2 text-[10px] uppercase tracking-wide">
          {p.asset_class}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {p.day_change_pct != null ? (
          <DeltaNumber
            value={p.day_change_pct}
            text={fmtPct(p.day_change_pct, 2, true)}
          />
        ) : (
          <span className="mono text-muted-2">—</span>
        )}
        {p.unrealized_pnl_idr != null ? (
          <DeltaNumber
            value={p.unrealized_pnl_idr}
            text={fmtCurrency(p.unrealized_pnl_idr, "IDR")}
            className="text-[10.5px]"
          />
        ) : (
          <span className="mono text-[10.5px] text-muted-2">—</span>
        )}
      </div>
    </div>
  );
}

/**
 * Top / bottom movers by 1D price change across all open positions —
 * surfaces the book's biggest noisemakers today without scrolling through
 * the full positions table.
 */
export function MoversList() {
  const { data } = useSWR<PositionsResp>("/api/positions", fetcher, {
    refreshInterval: 60_000,
  });
  const positions = (data?.positions ?? []).filter((p) => p.day_change_pct != null);
  const sorted = [...positions].sort(
    (a, b) => (b.day_change_pct ?? 0) - (a.day_change_pct ?? 0),
  );
  const gainers = sorted.slice(0, 5);
  const losers = sorted.slice(-5).reverse();

  if (!positions.length) {
    return (
      <div className="text-[11.5px] text-muted py-4">
        No price-change data available yet.{" "}
        <Link href="/settings" className="text-accent hover:underline">
          Sync sheets
        </Link>{" "}
        to pick up open positions.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <div className="text-[10px] text-muted-2 uppercase tracking-[0.14em] mb-1">
          Top gainers (1D)
        </div>
        <div className="divide-y divide-border">
          {gainers.map((p, i) => (
            <Row key={p.ticker} p={p} rank={i + 1} />
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] text-muted-2 uppercase tracking-[0.14em] mb-1">
          Top losers (1D)
        </div>
        <div className="divide-y divide-border">
          {losers.map((p, i) => (
            <Row key={p.ticker} p={p} rank={i + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}
