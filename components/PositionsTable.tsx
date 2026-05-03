"use client";

import useSWR, { mutate } from "swr";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AssetBadge, BookBadge } from "./Badge";
import { fmtCurrency, fmtPct, fmtQty, fmtNumber, signClass, clsx } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { AssetClass, BookType } from "@/lib/types";

interface Position {
  ticker: string;
  asset_class: AssetClass;
  book: BookType;
  qty: number;
  avg_entry: number;
  live_price: number | null;
  currency: "IDR" | "USD";
  day_change_pct: number | null;
  market_value_idr: number | null;
  market_value_usd: number | null;
  unrealized_pnl_idr: number | null;
  unrealized_pnl_usd: number | null;
  unrealized_pnl_pct: number | null;
  pct_of_nav: number | null;
}

interface PositionsResp {
  positions: Position[];
  fx: { usd_idr: number };
  display_currency: "IDR" | "USD";
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function PositionsTable({
  book,
  currency,
  limit,
}: {
  book: string;
  currency: "IDR" | "USD";
  limit?: number;
}) {
  const bookParam = book === "all" ? "" : `?book=${book}`;
  const key = `/api/positions${bookParam}`;

  // Track when SWR last successfully delivered a payload so we can render
  // a freshness chip (G17 from the audit). onSuccess fires outside React
  // reconciliation so it's safe to setState there. Lazy initialiser
  // avoids Date.now() in render body (React 19 strict-purity).
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);

  const { data, isLoading } = useSWR<PositionsResp>(key, fetcher, {
    refreshInterval: 30_000,
    keepPreviousData: true,
    onSuccess: () => setLastFetchedAt(Date.now()),
  });

  // Tick `now` every 5s so the freshness chip's seconds counter updates
  // without re-fetching the data.  Driven by setInterval, not a
  // requestAnimationFrame loop -- the resolution we care about is
  // seconds, not 60fps.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  // Realtime: any INSERT/UPDATE on trades (from Sheets sync) triggers an
  // immediate refetch so the positions table reflects the new row without
  // waiting on the 30s poll.
  useEffect(() => {
    const sb = supabaseBrowser();
    const ch = sb
      .channel(`positions-live-${book}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trades" },
        () => mutate(key),
      )
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [key, book]);

  const positions = data?.positions ?? [];
  const rows = limit ? positions.slice(0, limit) : positions;

  // G17 freshness colouring: green <30s (one full poll cycle), amber
  // 30-120s (poll-skip / SWR-deduping window), red >120s (truly stale).
  // Renders nothing until the first fetch lands so the chip doesn't
  // flash "stale" on initial mount.
  let freshness: { label: string; tone: "live" | "warn" | "stale" } | null = null;
  if (lastFetchedAt != null) {
    const ageS = Math.max(0, Math.floor((now - lastFetchedAt) / 1000));
    const tone: "live" | "warn" | "stale" =
      ageS < 30 ? "live" : ageS < 120 ? "warn" : "stale";
    const label =
      ageS < 60 ? `${ageS}s ago` : `${Math.floor(ageS / 60)}m ${ageS % 60}s ago`;
    freshness = { label, tone };
  }

  return (
    <div className="overflow-x-auto">
      {freshness && (
        <div className="flex items-center justify-end gap-2 mb-2 text-[10px] uppercase tracking-[0.10em]">
          <span
            className="inline-block w-[5px] h-[5px] rounded-full"
            style={{
              background:
                freshness.tone === "live"
                  ? "var(--color-up)"
                  : freshness.tone === "warn"
                    ? "var(--color-accent)"
                    : "var(--color-down)",
              boxShadow:
                freshness.tone === "live"
                  ? "0 0 5px var(--color-up)"
                  : "none",
            }}
            aria-hidden
          />
          <span
            className={clsx(
              "mono",
              freshness.tone === "live"
                ? "text-up"
                : freshness.tone === "warn"
                  ? "text-amber"
                  : "text-down",
            )}
          >
            {freshness.tone === "live"
              ? "Live"
              : freshness.tone === "warn"
                ? "Lag"
                : "Stale"}
          </span>
          <span className="text-muted-2 mono">· {freshness.label} · 30s poll</span>
        </div>
      )}
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-muted-2 text-[11px] border-b border-border">
            <th className="py-2 px-2 text-left font-normal">Ticker</th>
            <th className="py-2 px-2 text-left font-normal">Class</th>
            <th className="py-2 px-2 text-left font-normal">Book</th>
            <th className="py-2 px-2 text-right font-normal">Qty</th>
            <th className="py-2 px-2 text-right font-normal">Avg entry</th>
            <th className="py-2 px-2 text-right font-normal">Last</th>
            <th className="py-2 px-2 text-right font-normal">Day %</th>
            <th className="py-2 px-2 text-right font-normal">MV ({currency})</th>
            <th className="py-2 px-2 text-right font-normal">% NAV</th>
            <th className="py-2 px-2 text-right font-normal">Unreal P&amp;L</th>
            <th className="py-2 px-2 text-right font-normal">%</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && !data && (
            // Skeleton rows — replaces the plain "Loading…" flash.  Six rows
            // matches typical above-the-fold position count so the layout
            // doesn't jump when real data swaps in.
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={`skel-${i}`} className="border-b border-border">
                {Array.from({ length: 11 }).map((__, j) => (
                  <td key={j} className="py-[10px] px-2">
                    <span className="skel h-[10px] w-full block" style={{ opacity: 0.35 + (i % 3) * 0.05 }} />
                  </td>
                ))}
              </tr>
            ))
          )}
          {!isLoading && rows.length === 0 && (
            <tr>
              <td colSpan={11} className="py-6 text-center text-muted">
                No open positions. Sync trades from your Google Sheet.
              </td>
            </tr>
          )}
          {rows.map((p) => {
            const mv = currency === "IDR" ? p.market_value_idr : p.market_value_usd;
            const upl = currency === "IDR" ? p.unrealized_pnl_idr : p.unrealized_pnl_usd;
            return (
              <tr key={p.ticker + p.book} className="border-b border-border hover:bg-elevated transition-colors">
                <td className="py-[8px] px-2 mono font-medium text-fg">
                  <span className="flex items-center gap-1.5">
                    <span>{p.ticker}</span>
                    {/* G5 memo link — jumps to /memos filtered by this
                        ticker.  Per-ticker count would be ideal but it'd
                        cost an extra fetch per row; the button is
                        permanent and the ticker filter handles empty
                        results gracefully. */}
                    <Link
                      href={`/memos?ticker=${encodeURIComponent(p.ticker)}`}
                      title={`Memos for ${p.ticker}`}
                      className="text-muted-2 hover:text-amber text-[9px] uppercase tracking-[0.08em] no-underline"
                    >
                      M
                    </Link>
                  </span>
                </td>
                <td className="py-[8px] px-2"><AssetBadge cls={p.asset_class} /></td>
                <td className="py-[8px] px-2"><BookBadge book={p.book} /></td>
                <td className="py-[8px] px-2 text-right mono">{fmtQty(p.qty)}</td>
                <td className="py-[8px] px-2 text-right mono">{fmtNumber(p.avg_entry, p.currency === "IDR" ? 0 : 2)}</td>
                <td className="py-[8px] px-2 text-right mono">{p.live_price != null ? fmtNumber(p.live_price, p.currency === "IDR" ? 0 : 2) : "—"}</td>
                <td className={`py-[8px] px-2 text-right mono ${signClass(p.day_change_pct)}`}>
                  {p.day_change_pct != null ? fmtPct(p.day_change_pct, 2, true) : "—"}
                </td>
                <td className="py-[8px] px-2 text-right mono">{mv != null ? fmtCurrency(mv, currency) : "—"}</td>
                <td className="py-[8px] px-2 text-right mono text-muted">{p.pct_of_nav != null ? fmtPct(p.pct_of_nav, 1) : "—"}</td>
                <td className={`py-[8px] px-2 text-right mono ${signClass(upl)}`}>
                  {upl != null ? fmtCurrency(upl, currency) : "—"}
                </td>
                <td className={`py-[8px] px-2 text-right mono ${signClass(p.unrealized_pnl_pct)}`}>
                  {p.unrealized_pnl_pct != null ? fmtPct(p.unrealized_pnl_pct, 2, true) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
