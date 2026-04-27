"use client";

import { useState } from "react";
import useSWR from "swr";
import { clsx } from "@/lib/format";

type Book = "investing" | "idx_trading" | "crypto_trading";

interface Pair {
  a: Book;
  b: Book;
  correlation: number | null;
}

interface CorrResp {
  window_days: number;
  aligned_days: number;
  pairs: Pair[];
}

const fetcher = (u: string) => fetch(u).then((r) => r.json());

const BOOK_LABELS: Record<Book, string> = {
  investing: "Investing",
  idx_trading: "IDX",
  crypto_trading: "Crypto",
};

const BOOKS: Book[] = ["investing", "idx_trading", "crypto_trading"];

/**
 * Heatmap colour scale — red for high positive (concentrated risk),
 * neutral for zero (diversified), blue for negative (hedging). Absolute
 * value drives saturation; anything above 0.7 is hot regardless of sign.
 */
function cellColor(rho: number | null): string {
  if (rho == null) return "bg-bg border-border text-muted-2";
  const abs = Math.min(1, Math.abs(rho));
  if (rho > 0) {
    if (abs > 0.7) return "bg-red/25 border-red/40 text-fg";
    if (abs > 0.4) return "bg-red/15 border-red/25 text-fg";
    if (abs > 0.15) return "bg-red/8 border-border text-fg";
    return "bg-panel-2 border-border text-fg";
  }
  if (abs > 0.7) return "bg-[#6fa8dc]/25 border-[#6fa8dc]/40 text-fg";
  if (abs > 0.4) return "bg-[#6fa8dc]/15 border-[#6fa8dc]/25 text-fg";
  if (abs > 0.15) return "bg-[#6fa8dc]/8 border-border text-fg";
  return "bg-panel-2 border-border text-fg";
}

function Cell({ rho, isDiag }: { rho: number | null; isDiag: boolean }) {
  if (isDiag) {
    return (
      <div className="aspect-square flex items-center justify-center bg-bg border border-border rounded">
        <span className="mono text-[11px] text-muted-2">1.00</span>
      </div>
    );
  }
  const tone = cellColor(rho);
  return (
    <div className={clsx("aspect-square flex items-center justify-center border rounded", tone)}>
      <span className="mono text-[11.5px] font-semibold">
        {rho == null ? "—" : (rho >= 0 ? "+" : "") + rho.toFixed(2)}
      </span>
    </div>
  );
}

const MIN_ALIGNED_FOR_CORRELATION = 5;

/**
 * 3×3 correlation heatmap — pairwise Pearson on aligned daily NAV log
 * returns between the three live books.  Diagonals pinned at 1.00.
 * Window selector toggles 30d / 90d / 180d.
 *
 * When fewer than {MIN_ALIGNED_FOR_CORRELATION} aligned observations
 * exist across all three books' nav_history, we swap the matrix for an
 * insufficient-history banner rather than printing a 3×3 grid of dashes
 * that looks broken.  The banner explains *why* (daily-snapshot cron
 * hasn't backfilled enough history for the newer books yet).
 */
export function CorrelationHeatmap() {
  const [days, setDays] = useState(90);
  const { data } = useSWR<CorrResp>(
    `/api/capital/correlation?days=${days}`,
    fetcher,
    { refreshInterval: 300_000 },
  );

  const pairMap = new Map<string, number | null>();
  for (const p of data?.pairs ?? []) {
    pairMap.set(`${p.a}|${p.b}`, p.correlation);
    pairMap.set(`${p.b}|${p.a}`, p.correlation);
  }

  function rho(a: Book, b: Book): number | null {
    if (a === b) return 1;
    return pairMap.get(`${a}|${b}`) ?? null;
  }

  const insufficient = !!data && data.aligned_days < MIN_ALIGNED_FOR_CORRELATION;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10.5px] text-muted-2">
          {data
            ? `${data.aligned_days} aligned days · ${data.window_days}d window`
            : "Loading…"}
        </div>
        <div className="inline-flex border border-border rounded overflow-hidden text-[10px] uppercase tracking-wide">
          {[30, 90, 180].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={clsx(
                "px-2 py-[3px] transition-colors",
                days === d ? "bg-elevated text-fg" : "text-muted hover:text-fg",
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Grid always renders — when insufficient history, cells stay
          dashes (greyed) but the structure of the matrix is visible.
          A small banner under the grid explains the why. */}
      <div
        className={clsx(
          "grid grid-cols-[auto_repeat(3,1fr)] gap-1 max-w-[420px]",
          insufficient && "opacity-60",
        )}
      >
        <div />
        {BOOKS.map((b) => (
          <div
            key={`col-${b}`}
            className="text-[10px] uppercase tracking-[0.14em] text-muted-2 text-center pb-1"
          >
            {BOOK_LABELS[b]}
          </div>
        ))}
        {BOOKS.flatMap((row) => [
          <div
            key={`row-label-${row}`}
            className="text-[10px] uppercase tracking-[0.14em] text-muted-2 flex items-center pr-2"
          >
            {BOOK_LABELS[row]}
          </div>,
          ...BOOKS.map((col) => (
            <Cell
              key={`${row}-${col}`}
              rho={insufficient ? null : rho(row, col)}
              isDiag={row === col}
            />
          )),
        ])}
      </div>

      {insufficient && (
        <div className="mt-3 text-[11px] leading-relaxed text-muted border border-border rounded-[6px] bg-panel-2/40 px-3 py-2">
          <span className="text-fg">Insufficient aligned history</span> ·{" "}
          {data?.aligned_days ?? 0}d in the {days}-day window. Need ≥
          {MIN_ALIGNED_FOR_CORRELATION} overlapping days across all three books
          before pairs become reliable. Daily-snapshot cron writes one row per book
          at 05:00 WIB.
        </div>
      )}

      <div className="mt-3 text-[10.5px] text-muted-2 leading-relaxed">
        Pearson correlation of daily NAV log-returns per arm on overlapping dates.
        Red = correlated (risk is concentrated, not diversified).  Blue = negatively
        correlated (one arm hedges the other).  Below ±0.15 reads as noise. &quot;—&quot;
        shows when any single pair has fewer than {MIN_ALIGNED_FOR_CORRELATION} aligned days.
      </div>
    </div>
  );
}
