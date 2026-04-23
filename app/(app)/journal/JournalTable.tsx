"use client";

import { useState } from "react";
import useSWR from "swr";
import { AssetBadge, BookBadge, Badge } from "@/components/Badge";
import { fmtDate, fmtNumber, fmtPct, fmtCurrency, signClass, clsx } from "@/lib/format";
import type { AssetClass, BookType, TradeDirection, TradeResult } from "@/lib/types";

interface TradeRow {
  id: string;
  trade_date: string;
  ticker: string;
  asset_class: AssetClass;
  asset_type: string | null;
  book: BookType;
  direction: TradeDirection;
  strategy: string | null;
  result: TradeResult | null;
  entry_price: number;
  exit_price: number | null;
  position_size: number;
  pnl_pct: number | null;
  pnl_native: number | null;
  pnl_currency: "IDR" | "USD";
  fx_rate_to_idr: number | null;
  hold_time_hours: number | null;
  conviction: string | null;
  mood: number | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const BOOKS: { value: string; label: string }[] = [
  { value: "all", label: "All books" },
  { value: "investing", label: "Investing" },
  { value: "idx_trading", label: "IDX Trading" },
  { value: "crypto_trading", label: "Crypto" },
];
const RESULTS = ["ALL", "WIN", "LOSS", "BE", "OPEN"] as const;

export function JournalTable() {
  const [book, setBook] = useState("all");
  const [result, setResult] = useState<(typeof RESULTS)[number]>("ALL");
  const qs = new URLSearchParams();
  if (book !== "all") qs.set("book", book);
  if (result !== "ALL") qs.set("result", result);
  const { data } = useSWR<{ trades: TradeRow[] }>(`/api/journal/trades?${qs.toString()}`, fetcher, {
    refreshInterval: 60_000,
  });
  // Ghost-row filter: early sync runs wrote shell rows with Entry=0 and
  // Size=0 that never got replaced. A real trade has a non-zero entry+size
  // pair (still open) or a recorded exit — anything else is a stub we
  // should not pretend was a trade.
  const rows = (data?.trades ?? []).filter(
    (t) => (t.position_size > 0 && t.entry_price > 0) || t.exit_price != null,
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select
          value={book}
          onChange={(e) => setBook(e.target.value)}
          className="text-[12px]"
        >
          {BOOKS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          {RESULTS.map((r) => (
            <button
              key={r}
              onClick={() => setResult(r)}
              className={clsx(
                "px-2 py-[3px] text-[10px] uppercase tracking-wider rounded border",
                result === r
                  ? "bg-accent text-bg border-accent font-semibold"
                  : "text-muted border-border hover:text-fg",
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted ml-auto">{rows.length} trades</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px] tabular-nums">
          <thead>
            <tr className="text-muted text-[10px] uppercase tracking-wider border-b border-border">
              <th className="py-2 px-2 text-left font-normal">Date</th>
              <th className="py-2 px-2 text-left font-normal">Ticker</th>
              <th className="py-2 px-2 text-left font-normal">Class</th>
              <th className="py-2 px-2 text-left font-normal">Book</th>
              <th className="py-2 px-2 text-left font-normal">Dir</th>
              <th className="py-2 px-2 text-left font-normal">Strategy</th>
              <th className="py-2 px-2 text-right font-normal">Size</th>
              <th className="py-2 px-2 text-right font-normal">Entry</th>
              <th className="py-2 px-2 text-right font-normal">Exit</th>
              <th className="py-2 px-2 text-right font-normal">P&amp;L %</th>
              <th className="py-2 px-2 text-right font-normal">P&amp;L</th>
              <th className="py-2 px-2 text-left font-normal">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="py-6 text-center text-muted">
                  No trades match. Check filters or sync from Google Sheets.
                </td>
              </tr>
            )}
            {rows.map((t) => {
              const pnlIdr =
                t.pnl_native != null
                  ? t.pnl_currency === "IDR"
                    ? t.pnl_native
                    : t.pnl_native * (t.fx_rate_to_idr || 16500)
                  : null;
              return (
                <tr key={t.id} className="border-b border-border hover:bg-hover">
                  <td className="py-[6px] px-2">{fmtDate(t.trade_date, { month: "short", day: "numeric", year: "2-digit" })}</td>
                  <td className="py-[6px] px-2 font-medium">{t.ticker}</td>
                  <td className="py-[6px] px-2"><AssetBadge cls={t.asset_class} /></td>
                  <td className="py-[6px] px-2"><BookBadge book={t.book} /></td>
                  <td className={`py-[6px] px-2 ${t.direction === "LONG" ? "pos" : "neg"}`}>{t.direction}</td>
                  <td className="py-[6px] px-2 text-muted">{t.strategy || "—"}</td>
                  <td className="py-[6px] px-2 text-right">{fmtNumber(t.position_size, 2)}</td>
                  <td className="py-[6px] px-2 text-right">{fmtNumber(t.entry_price, t.pnl_currency === "IDR" ? 0 : 2)}</td>
                  <td className="py-[6px] px-2 text-right">{t.exit_price != null ? fmtNumber(t.exit_price, t.pnl_currency === "IDR" ? 0 : 2) : "—"}</td>
                  <td className={`py-[6px] px-2 text-right ${signClass(t.pnl_pct)}`}>
                    {t.pnl_pct != null ? fmtPct(t.pnl_pct, 2, true) : "—"}
                  </td>
                  <td className={`py-[6px] px-2 text-right ${signClass(pnlIdr)}`}>
                    {pnlIdr != null ? fmtCurrency(pnlIdr, "IDR") : "—"}
                  </td>
                  <td className="py-[6px] px-2">
                    {t.result && (
                      <Badge
                        className={clsx(
                          t.result === "WIN" && "bg-green-900/30 text-green-300 border-green-900/60",
                          t.result === "LOSS" && "bg-red-900/40 text-red-300 border-red-900/60",
                          t.result === "BE" && "bg-slate-700/40 text-slate-300 border-slate-700",
                          t.result === "OPEN" && "bg-blue-900/30 text-blue-300 border-blue-900/60",
                        )}
                      >
                        {t.result}
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
