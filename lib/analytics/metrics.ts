import {
  dailyReturns,
  stdev,
  beta,
  sharpe,
  sortino,
  maxDrawdown,
  historicalVar,
  annualizedVol,
} from "./returns";

export interface RiskMetrics {
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

function sliceFrom(series: { date: string; value: number }[], startDate: string): { date: string; value: number }[] {
  return series.filter((r) => r.date >= startDate);
}

function alignReturns(
  port: { date: string; value: number }[],
  bench: { date: string; value: number }[],
): { p: number[]; b: number[] } {
  const bMap = new Map(bench.map((r) => [r.date, r.value]));
  const aligned = port.filter((r) => bMap.has(r.date));
  const pVals = aligned.map((r) => r.value);
  const bVals = aligned.map((r) => bMap.get(r.date)!);
  return { p: dailyReturns(pVals), b: dailyReturns(bVals) };
}

export function computeMetrics(
  portfolio: { date: string; value: number }[],
  ihsg?: { date: string; value: number }[],
  spx?: { date: string; value: number }[],
  refDate: Date = new Date(),
): RiskMetrics {
  if (!portfolio.length) {
    return {
      ytd_return_pct: 0,
      mtd_return_pct: 0,
      vol_30d_annualized_pct: 0,
      vol_90d_annualized_pct: 0,
      beta_vs_ihsg: null,
      beta_vs_spx: null,
      sharpe_ytd: 0,
      sortino_ytd: 0,
      max_drawdown_pct: 0,
      var_30d_95_pct: 0,
    };
  }
  const year = refDate.getFullYear();
  const ytdStart = `${year}-01-01`;
  const mtdStart = `${year}-${String(refDate.getMonth() + 1).padStart(2, "0")}-01`;
  const ytdSlice = sliceFrom(portfolio, ytdStart);
  const mtdSlice = sliceFrom(portfolio, mtdStart);
  const ytd_return_pct =
    ytdSlice.length >= 2 ? (ytdSlice[ytdSlice.length - 1].value / ytdSlice[0].value - 1) * 100 : 0;
  const mtd_return_pct =
    mtdSlice.length >= 2 ? (mtdSlice[mtdSlice.length - 1].value / mtdSlice[0].value - 1) * 100 : 0;
  const returnsYtd = dailyReturns(ytdSlice.map((r) => r.value));
  const returnsFull = dailyReturns(portfolio.map((r) => r.value));
  const last30 = returnsFull.slice(-30);
  const last90 = returnsFull.slice(-90);
  const vol_30d_annualized_pct = annualizedVol(stdev(last30), 252) * 100;
  const vol_90d_annualized_pct = annualizedVol(stdev(last90), 252) * 100;
  let beta_vs_ihsg: number | null = null;
  let beta_vs_spx: number | null = null;
  if (ihsg && ihsg.length) {
    const { p, b } = alignReturns(portfolio, ihsg);
    beta_vs_ihsg = p.length >= 30 ? beta(p, b) : null;
  }
  if (spx && spx.length) {
    const { p, b } = alignReturns(portfolio, spx);
    beta_vs_spx = p.length >= 30 ? beta(p, b) : null;
  }
  const sharpe_ytd = sharpe(returnsYtd);
  const sortino_ytd = sortino(returnsYtd);
  const { mdd } = maxDrawdown(portfolio.map((r) => r.value));
  const var_30d_95_pct = historicalVar(last30, 0.95);
  return {
    ytd_return_pct,
    mtd_return_pct,
    vol_30d_annualized_pct,
    vol_90d_annualized_pct,
    beta_vs_ihsg,
    beta_vs_spx,
    sharpe_ytd,
    sortino_ytd,
    max_drawdown_pct: mdd,
    var_30d_95_pct,
  };
}
