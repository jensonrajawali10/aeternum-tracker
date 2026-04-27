"use client";

import useSWR from "swr";
import { fmtCurrency, fmtPct, signClass, clsx } from "@/lib/format";

interface Position {
  ticker: string;
  day_change_pct: number | null;
  market_value_idr: number | null;
}

interface PositionsResp {
  positions: Position[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Top movers panel — three stat cells matching the PortfolioPulse-style
 * "performance card" pattern, but adapted for Aeternum's live-data world:
 *
 *   Day P&L       — sum across positions of MV_idr × day_change_pct÷100
 *   Best today    — single position with the highest day_change_pct
 *   Worst today   — single position with the lowest day_change_pct
 *
 * Computed entirely client-side from the existing /api/positions feed
 * (already polled every 30s by PositionsTable on the same page) so we
 * don't add a new endpoint or duplicate the HL/FX/quote enrichment.
 *
 * Positions where day_change_pct is null (e.g. HL perps, illiquid IDX
 * names) are excluded from the calc — the live-count chip surfaces how
 * many of the open positions actually contributed.
 */
export function TopMovers({ book = "all" }: { book?: string }) {
  const bookParam = book === "all" ? "" : `?book=${book}`;
  const { data, isLoading } = useSWR<PositionsResp>(
    `/api/positions${bookParam}`,
    fetcher,
    { refreshInterval: 30_000, keepPreviousData: true },
  );

  const live = (data?.positions ?? []).filter(
    (p) => p.day_change_pct != null && p.market_value_idr != null,
  );

  const sorted = [...live].sort(
    (a, b) => (b.day_change_pct ?? 0) - (a.day_change_pct ?? 0),
  );
  const best = sorted[0];
  const worst = sorted.length > 1 ? sorted[sorted.length - 1] : null;

  const dayPnlIdr = live.reduce(
    (sum, p) =>
      sum + ((p.market_value_idr ?? 0) * (p.day_change_pct ?? 0)) / 100,
    0,
  );
  const totalMv = live.reduce((sum, p) => sum + (p.market_value_idr ?? 0), 0);
  const dayPnlPct = totalMv > 0 ? (dayPnlIdr / totalMv) * 100 : 0;

  if (isLoading && !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-panel-2 border border-border rounded-[8px] px-4 py-3"
          >
            <span className="skel h-[10px] w-[60%] block mb-2" />
            <span className="skel h-[20px] w-[80%] block" />
          </div>
        ))}
      </div>
    );
  }

  if (live.length === 0) {
    // Render the same 3-cell skeleton structure even when there's no
    // live data, plus a one-line "why" under it.  Top-tier dashboards
    // never look empty — the panel always communicates its layout, the
    // text explains what's missing.
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: "Day P&L", placeholder: "—" },
            { label: "Best today", placeholder: "—" },
            { label: "Worst today", placeholder: "—" },
          ].map((c) => (
            <div
              key={c.label}
              className="bg-panel-2 border border-border rounded-[8px] px-4 py-3 opacity-70"
            >
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-2">
                {c.label}
              </div>
              <div className="mt-[6px] text-[18px] font-medium leading-tight text-muted-2">
                {c.placeholder}
              </div>
              <div className="mt-[3px] text-[11px] text-muted-2">awaiting live quotes</div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[10.5px] text-muted-2 leading-relaxed">
          Day-change needs live Yahoo / CoinGecko / Hyperliquid quotes on at
          least one open position. Movers populate as soon as the quote cache
          hydrates.
        </div>
      </>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <Cell
        label="Day P&L"
        primary={
          <span className={clsx("mono", signClass(dayPnlIdr))}>
            {dayPnlIdr >= 0 ? "+" : ""}
            {fmtCurrency(dayPnlIdr, "IDR")}
          </span>
        }
        secondary={
          <span className="flex items-center gap-2">
            <span className={clsx("mono", signClass(dayPnlPct))}>
              {fmtPct(dayPnlPct, 2, true)}
            </span>
            <span className="text-muted-2">·</span>
            <span className="text-muted-2 mono">
              {live.length} live position{live.length === 1 ? "" : "s"}
            </span>
          </span>
        }
      />
      <Cell
        label="Best today"
        primary={
          best ? (
            <span className="mono text-fg">{best.ticker}</span>
          ) : (
            <span className="text-muted-2">—</span>
          )
        }
        secondary={
          best && best.day_change_pct != null ? (
            <span className="mono pos">{fmtPct(best.day_change_pct, 2, true)}</span>
          ) : null
        }
      />
      <Cell
        label="Worst today"
        primary={
          worst ? (
            <span className="mono text-fg">{worst.ticker}</span>
          ) : (
            <span className="text-muted-2">—</span>
          )
        }
        secondary={
          worst && worst.day_change_pct != null ? (
            <span className="mono neg">{fmtPct(worst.day_change_pct, 2, true)}</span>
          ) : null
        }
      />
    </div>
  );
}

function Cell({
  label,
  primary,
  secondary,
}: {
  label: string;
  primary: React.ReactNode;
  secondary: React.ReactNode;
}) {
  return (
    <div className="bg-panel-2 border border-border rounded-[8px] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-2">
        {label}
      </div>
      <div className="mt-[6px] text-[18px] font-medium leading-tight tracking-[-0.01em]">
        {primary}
      </div>
      <div className="mt-[3px] text-[11px]">{secondary ?? <>&nbsp;</>}</div>
    </div>
  );
}
