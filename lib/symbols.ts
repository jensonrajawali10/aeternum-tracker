/**
 * Aeternum canonical symbol normalization.
 *
 * Per AETERNUM_DATA_SOURCES.md — "Symbol normalization is the silent killer."
 * Each upstream uses its own conventions:
 *   - Yahoo: "BBCA.JK", "AAPL", "BTC-USD", "^JKSE", "^TNX", "DX-Y.NYB"
 *   - CoinGecko: "bitcoin", "ethereum", "solana"
 *   - Finnhub: "AAPL", "BBCA.JK"
 *
 * We carry around a small AeternumSymbol record and convert at the edge.
 * This file intentionally only covers the 11 ticker-tape symbols + a few
 * common IDX names so the redesign agent has something stable to call
 * against. Existing call sites (lib/prices/*) are unchanged — they migrate
 * over time, not in one pass.
 */
export type AeternumAssetClass =
  | "idx_equity"
  | "us_equity"
  | "crypto"
  | "fx"
  | "macro"
  | "commodity";

export interface AeternumSymbol {
  class: AeternumAssetClass;
  /** Canonical bare code, e.g. "BBCA", "AAPL", "BTC", "USDIDR", "UST10Y". */
  code: string;
}

// CoinGecko id table — keep in sync with lib/prices/crypto.ts COMMON_MAP.
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
};

// Macro symbols that map to a Yahoo index ticker.
// UST10Y is a Yahoo treasury yield (^TNX); DXY is the ICE dollar index (DX-Y.NYB).
const MACRO_TO_YAHOO: Record<string, string> = {
  UST10Y: "^TNX",
  DXY: "DX-Y.NYB",
  JKSE: "^JKSE",
  GSPC: "^GSPC",
};

// Reverse table for fromYahoo() so a Yahoo string round-trips back into an
// AeternumSymbol. Built lazily because TS prefers explicit invariants.
const YAHOO_TO_MACRO: Record<string, { class: AeternumAssetClass; code: string }> = {
  "^TNX": { class: "macro", code: "UST10Y" },
  "DX-Y.NYB": { class: "macro", code: "DXY" },
  "^JKSE": { class: "macro", code: "JKSE" },
  "^GSPC": { class: "macro", code: "GSPC" },
};

/**
 * Convert an AeternumSymbol to its Yahoo Finance ticker form.
 * IDX equities get the .JK suffix; US equities pass through; crypto becomes
 * "{CODE}-USD" (Yahoo's spot convention); FX becomes "{PAIR}=X".
 */
export function toYahoo(sym: AeternumSymbol): string {
  const code = sym.code.toUpperCase();
  switch (sym.class) {
    case "idx_equity":
      return `${code}.JK`;
    case "us_equity":
      return code;
    case "crypto":
      return `${code}-USD`;
    case "fx":
      // "USDIDR" -> "USDIDR=X"; if the caller passes "USD/IDR" strip the slash.
      return `${code.replace("/", "")}=X`;
    case "macro":
      return MACRO_TO_YAHOO[code] || code;
    case "commodity":
      // Commodities on Yahoo use suffixes like "GC=F" (gold) — caller should
      // pass the contract code already (e.g. code: "GC=F").
      return code;
  }
}

/**
 * Convert to CoinGecko id when applicable; null for non-crypto.
 * Falls back to a lowercased code if not in the COINGECKO_IDS table — most
 * common tickers map cleanly that way (e.g. "DOGE" -> "dogecoin" doesn't, so
 * extend the table when you add a new symbol).
 */
export function toCoinGecko(sym: AeternumSymbol): string | null {
  if (sym.class !== "crypto") return null;
  const code = sym.code.toUpperCase();
  return COINGECKO_IDS[code] || null;
}

/**
 * Convert to a Finnhub-compatible symbol. Finnhub uses the same .JK suffix as
 * Yahoo for IDX, and bare codes for US equities. Crypto/macro are out of
 * scope for Finnhub in our current setup.
 */
export function toFinnhub(sym: AeternumSymbol): string {
  const code = sym.code.toUpperCase();
  switch (sym.class) {
    case "idx_equity":
      return `${code}.JK`;
    case "us_equity":
      return code;
    case "crypto":
      // Finnhub crypto uses "BINANCE:BTCUSDT"-style prefixed symbols; default to that.
      return `BINANCE:${code}USDT`;
    default:
      return code;
  }
}

/**
 * Best-effort reverse mapping from a Yahoo symbol back into an AeternumSymbol.
 * Returns null when the input doesn't match any known shape — the caller
 * decides whether to fall back to a default.
 */
export function fromYahoo(y: string): AeternumSymbol | null {
  if (!y) return null;
  const trimmed = y.trim();
  if (!trimmed) return null;

  // Macro / index lookup first — these are exact strings.
  if (YAHOO_TO_MACRO[trimmed]) {
    const m = YAHOO_TO_MACRO[trimmed];
    return { class: m.class, code: m.code };
  }

  // IDX equities: ".JK" suffix
  if (trimmed.endsWith(".JK")) {
    return { class: "idx_equity", code: trimmed.slice(0, -3).toUpperCase() };
  }

  // Crypto: "BTC-USD"
  const cryptoMatch = trimmed.match(/^([A-Z0-9]+)-USD$/i);
  if (cryptoMatch) {
    return { class: "crypto", code: cryptoMatch[1].toUpperCase() };
  }

  // FX: "USDIDR=X"
  const fxMatch = trimmed.match(/^([A-Z]{6})=X$/i);
  if (fxMatch) {
    return { class: "fx", code: fxMatch[1].toUpperCase() };
  }

  // Caret-prefixed indices we didn't catch above — bucket as macro so the UI
  // can still render them, even if we don't have a canonical short code.
  if (trimmed.startsWith("^")) {
    return { class: "macro", code: trimmed };
  }

  // Default: assume a US equity ticker.
  if (/^[A-Z][A-Z0-9.\-]*$/i.test(trimmed)) {
    return { class: "us_equity", code: trimmed.toUpperCase() };
  }

  return null;
}
