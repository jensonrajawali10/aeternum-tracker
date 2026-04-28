"use client";

import useSWR from "swr";
import { DeltaNumber } from "./shell/DeltaNumber";
import { fmtNumber, fmtPct } from "@/lib/format";

interface Quote {
  symbol: string;
  price: number | null;
  change_pct: number | null;
  currency: string | null;
}

interface QuotesResp {
  quotes: Quote[];
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`quotes ${r.status}`);
    return r.json();
  });

// Display label per symbol — Yahoo's tickers carry exchange suffixes /
// caret prefixes that aren't useful at the chrome level. JCI / SPX /
// DXY / UST10Y read more cleanly on a Bloomberg-style strip.
const SYMBOL_LABELS: Record<string, string> = {
  "^JKSE": "JCI",
  "BBCA.JK": "BBCA",
  "BBRI.JK": "BBRI",
  "TLKM.JK": "TLKM",
  "MAPB.JK": "MAPB",
  "^GSPC": "SPX",
  "DX-Y.NYB": "DXY",
  "^TNX": "UST10Y",
  BTC: "BTC",
  ETH: "ETH",
  SOL: "SOL",
};

function labelFor(symbol: string): string {
  return SYMBOL_LABELS[symbol] ?? symbol;
}

function priceDecimals(symbol: string, currency: string | null): number {
  // ^TNX is a yield (4.32%); JCI is points (8000-ish); FX-style DXY 100-ish.
  // Equities + crypto sit at 0–2 dp which fmtNumber 2 covers. Yields keep 2.
  if (symbol === "^TNX") return 2;
  if (currency === "IDR") return 0;
  return 2;
}

/**
 * TickerTape — desktop-only horizontal scroll strip mounted between the
 * TopBar and the sidebar+main row.  Pulls quotes from the data agent's
 * /api/quotes endpoint (sister-agent-owned) and loops them via a CSS
 * keyframe so the page reads as a live trading workstation.
 *
 * Accessibility:
 *   - hidden md:block — the mobile chrome owns its own market state row.
 *   - prefers-reduced-motion: pauses the keyframe scroll (see globals.css).
 *   - Hover pauses scroll so an operator can read a label cleanly.
 *
 * If /api/quotes 404s mid-build, render a single muted "PROBING TICKERS…"
 * row so the layout doesn't collapse on Vercel previews.
 */
export function TickerTape() {
  const { data, error } = useSWR<QuotesResp>("/api/quotes", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
    keepPreviousData: true,
    shouldRetryOnError: false,
  });

  const quotes = data?.quotes ?? [];
  const probing = !data && !error;

  // Empty / probing / error → a single muted line so layout stays steady.
  if (quotes.length === 0) {
    return (
      <div
        className="hidden md:flex items-center px-4 border-b overflow-hidden"
        style={{
          height: 22,
          borderColor: "var(--color-border)",
          background: "var(--color-panel-2)",
        }}
      >
        <span
          className="mono uppercase text-muted-2"
          style={{ fontSize: 10, letterSpacing: "0.14em" }}
        >
          {probing ? "Probing tickers…" : "Ticker feed offline"}
        </span>
      </div>
    );
  }

  // Render the quote list TWICE side-by-side so the keyframe can scroll
  // by translateX(-50%) and loop seamlessly without a visible reset.
  return (
    <div
      className="hidden md:block border-b overflow-hidden"
      style={{
        height: 22,
        borderColor: "var(--color-border)",
        background: "var(--color-panel-2)",
      }}
    >
      <div
        className="ae-ticker-tape flex items-center whitespace-nowrap"
        style={{ height: 22 }}
      >
        {[0, 1].map((dup) => (
          <div key={dup} className="flex items-center shrink-0">
            {quotes.map((q, i) => (
              <TickerItem key={`${dup}-${q.symbol}-${i}`} quote={q} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TickerItem({ quote }: { quote: Quote }) {
  const label = labelFor(quote.symbol);
  const dec = priceDecimals(quote.symbol, quote.currency);
  const priceStr = quote.price != null ? fmtNumber(quote.price, dec) : "—";
  const pct = quote.change_pct;
  const pctStr = pct != null ? fmtPct(pct, 2, true) : "—";

  return (
    <div className="flex items-center gap-1.5 shrink-0 px-3 border-r" style={{ borderColor: "var(--color-border)" }}>
      <span
        className="mono uppercase text-muted-2"
        style={{ fontSize: 10, letterSpacing: "0.10em" }}
      >
        {label}
      </span>
      <span
        className="mono text-fg"
        style={{ fontSize: 10.5 }}
      >
        {priceStr}
      </span>
      {pct != null ? (
        <DeltaNumber
          value={pct}
          text={pctStr}
          className="text-[10px]"
        />
      ) : (
        <span className="mono text-muted-2" style={{ fontSize: 10 }}>
          —
        </span>
      )}
    </div>
  );
}
