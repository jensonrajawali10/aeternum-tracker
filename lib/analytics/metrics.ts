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

// Minimum sample sizes below which the metric is pure noise — Jenson saw
// Vol (30D ann) = Vol (90D ann) = 1182% because both windows collapsed to
// the same tiny slice when nav_history was only a few days deep. Return
// NaN instead and let the frontend show "—".
const MIN_RETURNS_FOR_VOL_30D = 15;
const MIN_RETURNS_FOR_VOL_90D = 45;
const MIN_RETURNS_FOR_VAR = 15;
const MIN_PORTFOLIO_FOR_MDD = 10;

// Daily-return magnitude above which we treat the observation as a capital
// flow event, not an investment return. The firm-level 'all' NAV series
// jumps on days when a new book was funded (e.g. seeding the investing
// book mid-year) — without this filter, TWRR would falsely include that
// deposit as a +100% return.
//
// 50% is generous enough that legitimate crypto-book single-day moves
// still pass through; anything larger is almost certainly a cashflow.
const CASHFLOW_FILTER_ABS = 0.5;

function sliceFrom(
  series: { date: string; value: number }[],
  startDate: string,
): { date: string; value: number }[] {
  return series.filter((r) => r.date >= startDate);
}

/**
 * Time-weighted return with a cashflow-outlier filter. Chains daily
 * returns geometrically and skips any single-day move whose magnitude
 * exceeds CASHFLOW_FILTER_ABS — those are almost always capital
 * additions / withdrawals, not investment returns.
 *
 * Returns 0 when there aren't enough observations to compute a return.
 * Returns NaN (frontend renders "—") when the series is malformed.
 */
function timeWeightedReturn(
  series: { date: string; value: number }[],
): number {
  if (series.length < 2) return 0;
  let multiplier = 1;
  let counted = 0;
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].value;
    const curr = series[i].value;
    if (prev <= 0 || curr <= 0) continue;
    const r = curr / prev - 1;
    if (Math.abs(r) > CASHFLOW_FILTER_ABS) continue; // skip capital flows
    multiplier *= 1 + r;
    counted++;
  }
  if (counted === 0) return 0;
  return (multiplier - 1) * 100;
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
    // Also skip the portfolio's cashflow-outlier days from beta regression —
    // they'd otherwise swamp the covariance on tiny samples.
    if (Math.abs(r.r) > CASHFLOW_FILTER_ABS) continue;
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
      vol_30d_annualized_pct: NaN,
      vol_90d_annualized_pct: NaN,
      beta_vs_ihsg: null,
      beta_vs_spx: null,
      sharpe_ytd: NaN,
      sortino_ytd: NaN,
      max_drawdown_pct: NaN,
      var_30d_95_pct: NaN,
    };
  }
  const year = refDate.getFullYear();
  const ytdStart = `${year}-01-01`;
  const mtdStart = `${year}-${String(refDate.getMonth() + 1).padStart(2, "0")}-01`;
  const ytdSlice = sliceFrom(portfolio, ytdStart);
  const mtdSlice = sliceFrom(portfolio, mtdStart);

  // Time-weighted returns with cashflow filter — robust to capital flows
  // that would otherwise make firm-level 'all' YTD read 124% when books
  // were seeded incrementally through the year.
  const ytd_return_pct = timeWeightedReturn(ytdSlice);
  const mtd_return_pct = timeWeightedReturn(mtdSlice);

  // Clean the return stream for vol/sharpe/sortino — exclude cashflow days
  const returnsYtdAll = dailyReturns(ytdSlice.map((r) => r.value));
  const returnsYtd = returnsYtdAll.filter((r) => Math.abs(r) <= CASHFLOW_FILTER_ABS);
  const returnsFullAll = dailyReturns(portfolio.map((r) => r.value));
  const returnsFull = returnsFullAll.filter((r) => Math.abs(r) <= CASHFLOW_FILTER_ABS);

  const last30 = returnsFull.slice(-30);
  const last90 = returnsFull.slice(-90);
  const vol_30d_annualized_pct =
    last30.length >= MIN_RETURNS_FOR_VOL_30D
      ? annualizedVol(stdev(last30), periods) * 100
      : NaN;
  const vol_90d_annualized_pct =
    last90.length >= MIN_RETURNS_FOR_VOL_90D
      ? annualizedVol(stdev(last90), periods) * 100
      : NaN;

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
  const { mdd } =
    portfolio.length >= MIN_PORTFOLIO_FOR_MDD
      ? maxDrawdown(portfolio.map((r) => r.value))
      : { mdd: NaN };
  const var_30d_95_pct =
    last30.length >= MIN_RETURNS_FOR_VAR ? historicalVar(last30, 0.95) : NaN;

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
