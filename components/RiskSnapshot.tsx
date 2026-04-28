"use client";

import type { ReactNode } from "react";
import useSWR from "swr";
import { fmtPct, fmtNumber } from "@/lib/format";
import { DeltaNumber } from "./shell/DeltaNumber";

interface MetricsResp {
  ytd_return_pct: number;
  mtd_return_pct: number;
  vol_30d_annualized_pct: number;
  vol_90d_annualized_pct: number;
  beta_vs_ihsg: number | null;
  beta_vs_spx: number | null;
  sharpe_ytd: number;
  sortino_ytd: number;
  max_drawdown_pct: number;
  var_30d_95_pct: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function delta(value: number | null | undefined, text: string): ReactNode {
  if (value == null || !Number.isFinite(value)) return <span>{text}</span>;
  return <DeltaNumber value={value} text={text} />;
}

export function RiskSnapshot({ book }: { book: string }) {
  const bookParam = book === "all" ? "" : `?book=${book}`;
  const { data } = useSWR<MetricsResp>(`/api/portfolio/metrics${bookParam}`, fetcher, {
    refreshInterval: 120_000,
  });

  // Insufficient-history signal — lib/analytics/metrics now returns NaN for
  // vol / sharpe / sortino / VaR when the sample is below the minimum
  // threshold (15 returns for 30D vol, 45 for 90D vol). If both vol
  // windows are NaN the nav_history is too shallow to show anything
  // useful; print a one-line banner under the metric rows instead of
  // letting the "—" scatter look like a broken render.
  const sparse =
    !!data &&
    !isFinite(data.vol_30d_annualized_pct) &&
    !isFinite(data.vol_90d_annualized_pct) &&
    data.beta_vs_ihsg == null &&
    data.beta_vs_spx == null;

  // Directional rows render through DeltaNumber → ▲/▼ glyph + colour;
  // non-directional rows (vol, beta, MDD, VaR) keep a plain mono value.
  const rows: { label: string; node: ReactNode }[] = [
    {
      label: "YTD Return",
      node: data ? delta(data.ytd_return_pct, fmtPct(data.ytd_return_pct, 2, true)) : "—",
    },
    {
      label: "MTD Return",
      node: data ? delta(data.mtd_return_pct, fmtPct(data.mtd_return_pct, 2, true)) : "—",
    },
    {
      label: "Vol (30D ann)",
      node: data ? fmtPct(data.vol_30d_annualized_pct, 1) : "—",
    },
    {
      label: "Vol (90D ann)",
      node: data ? fmtPct(data.vol_90d_annualized_pct, 1) : "—",
    },
    {
      label: "Sharpe (YTD)",
      node: data ? delta(data.sharpe_ytd, fmtNumber(data.sharpe_ytd, 2)) : "—",
    },
    {
      label: "Sortino (YTD)",
      node: data ? delta(data.sortino_ytd, fmtNumber(data.sortino_ytd, 2)) : "—",
    },
    {
      label: "Beta vs JCI",
      node: data?.beta_vs_ihsg != null ? fmtNumber(data.beta_vs_ihsg, 2) : "—",
    },
    {
      label: "Beta vs S&P",
      node: data?.beta_vs_spx != null ? fmtNumber(data.beta_vs_spx, 2) : "—",
    },
    {
      label: "Max Drawdown",
      node: data ? <span className="neg">{fmtPct(data.max_drawdown_pct, 1)}</span> : "—",
    },
    {
      label: "30D VaR (95%)",
      node: data ? <span className="neg">{fmtPct(data.var_30d_95_pct, 2)}</span> : "—",
    },
  ];

  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-x-6 text-[12px] tabular-nums">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-baseline justify-between py-[5px]"
            style={{
              // Dashed underline per row for terminal-mock dense feel —
              // gives the eye an alignment guide between the label and
              // the value without the heavy weight of a solid border.
              borderBottom: "1px dashed var(--color-border)",
            }}
          >
            <dt
              className="text-muted-2 text-[10px] uppercase"
              style={{ letterSpacing: "0.12em" }}
            >
              {r.label}
            </dt>
            <dd className="mono text-[12px]">{r.node}</dd>
          </div>
        ))}
      </dl>
      {sparse && (
        <div className="text-[10.5px] text-muted-2 leading-relaxed pt-2">
          Insufficient history · vol, Sharpe, Sortino and beta populate once
          ≥30 aligned daily NAV snapshots are on file. Daily snapshots are
          written at 05:00 WIB.
        </div>
      )}
    </div>
  );
}
