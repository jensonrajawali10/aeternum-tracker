"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { AssetBadge } from "@/components/Badge";
import { fmtNumber, fmtPct, fmtDate, signClass } from "@/lib/format";
import type { AssetClass } from "@/lib/types";

interface Item {
  id: string;
  ticker: string;
  asset_class: AssetClass;
  notes: string | null;
  added_at: string;
}

interface Quote {
  price: number;
  day_change_pct: number | null;
  currency: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function WatchRow({ item, onDelete }: { item: Item; onDelete: () => void }) {
  const { data: quote } = useSWR<Quote>(
    `/api/prices/${encodeURIComponent(item.ticker)}?asset_class=${item.asset_class}`,
    fetcher,
    { refreshInterval: 60_000 },
  );
  return (
    <tr className="border-b border-border hover:bg-hover">
      <td className="py-[7px] px-2 font-medium">{item.ticker}</td>
      <td className="py-[7px] px-2"><AssetBadge cls={item.asset_class} /></td>
      <td className="py-[7px] px-2 text-right tabular-nums">
        {quote?.price != null ? fmtNumber(quote.price, item.asset_class === "idx_equity" ? 0 : 2) : "—"}
      </td>
      <td className={`py-[7px] px-2 text-right tabular-nums ${signClass(quote?.day_change_pct)}`}>
        {quote?.day_change_pct != null ? fmtPct(quote.day_change_pct, 2, true) : "—"}
      </td>
      <td className="py-[7px] px-2 text-[11px] text-muted">{item.notes || "—"}</td>
      <td className="py-[7px] px-2 text-[11px] text-muted">{fmtDate(item.added_at, { month: "short", day: "numeric" })}</td>
      <td className="py-[7px] px-2 text-right">
        <button onClick={onDelete} className="text-[11px] text-muted hover:text-red">
          Remove
        </button>
      </td>
    </tr>
  );
}

export function WatchlistManager() {
  const { data } = useSWR<{ items: Item[] }>("/api/watchlist", fetcher);
  const [ticker, setTicker] = useState("");
  const [assetClass, setAssetClass] = useState<AssetClass>("idx_equity");
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker.trim()) return;
    setAdding(true);
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: ticker.trim(), asset_class: assetClass, notes: notes.trim() || null }),
    });
    setAdding(false);
    setTicker("");
    setNotes("");
    mutate("/api/watchlist");
  }

  async function remove(id: string) {
    await fetch(`/api/watchlist?id=${id}`, { method: "DELETE" });
    mutate("/api/watchlist");
  }

  return (
    <div>
      <form onSubmit={add} className="flex flex-wrap items-end gap-2 mb-4 p-3 bg-panel-2 rounded border border-border">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Ticker</label>
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="BBRI / AAPL / BTC"
            className="text-[12px]"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Class</label>
          <select value={assetClass} onChange={(e) => setAssetClass(e.target.value as AssetClass)} className="text-[12px]">
            <option value="idx_equity">IDX Equity</option>
            <option value="us_equity">US Equity</option>
            <option value="crypto">Crypto</option>
            <option value="fx">FX</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full text-[12px]" />
        </div>
        <button
          type="submit"
          disabled={adding}
          className="bg-accent text-bg px-3 py-[6px] rounded text-[11px] font-semibold uppercase tracking-wider disabled:opacity-60"
        >
          {adding ? "…" : "Add"}
        </button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-muted text-[10px] uppercase tracking-wider border-b border-border">
              <th className="py-2 px-2 text-left font-normal">Ticker</th>
              <th className="py-2 px-2 text-left font-normal">Class</th>
              <th className="py-2 px-2 text-right font-normal">Last</th>
              <th className="py-2 px-2 text-right font-normal">Day%</th>
              <th className="py-2 px-2 text-left font-normal">Notes</th>
              <th className="py-2 px-2 text-left font-normal">Added</th>
              <th className="py-2 px-2 text-right font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).map((it) => (
              <WatchRow key={it.id} item={it} onDelete={() => remove(it.id)} />
            ))}
            {!data?.items?.length && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-muted">
                  No watchlist items yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
