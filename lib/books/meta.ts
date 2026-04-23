import type { BookType } from "@/lib/types";

/**
 * Canonical book metadata for the /books/[slug] workspaces.  Slugs use
 * hyphens for URL friendliness; `book` is the internal enum value that
 * matches `trades.book` in Supabase + BookType everywhere else.
 *
 * Mandate / PM / risk budget are placeholders — Jenson overrides these
 * per firm policy.  They live here so the Notes tab, the book header,
 * and the Capital Allocation page stay in sync from a single source.
 */

export type BookSlug = "investing" | "idx-trading" | "crypto-trading";

export interface BookMeta {
  slug: BookSlug;
  book: BookType;
  title: string;
  subtitle: string;
  mandate: string;
  pm: string;
  risk_budget_pct: number;
  time_horizon: string;
  benchmark: string;
}

export const BOOKS: Record<BookSlug, BookMeta> = {
  investing: {
    slug: "investing",
    book: "investing",
    title: "Investing",
    subtitle: "Long-term conviction · fundamental IDX + global equities",
    mandate: "Long-term compounders with clear moats. Fundamental theses, multi-quarter hold.",
    pm: "Jenson",
    risk_budget_pct: 60,
    time_horizon: "12–36 months",
    benchmark: "JCI + S&P 500",
  },
  "idx-trading": {
    slug: "idx-trading",
    book: "idx_trading",
    title: "IDX Trading",
    subtitle: "Short-horizon alpha on IDX composite constituents",
    mandate: "Event-driven + technical alpha on IDX names. Intraday to multi-day hold.",
    pm: "External IDX trader",
    risk_budget_pct: 15,
    time_horizon: "Intraday – 2 weeks",
    benchmark: "JCI",
  },
  "crypto-trading": {
    slug: "crypto-trading",
    book: "crypto_trading",
    title: "Crypto Trading",
    subtitle: "Hyperliquid directional + market-neutral strategies",
    mandate: "Hyperliquid perps + spot. Directional and funding-rate basis trades.",
    pm: "Jenson",
    risk_budget_pct: 25,
    time_horizon: "Intraday – 1 month",
    benchmark: "BTC",
  },
};

export function getBookMeta(slug: string): BookMeta | null {
  return BOOKS[slug as BookSlug] ?? null;
}

export function isValidBookSlug(slug: string): slug is BookSlug {
  return slug in BOOKS;
}
