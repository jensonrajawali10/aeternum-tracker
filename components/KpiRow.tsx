"use client";

import useSWR from "swr";
import { Kpi } from "./Kpi";
import { fmtCurrency, fmtPct, signClass } from "@/lib/format";

interface NavResp {
  nav_idr: number;
  nav_usd: number;
  gross_exposure_pct: number;
  net_exposure_pct: number;
  unrealized_pnl_idr: number;
  realized_ytd_idr: number;
  fx: { usd_idr: number };
}

interface MetricsResp {
  ytd_return_pct: number;
  vol_30d_annualized_pct: number;
  var_30d_95_pct: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function KpiRow({
  book,
  currency,
}: {
  book: string;
  currency: "IDR" | "USD";
}) {
  const bookParam = book === "all" ? "" : `?book=${book}`;
  const { data: nav } = useSWR<NavResp>(`/api/portfolio/nav${bookParam}`, fetcher, {
    refreshInterval: 60_000,
  });
  const { data: metrics } = useSWR<MetricsResp>(`/api/portfolio/metrics${bookParam}`, fetcher, {
    refreshInterval: 60_000,
  });

  const navValue = nav ? (currency === "IDR" ? nav.nav_idr : nav.nav_usd) : null;
  const unrealValue = nav
    ? currency === "IDR"
      ? nav.unrealized_pnl_idr
      : nav.unrealized_pnl_idr / (nav.fx.usd_idr || 1)
    : null;
  const ytdValue = nav
    ? currency === "IDR"
      ? nav.realized_ytd_idr
      : nav.realized_ytd_idr / (nav.fx.usd_idr || 1)
    : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
      <Kpi
        label="Portfolio NAV"
        value={navValue != null ? fmtCurrency(navValue, currency) : "—"}
        hint={nav ? `USD/IDR ${nav.fx.usd_idr.toFixed(0)}` : "—"}
      />
      <Kpi
        label="Unrealized P&L"
        value={unrealValue != null ? fmtCurrency(unrealValue, currency) : "—"}
        delta={
          metrics && nav && nav.nav_idr > 0
            ? fmtPct((nav.unrealized_pnl_idr / nav.nav_idr) * 100, 2, true)
            : ""
        }
        deltaClass={signClass(nav?.unrealized_pnl_idr)}
      />
      <Kpi
        label="YTD return"
        value={metrics ? fmtPct(metrics.ytd_return_pct, 2, true) : "—"}
        hint={ytdValue != null ? fmtCurrency(ytdValue, currency) : "—"}
        deltaClass={signClass(metrics?.ytd_return_pct)}
      />
      <Kpi
        label="Gross exposure"
        value={nav ? fmtPct(nav.gross_exposure_pct, 1) : "—"}
        hint={nav ? `Net ${fmtPct(nav.net_exposure_pct, 1, true)}` : "—"}
      />
      <Kpi
        label="30D VaR (95%)"
        value={metrics ? fmtPct(metrics.var_30d_95_pct, 2) : "—"}
        hint={metrics ? `Vol ${fmtPct(metrics.vol_30d_annualized_pct, 1)}` : "—"}
        deltaClass="neg"
      />
    </div>
  );
}
