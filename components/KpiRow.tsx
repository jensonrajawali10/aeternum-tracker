"use client";

import useSWR from "swr";
import { Kpi } from "./Kpi";
import { DeltaNumber } from "./shell/DeltaNumber";
import { fmtCurrency, fmtPct, fmtNumber, signClass } from "@/lib/format";

interface NavResp {
  nav_idr: number;
  nav_usd: number;
  gross_mv_idr: number;
  gross_exposure_pct: number;
  net_exposure_pct: number;
  unrealized_pnl_idr: number;
  realized_pnl_idr: number;
  realized_ytd_idr: number;
  fx: { usd_idr: number };
}

interface MetricsResp {
  ytd_return_pct: number;
  vol_30d_annualized_pct: number;
  var_30d_95_pct: number;
  sharpe_ytd: number;
}

interface BenchResp {
  dates: string[];
  nav: (number | null)[];
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
  const benchBook = book === "all" ? "" : `&book=${book}`;
  const { data: nav } = useSWR<NavResp>(`/api/portfolio/nav${bookParam}`, fetcher, {
    refreshInterval: 60_000,
  });
  const { data: metrics } = useSWR<MetricsResp>(`/api/portfolio/metrics${bookParam}`, fetcher, {
    refreshInterval: 60_000,
  });
  // YTD-window NAV history feeds the per-tile sparkline.  Same endpoint
  // as the big benchmark chart on the dashboard so SWR dedupes the
  // request when both are mounted on the same page.
  const { data: bench } = useSWR<BenchResp>(
    `/api/portfolio/benchmark?range=YTD${benchBook}`,
    fetcher,
    { refreshInterval: 120_000 },
  );

  const navSeries = bench?.nav ?? [];
  // Build a synthetic unrealised-P&L proxy from the rebased NAV series:
  // the whole-period delta from start (100) is the cumulative move; the
  // sparkline doesn't need precise units, only direction + shape.
  const unrealSeries = navSeries.map((v) => (v == null || !isFinite(v) ? null : v - 100));
  const ytdSeries = navSeries; // already YTD by construction

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

  // When a book has no open positions but cumulative realized P&L on file,
  // nav_idr collapses to pure realized-P&L.  Calling that "Portfolio NAV"
  // without context makes Jenson wonder where the cash is coming from, so
  // we swap the hint (and implicitly the mental model) to "book value is
  // cumulative realized P&L · no live positions" instead of showing the
  // FX rate as if this were a marked-to-market book.
  const isFlatBook =
    !!nav && book !== "all" && nav.gross_mv_idr === 0 && Math.abs(nav.nav_idr) > 0;
  const navHint = nav
    ? isFlatBook
      ? "no open positions · cumulative realized"
      : `USD/IDR ${nav.fx.usd_idr.toFixed(0)}`
    : "—";
  const navLabel = isFlatBook ? "Book realized P&L" : "Portfolio NAV";

  const unrealPct =
    nav && nav.nav_idr > 0 ? (nav.unrealized_pnl_idr / nav.nav_idr) * 100 : null;
  const sharpe = metrics?.sharpe_ytd;
  const sharpeFinite = sharpe != null && Number.isFinite(sharpe);
  const sharpeHint = sharpeFinite
    ? sharpe >= 1
      ? "good"
      : sharpe >= 0
        ? "fair"
        : "negative"
    : undefined;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
      <Kpi
        label={navLabel}
        value={navValue != null ? fmtCurrency(navValue, currency) : "—"}
        hint={navHint}
        sparkline={navSeries}
      />
      <Kpi
        label="Unrealized P&L"
        value={unrealValue != null ? fmtCurrency(unrealValue, currency) : "—"}
        delta={
          unrealPct != null ? (
            <DeltaNumber value={unrealPct} text={fmtPct(unrealPct, 2, true)} />
          ) : undefined
        }
        sparkline={unrealSeries}
      />
      <Kpi
        label="YTD return"
        value={
          metrics ? (
            <DeltaNumber
              value={metrics.ytd_return_pct}
              text={fmtPct(metrics.ytd_return_pct, 2, true)}
            />
          ) : (
            "—"
          )
        }
        hint={ytdValue != null ? fmtCurrency(ytdValue, currency) : "—"}
        sparkline={ytdSeries}
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
        // VaR carries its own sign — let fmtPct convey it instead of forcing red
        // on the label (would paint red on "—" during data-loading states)
        deltaClass={metrics && metrics.var_30d_95_pct < 0 ? "neg" : undefined}
      />
      <Kpi
        label="Sharpe (YTD)"
        value={
          sharpeFinite ? (
            <span className={signClass(sharpe)}>{fmtNumber(sharpe, 2)}</span>
          ) : (
            "—"
          )
        }
        hint={sharpeHint}
      />
    </div>
  );
}
