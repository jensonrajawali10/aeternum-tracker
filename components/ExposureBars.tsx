"use client";

import useSWR from "swr";
import { fmtPct } from "@/lib/format";
import type { AssetClass, BookType } from "@/lib/types";

interface Position {
  asset_class: AssetClass;
  book: BookType;
  currency: "IDR" | "USD";
  market_value_idr: number | null;
}

interface PositionsResp {
  positions: Position[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const BOOK_LABEL: Record<BookType, string> = {
  investing: "Investing",
  idx_trading: "IDX trades",
  crypto_trading: "Crypto",
  other: "Other",
};

const ASSET_LABEL: Record<AssetClass, string> = {
  idx_equity: "IDX equity",
  us_equity: "US equity",
  crypto: "Crypto",
  fx: "FX",
  other: "Other",
};

/* Monochrome bars. Largest slice gets violet accent, the rest cascade through
   the elevated/muted greys to preserve visual hierarchy without palette noise. */
const BAR_TIERS = [
  "bg-accent",   // #8B5CF6 — top bar
  "bg-[#A1A1AA]", // muted — second
  "bg-[#6B6B73]", // tertiary — third
  "bg-border-2",  // #2E2E34 — fourth
];

function Row({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-muted">{label}</span>
        <span className="mono text-fg">{fmtPct(pct, 1)}</span>
      </div>
      <div className="h-[4px] bg-elevated rounded-[2px] overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

export function ExposureBars({ book }: { book: string }) {
  const bookParam = book === "all" ? "" : `?book=${book}`;
  const { data } = useSWR<PositionsResp>(`/api/positions${bookParam}`, fetcher, {
    refreshInterval: 60_000,
  });
  const positions = data?.positions ?? [];
  const total = positions.reduce((a, p) => a + Math.abs(p.market_value_idr || 0), 0);

  const groupBy = <K extends string>(fn: (p: Position) => K): [K, number][] => {
    const out = new Map<K, number>();
    positions.forEach((p) => {
      const k = fn(p);
      out.set(k, (out.get(k) || 0) + Math.abs(p.market_value_idr || 0));
    });
    // sort largest first so tier 0 (violet) always goes to biggest slice
    return [...out.entries()].sort((a, b) => b[1] - a[1]);
  };

  const byBook = groupBy((p) => p.book);
  const byAsset = groupBy((p) => p.asset_class);
  const byCcy = groupBy((p) => p.currency);

  return (
    <div className="grid gap-4">
      <div>
        <div className="text-[11px] text-muted mb-2">By book</div>
        <div className="space-y-2">
          {byBook.map(([k, v], i) => (
            <Row
              key={k}
              label={BOOK_LABEL[k as BookType] || k}
              pct={total > 0 ? (v / total) * 100 : 0}
              color={BAR_TIERS[i] || BAR_TIERS[BAR_TIERS.length - 1]}
            />
          ))}
          {!positions.length && <div className="text-muted text-[11px]">No exposure</div>}
        </div>
      </div>
      <div>
        <div className="text-[11px] text-muted mb-2">By asset class</div>
        <div className="space-y-2">
          {byAsset.map(([k, v], i) => (
            <Row
              key={k}
              label={ASSET_LABEL[k as AssetClass] || k}
              pct={total > 0 ? (v / total) * 100 : 0}
              color={BAR_TIERS[i] || BAR_TIERS[BAR_TIERS.length - 1]}
            />
          ))}
        </div>
      </div>
      <div>
        <div className="text-[11px] text-muted mb-2">By currency</div>
        <div className="space-y-2">
          {byCcy.map(([k, v], i) => (
            <Row
              key={k}
              label={k}
              pct={total > 0 ? (v / total) * 100 : 0}
              color={BAR_TIERS[i] || BAR_TIERS[BAR_TIERS.length - 1]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
