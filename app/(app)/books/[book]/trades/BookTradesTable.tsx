"use client";

import useSWR from "swr";
import { clsx, fmtCurrency, fmtDate, fmtNumber, fmtPct, signClass } from "@/lib/format";
import type { BookType } from "@/lib/types";

type Trade = {
  id: string;
  trade_date: string;
  ticker: string;
  direction: "LONG" | "SHORT";
  strategy: string | null;
  entry_price: number;
  exit_price: number | null;
  position_size: number;
  pnl_native: number | null;
  pnl_pct: number | null;
  pnl_currency: "IDR" | "USD";
  result: string | null;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export function BookTradesTable({ book }: { book: BookType }) {
  const { data, isLoading } = useSWR<{ trades: Trade[] }>(
    `/api/journal/trades?book=${book}&limit=200`,
    fetcher,
    { refreshInterval: 60_000 },
  );

  if (isLoading) return <div className="text-muted text-[11px]">Loading…</div>;

  // Zombie-row filter: early sync runs created empty shell rows before the
  // trader filled in values. A "real" trade has either a non-zero entry+size
  // pair (still open) or a recorded exit.
  const trades = (data?.trades ?? []).filter(
    (t) => (t.position_size > 0 && t.entry_price > 0) || t.exit_price != null,
  );

  if (!trades.length)
    return (
      <div className="text-[11.5px] text-muted">
        No trades on file for this book yet. Sync from the Sheets source in Settings.
      </div>
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11.5px] tabular-nums">
        <thead className="text-muted text-[10px] uppercase tracking-[0.14em] border-b border-border">
          <tr>
            <th className="text-left py-2">Date</th>
            <th className="text-left">Ticker</th>
            <th className="text-left">Dir</th>
            <th className="text-left">Strategy</th>
            <th className="text-right">Entry</th>
            <th className="text-right">Exit</th>
            <th className="text-right">Size</th>
            <th className="text-right">P&L</th>
            <th className="text-right">%</th>
            <th className="text-right">Result</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.id} className="border-b border-border hover:bg-hover">
              <td className="py-2">{fmtDate(t.trade_date)}</td>
              <td className="font-semibold">{t.ticker}</td>
              <td>
                <span
                  className={clsx(
                    "text-[9.5px] px-1.5 py-0.5 rounded border uppercase tracking-wide",
                    t.direction === "LONG"
                      ? "text-green border-green/30"
                      : "text-red border-red/30",
                  )}
                >
                  {t.direction}
                </span>
              </td>
              <td className="text-muted">{t.strategy ?? "—"}</td>
              <td className="text-right">{fmtNumber(t.entry_price, 0)}</td>
              <td className="text-right">
                {t.exit_price != null ? fmtNumber(t.exit_price, 0) : "—"}
              </td>
              <td className="text-right">{fmtNumber(t.position_size, 0)}</td>
              <td className={clsx("text-right font-medium", signClass(t.pnl_native))}>
                {fmtCurrency(t.pnl_native, t.pnl_currency)}
              </td>
              <td className={clsx("text-right", signClass(t.pnl_pct))}>
                {fmtPct(t.pnl_pct, 2, true)}
              </td>
              <td className="text-right text-[10px] uppercase tracking-wide text-muted">
                {t.result ?? "open"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
