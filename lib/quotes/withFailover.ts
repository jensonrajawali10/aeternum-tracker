/**
 * Tiny primary/fallback wrapper for quote providers.
 *
 * Tries `primary()`; if it throws or returns null/undefined, calls `fallback()`.
 * Used by /api/quotes for any symbol where Yahoo flakes — CoinGecko is already
 * inline for crypto, but this is the pattern for future Stooq / Twelve Data
 * failovers without bolting branching into each call site.
 *
 * Signature is intentionally minimal — no timeout, no retries, no logging.
 * The caller wraps its own AbortController and logs at the route layer.
 */
export async function withFailover<T>(
  primary: () => Promise<T | null | undefined>,
  fallback: () => Promise<T | null | undefined>,
): Promise<T | null> {
  try {
    const a = await primary();
    if (a != null) return a;
  } catch {
    // primary failed — fall through to fallback
  }
  try {
    const b = await fallback();
    return b ?? null;
  } catch {
    return null;
  }
}
