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

/**
 * Compute daily returns on the FULL series first, then pair returns by date.
 *
 * The old implementation filtered port to dates present in bench BEFORE
 * computing returns — so if Friday's bench close was missing from the
 * portfolio table, the port's Fri→Mon return became a 3-calendar-day return
 * paired against bench's (separate) 1-day return. That systematically biased β
 * upward on thinly-traded weekends/holidays. Now we compute returns on each
 * series in its native cadence, then intersect on the return-date (day t paired
 * with day t) before regressing.
 */
function alignReturns(
  port: { date: string; value: number }[],
  bench: { date: string; value: number }[],
): { p: number[]; b: number[] } {
  // Compute returns with the date attached to the "to" end of each step
  const portR: { date: string; r: number }[] = [];
  for (let i = 1; i < port.length; i++) {
    const prev = port[i - 1].value;
    if (prev > 0) portR.push({ date: port[i].date, r: port[i].value / prev - 1 });
  }
  const benchR = new Map<string, number>();
  for (let i = 1; i < bench.length; i++) {
    const prev = bench[i - 1].value;
    if (prev > 0) benchR.set(bench[i].date, bench[i].value / prev - 1);
  }
  const p: number[] = [];
  const b: number[] = [];
  for (const r of portR) {
    const br = benchR.get(r.date);
    if (br == null) continue;
    p.push(r.r);
    b.push(br);
  }
  return { p, b };
}

export function computeMetrics(
  portfolio: { date: string; value: number }[],
  ihsg?: { date: string; value: number }[],
  spx?: { date: string; value: number }[],
  refDate: Date = new Date(),
  /**
   * Annualization periods — 252 for equity books (IDX/US; 5d trading weeks),
   * 365 for crypto (24/7 market). Pass from caller based on book scope.
   * Using 252 for crypto underestimates vol by √(365/252) ≈ 1.20×.
   */
  periods: number = 252,
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
  const vol_30d_annualized_pct = annualizedVol(stdev(last30), periods) * 100;
  const vol_90d_annualized_pct = annualizedVol(stdev(last90), periods) * 100;
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
  const sharpe_ytd = sharpe(returnsYtd, 0, periods);
  const sortino_ytd = sortino(returnsYtd, 0, periods);
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
