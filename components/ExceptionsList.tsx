"use client";

import useSWR from "swr";
import { fmtPct, fmtCurrency } from "@/lib/format";
import { DeltaNumber } from "./shell/DeltaNumber";

interface Position {
  ticker: string;
  stop_loss: number | null;
  live_price: number | null;
  unrealized_pnl_pct: number | null;
  unrealized_pnl_idr: number | null;
  market_value_idr: number | null;
}

interface PositionsResp {
  positions: Position[];
}

const fetcher = (u: string) => fetch(u).then((r) => r.json());

/**
 * Exceptions list — the "check on this" feed.  Three categories today:
 *
 *   · Stale marks — positions whose live quote failed to fetch
 *   · No stop on file — open positions with no stop_loss
 *   · Deep drawdown — positions down more than 10% unrealised
 *
 * Future: drawdown vs stop distance, time since last sheet edit, alerts
 * that fired but weren't acknowledged.
 */
export function ExceptionsList() {
  const { data } = useSWR<PositionsResp>("/api/positions", fetcher, {
    refreshInterval: 60_000,
  });
  const positions = data?.positions ?? [];

  const stale = positions.filter((p) => p.live_price == null);
  const noStop = positions.filter((p) => p.stop_loss == null && p.live_price != null);
  const deepDrawdown = positions.filter(
    (p) => p.unrealized_pnl_pct != null && p.unrealized_pnl_pct < -10,
  );

  const hasAny = stale.length || noStop.length || deepDrawdown.length;

  if (!positions.length) {
    return <div className="text-[11.5px] text-muted py-4">No positions to check.</div>;
  }
  if (!hasAny) {
    return (
      <div className="text-[11.5px] text-muted py-4">
        All clear — no stale marks, no missing stops, no drawdowns past 10%.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stale.length > 0 && (
        <Section
          label={`Stale marks (${stale.length})`}
          hint="Live quote unavailable — falling back to entry price"
          items={stale.map((p) => ({ ticker: p.ticker, right: "stale" }))}
        />
      )}
      {noStop.length > 0 && (
        <Section
          label={`No stop on file (${noStop.length})`}
          hint="Open position with stop_loss = null"
          items={noStop.map((p) => ({ ticker: p.ticker, right: "no stop" }))}
        />
      )}
      {deepDrawdown.length > 0 && (
        <Section
          label={`Drawdown > 10% (${deepDrawdown.length})`}
          hint="Unrealised P&L deeper than −10% of entry"
          items={deepDrawdown.map((p) => ({
            ticker: p.ticker,
            right: (
              <span className="flex items-center gap-2">
                <DeltaNumber
                  value={p.unrealized_pnl_pct}
                  text={fmtPct(p.unrealized_pnl_pct, 1, true)}
                />
                {p.unrealized_pnl_idr != null && (
                  <DeltaNumber
                    value={p.unrealized_pnl_idr}
                    text={fmtCurrency(p.unrealized_pnl_idr, "IDR")}
                    className="text-[10px]"
                  />
                )}
              </span>
            ),
          }))}
        />
      )}
    </div>
  );
}

function Section({
  label,
  hint,
  items,
}: {
  label: string;
  hint: string;
  items: { ticker: string; right: React.ReactNode }[];
}) {
  return (
    <div>
      <div className="text-[10px] text-muted-2 uppercase tracking-[0.14em]">{label}</div>
      <div className="text-[10.5px] text-muted mb-1">{hint}</div>
      <div className="divide-y divide-border">
        {items.map((it, i) => (
          <div
            key={`${it.ticker}-${i}`}
            className="flex items-center justify-between py-[6px] text-[11.5px]"
          >
            <span className="font-semibold text-fg">{it.ticker}</span>
            <span className="text-muted mono">{it.right}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
