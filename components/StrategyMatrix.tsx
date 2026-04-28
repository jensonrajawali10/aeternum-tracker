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
      <table className="w-full text-[12px] tabular-nums dense-table">
        <thead>
          <tr
            className="text-muted-2 text-[9.5px] uppercase border-b"
            style={{
              letterSpacing: "0.14em",
              borderColor: "var(--color-border-strong)",
            }}
          >
            <th className="py-1.5 px-2 text-left font-medium">Strategy</th>
            <th className="py-1.5 px-2 text-left font-medium">Asset</th>
            <th className="py-1.5 px-2 text-right font-medium">N</th>
            <th className="py-1.5 px-2 text-right font-medium">Win%</th>
            <th className="py-1.5 px-2 text-right font-medium">Avg R:R</th>
            <th className="py-1.5 px-2 text-right font-medium">Expectancy</th>
            <th className="py-1.5 px-2 text-right font-medium">Net P&amp;L</th>
            <th className="py-1.5 px-2 text-right font-medium">Hold</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={8}
                className="py-4 text-center text-muted-2 text-[10.5px] uppercase"
                style={{ letterSpacing: "0.12em" }}
              >
                No closed trades yet
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr
              key={i}
              className="border-b transition-colors hover:bg-elevated/50"
              style={{ borderColor: "var(--color-border)" }}
            >
              <td className="py-[6px] px-2 mono text-fg">{r.strategy || "—"}</td>
              <td className="py-[6px] px-2 mono text-muted">{r.asset_type || "—"}</td>
              <td className="py-[6px] px-2 text-right mono text-muted">{r.count}</td>
              <td
                className={`py-[6px] px-2 text-right mono ${r.win_rate_pct >= 50 ? "pos" : "neg"}`}
              >
                {fmtPct(r.win_rate_pct, 1)}
              </td>
              <td className="py-[6px] px-2 text-right mono">
                {r.avg_rr != null ? fmtNumber(r.avg_rr, 2) : "—"}
              </td>
              <td className={`py-[6px] px-2 text-right mono ${signClass(r.expectancy)}`}>
                {fmtPct(r.expectancy, 2, true)}
              </td>
              <td className="py-[6px] px-2 text-right">
                <DeltaNumber
                  value={r.net_pnl_idr}
                  text={fmtCurrency(r.net_pnl_idr, "IDR")}
                  className="justify-end"
                />
              </td>
              <td className="py-[6px] px-2 text-right mono text-muted-2">
                {r.avg_hold_hours != null ? `${r.avg_hold_hours.toFixed(1)}h` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
