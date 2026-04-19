"use client";

import useSWR from "swr";
import { fmtPct, fmtNumber, signClass } from "@/lib/format";

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

export function RiskSnapshot({ book }: { book: string }) {
  const bookParam = book === "all" ? "" : `?book=${book}`;
  const { data } = useSWR<MetricsResp>(`/api/portfolio/metrics${bookParam}`, fetcher, {
    refreshInterval: 120_000,
  });

  const rows: {
    label: string;
    value: string;
    signClass?: string;
  }[] = [
    { label: "YTD Return", value: data ? fmtPct(data.ytd_return_pct, 2, true) : "—", signClass: signClass(data?.ytd_return_pct) },
    { label: "MTD Return", value: data ? fmtPct(data.mtd_return_pct, 2, true) : "—", signClass: signClass(data?.mtd_return_pct) },
    { label: "Vol (30D ann)", value: data ? fmtPct(data.vol_30d_annualized_pct, 1) : "—" },
    { label: "Vol (90D ann)", value: data ? fmtPct(data.vol_90d_annualized_pct, 1) : "—" },
    { label: "Sharpe (YTD)", value: data ? fmtNumber(data.sharpe_ytd, 2) : "—", signClass: signClass(data?.sharpe_ytd) },
    { label: "Sortino (YTD)", value: data ? fmtNumber(data.sortino_ytd, 2) : "—", signClass: signClass(data?.sortino_ytd) },
    { label: "Beta vs IHSG", value: data?.beta_vs_ihsg != null ? fmtNumber(data.beta_vs_ihsg, 2) : "—" },
    { label: "Beta vs S&P", value: data?.beta_vs_spx != null ? fmtNumber(data.beta_vs_spx, 2) : "—" },
    { label: "Max Drawdown", value: data ? fmtPct(data.max_drawdown_pct, 1) : "—", signClass: "neg" },
    { label: "30D VaR (95%)", value: data ? fmtPct(data.var_30d_95_pct, 2) : "—", signClass: "neg" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] tabular-nums">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between">
          <dt className="text-muted text-[11px]">{r.label}</dt>
          <dd className={r.signClass}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
