export function dailyReturns(series: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    if (prev > 0) out.push(series[i] / prev - 1);
  }
  return out;
}

export function logReturns(series: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    if (prev > 0 && series[i] > 0) out.push(Math.log(series[i] / prev));
  }
  return out;
}

export function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
  return Math.sqrt(v);
}

export function covariance(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let s = 0;
  for (let i = 0; i < n; i++) s += (xs[i] - mx) * (ys[i] - my);
  return s / (n - 1);
}

export function correlation(xs: number[], ys: number[]): number {
  const sx = stdev(xs);
  const sy = stdev(ys);
  if (sx === 0 || sy === 0) return 0;
  return covariance(xs, ys) / (sx * sy);
}

export function beta(portfolioReturns: number[], benchmarkReturns: number[]): number {
  const varB = stdev(benchmarkReturns) ** 2;
  if (varB === 0) return 0;
  return covariance(portfolioReturns, benchmarkReturns) / varB;
}

export function annualize(daily: number, periods: number = 252): number {
  return daily * periods;
}

export function annualizedVol(daily: number, periods: number = 252): number {
  return daily * Math.sqrt(periods);
}

export function sharpe(returns: number[], riskFreeDaily: number = 0, periods: number = 252): number {
  const excess = returns.map((r) => r - riskFreeDaily);
  const s = stdev(excess);
  if (s === 0) return 0;
  return (mean(excess) / s) * Math.sqrt(periods);
}

export function sortino(returns: number[], riskFreeDaily: number = 0, periods: number = 252): number {
  const excess = returns.map((r) => r - riskFreeDaily);
  const negs = excess.filter((r) => r < 0);
  if (!negs.length) return 0;
  const downsideDev = Math.sqrt(negs.reduce((a, b) => a + b * b, 0) / negs.length);
  if (downsideDev === 0) return 0;
  return (mean(excess) / downsideDev) * Math.sqrt(periods);
}

export function maxDrawdown(series: number[]): { mdd: number; peak_idx: number; trough_idx: number } {
  if (!series.length) return { mdd: 0, peak_idx: 0, trough_idx: 0 };
  let peak = series[0];
  let peakIdx = 0;
  let mdd = 0;
  let troughIdx = 0;
  let mddPeakIdx = 0;
  for (let i = 1; i < series.length; i++) {
    if (series[i] > peak) {
      peak = series[i];
      peakIdx = i;
    }
    const dd = (series[i] - peak) / peak;
    if (dd < mdd) {
      mdd = dd;
      troughIdx = i;
      mddPeakIdx = peakIdx;
    }
  }
  return { mdd: mdd * 100, peak_idx: mddPeakIdx, trough_idx: troughIdx };
}

export function rollingVol(returns: number[], window: number = 30, periods: number = 252): number[] {
  const out: number[] = [];
  for (let i = window; i <= returns.length; i++) {
    out.push(annualizedVol(stdev(returns.slice(i - window, i)), periods) * 100);
  }
  return out;
}

export function historicalVar(returns: number[], confidence: number = 0.95): number {
  if (!returns.length) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const idx = Math.floor((1 - confidence) * sorted.length);
  return sorted[idx] * 100;
}

export function rebaseToHundred(series: number[]): number[] {
  if (!series.length) return [];
  const base = series[0];
  if (!base) return series.map(() => 100);
  return series.map((v) => (v / base) * 100);
}
