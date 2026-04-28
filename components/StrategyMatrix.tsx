"use client";

import useSWR from "swr";
import { fmtPct, fmtNumber, fmtCurrency, signClass } from "@/lib/format";
import { DeltaNumber } from "./shell/DeltaNumber";

interface Row {
  strategy: string;
  asset_type: string;
  count: number;
  win_rate_pct: number;
  avg_rr: number | null;
  expectancy: number | null;
  net_pnl_idr: number;
  avg_hold_hours: number | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function StrategyMatrix() {
  const { data } = useSWR<{ rows: Row[] }>("/api/journal/strategy-matrix", fetcher, {
    refreshInterval: 120_000,
  });
  const rows = data?.rows ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px] tabular-nums">
        <thead>
          <tr className="text-muted text-[10px] uppercase tracking-wider border-b border-border">
            <th className="py-2 px-2 text-left font-normal">Strategy</th>
            <th className="py-2 px-2 text-left font-normal">Asset</th>
            <th className="py-2 px-2 text-right font-normal">N</th>
            <th className="py-2 px-2 text-right font-normal">Win%</th>
            <th className="py-2 px-2 text-right font-normal">Avg R:R</th>
            <th className="py-2 px-2 text-right font-normal">Expectancy</th>
            <th className="py-2 px-2 text-right font-normal">Net P&amp;L</th>
            <th className="py-2 px-2 text-right font-normal">Avg Hold</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="py-4 text-center text-muted text-[11px]">
                No closed trades yet
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border hover:bg-hover">
              <td className="py-[7px] px-2">{r.strategy || "—"}</td>
              <td className="py-[7px] px-2 text-muted">{r.asset_type || "—"}</td>
              <td className="py-[7px] px-2 text-right">{r.count}</td>
              <td className={`py-[7px] px-2 text-right ${r.win_rate_pct >= 50 ? "pos" : "neg"}`}>
                {fmtPct(r.win_rate_pct, 1)}
              </td>
              <td className="py-[7px] px-2 text-right">{r.avg_rr != null ? fmtNumber(r.avg_rr, 2) : "—"}</td>
              <td className={`py-[7px] px-2 text-right ${signClass(r.expectancy)}`}>
                {fmtPct(r.expectancy, 2, true)}
              </td>
              <td className="py-[7px] px-2 text-right">
                <DeltaNumber
                  value={r.net_pnl_idr}
                  text={fmtCurrency(r.net_pnl_idr, "IDR")}
                  className="justify-end"
                />
              </td>
              <td className="py-[7px] px-2 text-right text-muted">
                {r.avg_hold_hours != null ? `${r.avg_hold_hours.toFixed(1)}h` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
