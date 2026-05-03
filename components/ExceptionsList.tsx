"use client";

import useSWR from "swr";
import { fmtPct, fmtCurrency, clsx } from "@/lib/format";
import { DeltaNumber } from "./shell/DeltaNumber";

interface Position {
  ticker: string;
  qty?: number;
  stop_loss: number | null;
  take_profit?: number | null;
  live_price: number | null;
  avg_entry?: number;
  unrealized_pnl_pct: number | null;
  unrealized_pnl_idr: number | null;
  market_value_idr: number | null;
}

interface PositionsResp {
  positions: Position[];
}

const fetcher = (u: string) => fetch(u).then((r) => r.json());

// G3 stop / TP proximity — distance from current price to the configured
// trigger as a % of live price.  Long positions: stop is below price (so
// distance = (price - stop) / price), TP is above (distance = (tp - price)
// / price).  Short positions invert.  qty < 0 = short on this codebase.
function pctTo(live: number, level: number, isShort: boolean, dir: "stop" | "tp"): number {
  if (live <= 0) return Number.POSITIVE_INFINITY;
  // For longs: stop below (price - stop), TP above (tp - price).
  // For shorts: stop above (stop - price), TP below (price - tp).
  const diff =
    dir === "stop"
      ? isShort
        ? level - live
        : live - level
      : isShort
        ? live - level
        : level - live;
  return (diff / live) * 100;
}

/**
 * Exceptions list — the "check on this" feed.  Five categories now:
 *
 *   · Stop proximity — live price ≤5% from configured stop_loss
 *   · TP proximity   — live price ≤5% from configured take_profit (or hit)
 *   · Stale marks    — positions whose live quote failed to fetch
 *   · No stop on file — open positions with no stop_loss
 *   · Deep drawdown   — positions down more than 10% unrealised
 *
 * Stop / TP proximity is the G3 audit ask -- the columns existed in the
 * trades schema but nothing on the UI surfaced them.  Concentrated PM
 * discipline lives or dies on knowing how far you are from your stop.
 */
export function ExceptionsList() {
  const { data } = useSWR<PositionsResp>("/api/positions", fetcher, {
    refreshInterval: 60_000,
  });
  const positions = data?.positions ?? [];

  // G3: derive stop/TP proximity from live_price + stop_loss + take_profit.
  // Threshold = 5% in either direction.  Sort by proximity (smallest pct
  // first) so the closest-to-trigger names sit on top.
  const PROX_PCT = 5;
  const stopProx: { ticker: string; pct: number; live: number; stop: number }[] = [];
  const tpProx: { ticker: string; pct: number; live: number; tp: number; hit: boolean }[] = [];
  for (const p of positions) {
    const isShort = (p.qty ?? 0) < 0;
    if (p.live_price != null && p.stop_loss != null && p.live_price > 0 && p.stop_loss > 0) {
      const pct = pctTo(p.live_price, p.stop_loss, isShort, "stop");
      // Only flag proximity when the price is APPROACHING the stop -- a
      // negative pct means price already crossed it (very urgent).
      if (pct <= PROX_PCT) {
        stopProx.push({ ticker: p.ticker, pct, live: p.live_price, stop: p.stop_loss });
      }
    }
    if (p.live_price != null && p.take_profit != null && p.live_price > 0 && p.take_profit > 0) {
      const pct = pctTo(p.live_price, p.take_profit, isShort, "tp");
      // pct < 0 means price has already moved past TP (TP hit).
      if (pct <= PROX_PCT) {
        tpProx.push({
          ticker: p.ticker,
          pct,
          live: p.live_price,
          tp: p.take_profit,
          hit: pct < 0,
        });
      }
    }
  }
  stopProx.sort((a, b) => a.pct - b.pct);
  tpProx.sort((a, b) => a.pct - b.pct);

  const stale = positions.filter((p) => p.live_price == null);
  const noStop = positions.filter((p) => p.stop_loss == null && p.live_price != null);
  const deepDrawdown = positions.filter(
    (p) => p.unrealized_pnl_pct != null && p.unrealized_pnl_pct < -10,
  );

  const hasAny =
    stopProx.length || tpProx.length || stale.length || noStop.length || deepDrawdown.length;

  if (!positions.length) {
    return <div className="text-[11.5px] text-muted py-4">No positions to check.</div>;
  }
  if (!hasAny) {
    return (
      <div className="text-[11.5px] text-muted py-4">
        All clear — no stops within 5%, no TPs nearby, no stale marks, no missing
        stops, no drawdowns past 10%.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stopProx.length > 0 && (
        <Section
          label={`Stop proximity (${stopProx.length})`}
          hint="Within 5% of configured stop_loss — concentrated-PM discipline"
          items={stopProx.map((s) => ({
            ticker: s.ticker,
            right: (
              <span className="flex items-center gap-2">
                <span
                  className={clsx(
                    "mono",
                    s.pct <= 0 ? "text-down" : s.pct <= 2 ? "text-down" : "text-amber",
                  )}
                >
                  {s.pct <= 0 ? "▼ stop hit" : `▼ ${s.pct.toFixed(2)}% to stop`}
                </span>
                <span className="text-muted-2 mono text-[10px]">
                  · live {s.live.toLocaleString()} · stop {s.stop.toLocaleString()}
                </span>
              </span>
            ),
          }))}
        />
      )}
      {tpProx.length > 0 && (
        <Section
          label={`TP proximity (${tpProx.length})`}
          hint="Within 5% of configured take_profit — review whether to scale or move stop"
          items={tpProx.map((t) => ({
            ticker: t.ticker,
            right: (
              <span className="flex items-center gap-2">
                <span className={clsx("mono", t.hit ? "text-up" : "text-amber")}>
                  {t.hit ? "▲ TP hit" : `▲ ${t.pct.toFixed(2)}% to TP`}
                </span>
                <span className="text-muted-2 mono text-[10px]">
                  · live {t.live.toLocaleString()} · TP {t.tp.toLocaleString()}
                </span>
              </span>
            ),
          }))}
        />
      )}
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
