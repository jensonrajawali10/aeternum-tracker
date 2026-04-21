import { dailyReturns, mean } from "./returns";

export interface AlphaPoint {
  date: string;
  alpha_bps: number;
}

/**
 * Rolling "alpha" = simple excess daily return vs benchmark.
 *
 * Why not Jensen's alpha (mean(pR) - β·mean(bR))? When β is fit by OLS on the
 * SAME window used for the alpha calc, there's an algebraic identity that
 * forces mean(pR) - β·mean(bR) → 0. The chart was printing ~0 bps every day
 * regardless of actual outperformance — a sneaky bug that masked real alpha.
 *
 * The honest, interpretable metric for a concentrated equity book is just
 * excess return: "how much did I beat the benchmark per day." Beta-adjusted
 * alpha requires an out-of-sample β, which is a bigger refactor and not what
 * we want on a 30-day window for a small-cap book anyway (β is noisy on short
 * windows).
 */
export function rollingAlpha(
  portfolio: { date: string; value: number }[],
  benchmark: { date: string; value: number }[],
  window: number = 30,
): AlphaPoint[] {
  const bMap = new Map(benchmark.map((r) => [r.date, r.value]));
  const aligned: { date: string; p: number; b: number }[] = [];
  for (const row of portfolio) {
    const bv = bMap.get(row.date);
    if (bv != null) aligned.push({ date: row.date, p: row.value, b: bv });
  }
  const out: AlphaPoint[] = [];
  for (let i = window; i < aligned.length; i++) {
    const slice = aligned.slice(i - window, i + 1);
    const pR = dailyReturns(slice.map((x) => x.p));
    const bR = dailyReturns(slice.map((x) => x.b));
    if (pR.length !== bR.length || !pR.length) continue;
    const alphaDaily = mean(pR) - mean(bR);
    out.push({ date: aligned[i].date, alpha_bps: alphaDaily * 10000 });
  }
  return out;
}

export interface AlphaAttribution {
  ytd_alpha_pct: number;
  info_ratio: number;
  days_outperform_pct: number;
  active_vol_pct: number;
  hit_rate_pct: number;
}

export function computeAttribution(
  portfolio: { date: string; value: number }[],
  benchmark: { date: string; value: number }[],
  windowStart?: string,
): AlphaAttribution {
  const bMap = new Map(benchmark.map((r) => [r.date, r.value]));
  const aligned: { date: string; p: number; b: number }[] = [];
  for (const row of portfolio) {
    if (windowStart && row.date < windowStart) continue;
    const bv = bMap.get(row.date);
    if (bv != null) aligned.push({ date: row.date, p: row.value, b: bv });
  }
  if (aligned.length < 2) {
    return { ytd_alpha_pct: 0, info_ratio: 0, days_outperform_pct: 0, active_vol_pct: 0, hit_rate_pct: 0 };
  }
  const pR = dailyReturns(aligned.map((x) => x.p));
  const bR = dailyReturns(aligned.map((x) => x.b));
  const activeR = pR.map((r, i) => r - (bR[i] ?? 0));
  const pTotal = aligned[aligned.length - 1].p / aligned[0].p - 1;
  const bTotal = aligned[aligned.length - 1].b / aligned[0].b - 1;
  const ytd_alpha_pct = (pTotal - bTotal) * 100;
  const m = activeR.reduce((a, b) => a + b, 0) / activeR.length;
  const sd = Math.sqrt(activeR.reduce((a, b) => a + (b - m) * (b - m), 0) / Math.max(1, activeR.length - 1));
  // NB: 252 is correct for equity books (IDX + US). Crypto books should pass
  // their own attribution via a book-aware caller; the current callers are
  // already book-filtered before they reach here.
  const info_ratio = sd === 0 ? 0 : (m / sd) * Math.sqrt(252);
  const active_vol_pct = sd * Math.sqrt(252) * 100;
  const outperform = activeR.filter((r) => r > 0).length;
  const days_outperform_pct = (outperform / activeR.length) * 100;
  const positiveActive = activeR.filter((r) => r > 0).length;
  const hit_rate_pct = (positiveActive / activeR.length) * 100;
  return { ytd_alpha_pct, info_ratio, days_outperform_pct, active_vol_pct, hit_rate_pct };
}
