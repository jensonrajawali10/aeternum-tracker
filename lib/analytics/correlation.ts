/**
 * Pairwise Pearson correlation helpers — used by the capital-allocation
 * cross-arm heatmap.  Returns a value in [-1, 1] or null if there aren't
 * enough aligned observations (need ≥ 5 to be meaningful, ≥ 20 to trust).
 */

export function pearson(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 5) return null;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return null;
  return cov / Math.sqrt(varA * varB);
}

export interface SeriesPoint {
  date: string;
  value: number;
}

/**
 * Compute aligned log-returns across multiple named series.  Aligns to
 * the intersection of dates across every series — any gap drops the
 * whole day.  Returns one return-array per series in the same order.
 */
export function alignedLogReturns(
  series: Record<string, SeriesPoint[]>,
): { dates: string[]; returns: Record<string, number[]> } {
  const names = Object.keys(series);
  if (names.length === 0) return { dates: [], returns: {} };

  // Intersection of dates (must have a value in every series)
  const dateSets = names.map((n) => new Set(series[n].map((p) => p.date)));
  const base = [...dateSets[0]].filter((d) => dateSets.every((s) => s.has(d)));
  base.sort();

  const valueMaps: Record<string, Map<string, number>> = {};
  for (const n of names) {
    const m = new Map<string, number>();
    for (const p of series[n]) m.set(p.date, p.value);
    valueMaps[n] = m;
  }

  const returns: Record<string, number[]> = {};
  for (const n of names) returns[n] = [];
  const dates: string[] = [];

  for (let i = 1; i < base.length; i++) {
    const today = base[i];
    const yest = base[i - 1];
    let ok = true;
    const rowReturns: Record<string, number> = {};
    for (const n of names) {
      const today_v = valueMaps[n].get(today);
      const yest_v = valueMaps[n].get(yest);
      if (!today_v || !yest_v || yest_v <= 0 || today_v <= 0) {
        ok = false;
        break;
      }
      rowReturns[n] = Math.log(today_v / yest_v);
    }
    if (!ok) continue;
    dates.push(today);
    for (const n of names) returns[n].push(rowReturns[n]);
  }

  return { dates, returns };
}
