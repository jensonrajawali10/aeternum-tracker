"use client";

import useSWR from "swr";
import { AssetBadge, BookBadge } from "./Badge";
import { fmtCurrency, fmtPct, fmtQty, fmtNumber, signClass } from "@/lib/format";
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
  const { data, isLoading } = useSWR<PositionsResp>(`/api/positions${bookParam}`, fetcher, {
    refreshInterval: 30_000,
  });

  const positions = data?.positions ?? [];
  const rows = limit ? positions.slice(0, limit) : positions;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px] tabular-nums">
        <thead>
          <tr className="text-muted text-[10px] uppercase tracking-wider border-b border-border">
            <th className="py-2 px-2 text-left font-normal">Ticker</th>
            <th className="py-2 px-2 text-left font-normal">Class</th>
            <th className="py-2 px-2 text-left font-normal">Book</th>
            <th className="py-2 px-2 text-right font-normal">Qty</th>
            <th className="py-2 px-2 text-right font-normal">Avg Entry</th>
            <th className="py-2 px-2 text-right font-normal">Last</th>
            <th className="py-2 px-2 text-right font-normal">Day%</th>
            <th className="py-2 px-2 text-right font-normal">MV ({currency})</th>
            <th className="py-2 px-2 text-right font-normal">%NAV</th>
            <th className="py-2 px-2 text-right font-normal">Unreal P&amp;L</th>
            <th className="py-2 px-2 text-right font-normal">%</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td colSpan={11} className="py-6 text-center text-muted">
                Loading…
              </td>
            </tr>
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
              <tr key={p.ticker + p.book} className="border-b border-border hover:bg-hover transition-colors">
                <td className="py-[7px] px-2 font-medium">{p.ticker}</td>
                <td className="py-[7px] px-2"><AssetBadge cls={p.asset_class} /></td>
                <td className="py-[7px] px-2"><BookBadge book={p.book} /></td>
                <td className="py-[7px] px-2 text-right">{fmtQty(p.qty)}</td>
                <td className="py-[7px] px-2 text-right">{fmtNumber(p.avg_entry, p.currency === "IDR" ? 0 : 2)}</td>
                <td className="py-[7px] px-2 text-right">{p.live_price != null ? fmtNumber(p.live_price, p.currency === "IDR" ? 0 : 2) : "—"}</td>
                <td className={`py-[7px] px-2 text-right ${signClass(p.day_change_pct)}`}>
                  {p.day_change_pct != null ? fmtPct(p.day_change_pct, 2, true) : "—"}
                </td>
                <td className="py-[7px] px-2 text-right">{mv != null ? fmtCurrency(mv, currency) : "—"}</td>
                <td className="py-[7px] px-2 text-right text-muted">{p.pct_of_nav != null ? fmtPct(p.pct_of_nav, 1) : "—"}</td>
                <td className={`py-[7px] px-2 text-right ${signClass(upl)}`}>
                  {upl != null ? fmtCurrency(upl, currency) : "—"}
                </td>
                <td className={`py-[7px] px-2 text-right ${signClass(p.unrealized_pnl_pct)}`}>
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
