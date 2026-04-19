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
  idx_trading: "IDX Trading",
  crypto_trading: "Crypto",
  other: "Other",
};

const ASSET_LABEL: Record<AssetClass, string> = {
  idx_equity: "IDX Equity",
  us_equity: "US Equity",
  crypto: "Crypto",
  fx: "FX",
  other: "Other",
};

const COLORS: Record<string, string> = {
  investing: "bg-teal-500",
  idx_trading: "bg-blue-500",
  crypto_trading: "bg-amber-500",
  other: "bg-slate-500",
  idx_equity: "bg-blue-500",
  us_equity: "bg-green-500",
  crypto: "bg-amber-500",
  fx: "bg-purple-500",
  IDR: "bg-blue-500",
  USD: "bg-green-500",
};

function Row({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums">{fmtPct(pct, 1)}</span>
      </div>
      <div className="h-[6px] bg-panel-2 rounded overflow-hidden">
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

  const groupBy = <K extends string>(fn: (p: Position) => K): Record<K, number> => {
    const out = {} as Record<K, number>;
    positions.forEach((p) => {
      const k = fn(p);
      out[k] = (out[k] || 0) + Math.abs(p.market_value_idr || 0);
    });
    return out;
  };

  const byBook = groupBy((p) => p.book);
  const byAsset = groupBy((p) => p.asset_class);
  const byCcy = groupBy((p) => p.currency);

  return (
    <div className="grid gap-4">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted mb-2">By Book</div>
        <div className="space-y-2">
          {Object.entries(byBook).map(([k, v]) => (
            <Row
              key={k}
              label={BOOK_LABEL[k as BookType] || k}
              pct={total > 0 ? (v / total) * 100 : 0}
              color={COLORS[k] || "bg-slate-500"}
            />
          ))}
          {!positions.length && <div className="text-muted text-[11px]">No exposure</div>}
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted mb-2">By Asset Class</div>
        <div className="space-y-2">
          {Object.entries(byAsset).map(([k, v]) => (
            <Row
              key={k}
              label={ASSET_LABEL[k as AssetClass] || k}
              pct={total > 0 ? (v / total) * 100 : 0}
              color={COLORS[k] || "bg-slate-500"}
            />
          ))}
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted mb-2">By Currency</div>
        <div className="space-y-2">
          {Object.entries(byCcy).map(([k, v]) => (
            <Row key={k} label={k} pct={total > 0 ? (v / total) * 100 : 0} color={COLORS[k] || "bg-slate-500"} />
          ))}
        </div>
      </div>
    </div>
  );
}
