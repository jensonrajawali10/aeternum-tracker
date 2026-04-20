"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { AssetBadge } from "@/components/Badge";
import { fmtNumber, fmtPct, signClass } from "@/lib/format";
import type { AssetClass, BookType } from "@/lib/types";

interface Holding {
  id: string;
  ticker: string;
  asset_class: AssetClass;
  book: BookType;
  quantity: number;
  avg_cost: number;
  cost_currency: string;
  notes: string | null;
  opened_at: string | null;
}

interface Quote {
  price: number;
  day_change_pct: number | null;
  currency: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function HoldingRow({ h, onDelete }: { h: Holding; onDelete: () => void }) {
  const { data: quote } = useSWR<Quote>(
    `/api/prices/${encodeURIComponent(h.ticker)}?asset_class=${h.asset_class}`,
    fetcher,
    { refreshInterval: 60_000 },
  );
  const mkt = quote?.price ?? null;
  const mktVal = mkt != null ? mkt * Number(h.quantity) : null;
  const costBasis = Number(h.avg_cost) * Number(h.quantity);
  const upl = mktVal != null ? mktVal - costBasis : null;
  const uplPct = mktVal != null && costBasis > 0 ? ((mktVal - costBasis) / costBasis) * 100 : null;
  const decimals = h.asset_class === "idx_equity" ? 0 : 2;

  return (
    <tr className="border-b border-border hover:bg-hover">
      <td className="py-[7px] px-2 font-medium">{h.ticker}</td>
      <td className="py-[7px] px-2"><AssetBadge cls={h.asset_class} /></td>
      <td className="py-[7px] px-2 text-[11px] text-muted uppercase">{h.book.replace("_", " ")}</td>
      <td className="py-[7px] px-2 text-right tabular-nums">{fmtNumber(Number(h.quantity), 4)}</td>
      <td className="py-[7px] px-2 text-right tabular-nums">{fmtNumber(Number(h.avg_cost), decimals)}</td>
      <td className="py-[7px] px-2 text-right tabular-nums">
        {mkt != null ? fmtNumber(mkt, decimals) : "—"}
      </td>
      <td className={`py-[7px] px-2 text-right tabular-nums ${signClass(quote?.day_change_pct)}`}>
        {quote?.day_change_pct != null ? fmtPct(quote.day_change_pct, 2, true) : "—"}
      </td>
      <td className="py-[7px] px-2 text-right tabular-nums">
        {mktVal != null ? fmtNumber(mktVal, decimals) : "—"}
      </td>
      <td className={`py-[7px] px-2 text-right tabular-nums ${signClass(upl)}`}>
        {upl != null ? fmtNumber(upl, decimals) : "—"}
      </td>
      <td className={`py-[7px] px-2 text-right tabular-nums ${signClass(uplPct)}`}>
        {uplPct != null ? fmtPct(uplPct, 2, true) : "—"}
      </td>
      <td className="py-[7px] px-2 text-[11px] text-muted">{h.notes || "—"}</td>
      <td className="py-[7px] px-2 text-right">
        <button onClick={onDelete} className="text-[11px] text-muted hover:text-red">
          Remove
        </button>
      </td>
    </tr>
  );
}

export function HoldingsManager() {
  const { data } = useSWR<{ items: Holding[] }>("/api/holdings", fetcher);
  const [ticker, setTicker] = useState("");
  const [assetClass, setAssetClass] = useState<AssetClass>("idx_equity");
  const [book, setBook] = useState<BookType>("investing");
  const [quantity, setQuantity] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [costCurrency, setCostCurrency] = useState("USD");
  const [notes, setNotes] = useState("");
  const [openedAt, setOpenedAt] = useState("");
  const [adding, setAdding] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker.trim() || !quantity || !avgCost) return;
    setAdding(true);
    await fetch("/api/holdings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: ticker.trim(),
        asset_class: assetClass,
        book,
        quantity: Number(quantity),
        avg_cost: Number(avgCost),
        cost_currency: costCurrency,
        notes: notes.trim() || null,
        opened_at: openedAt || null,
      }),
    });
    setAdding(false);
    setTicker("");
    setQuantity("");
    setAvgCost("");
    setNotes("");
    setOpenedAt("");
    mutate("/api/holdings");
  }

  async function remove(id: string) {
    await fetch(`/api/holdings?id=${id}`, { method: "DELETE" });
    mutate("/api/holdings");
  }

  const items = data?.items || [];
  const byCurrency: Record<string, number> = {};
  for (const h of items) {
    const ccy = h.cost_currency || "IDR";
    byCurrency[ccy] = (byCurrency[ccy] || 0) + Number(h.avg_cost) * Number(h.quantity);
  }
  const totalsText = Object.entries(byCurrency)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ccy, v]) => `${ccy} ${fmtNumber(v, 0)}`)
    .join(" · ");

  return (
    <div>
      <form onSubmit={add} className="flex flex-wrap items-end gap-2 mb-4 p-3 bg-panel-2 rounded border border-border">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Ticker</label>
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="BBRI / AAPL / BTC"
            className="text-[12px] w-[110px]"
            required
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
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Book</label>
          <select value={book} onChange={(e) => setBook(e.target.value as BookType)} className="text-[12px]">
            <option value="investing">Investing</option>
            <option value="idx_trading">IDX Trading</option>
            <option value="crypto_trading">Crypto Trading</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Qty</label>
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            type="number"
            step="any"
            placeholder="100"
            className="text-[12px] w-[90px]"
            required
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Avg Cost</label>
          <input
            value={avgCost}
            onChange={(e) => setAvgCost(e.target.value)}
            type="number"
            step="any"
            placeholder="4200"
            className="text-[12px] w-[100px]"
            required
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Ccy</label>
          <select value={costCurrency} onChange={(e) => setCostCurrency(e.target.value)} className="text-[12px]">
            <option value="USD">USD</option>
            <option value="IDR">IDR</option>
            <option value="SGD">SGD</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Opened</label>
          <input
            value={openedAt}
            onChange={(e) => setOpenedAt(e.target.value)}
            type="date"
            className="text-[12px]"
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full text-[12px]" />
        </div>
        <button
          type="submit"
          disabled={adding}
          className="bg-accent text-bg px-3 py-[6px] rounded text-[11px] font-semibold uppercase tracking-wider disabled:opacity-60"
        >
          {adding ? "…" : "Add / Update"}
        </button>
      </form>

      {items.length > 0 && (
        <div className="mb-3 text-[11px] text-muted">
          {items.length} holding{items.length > 1 ? "s" : ""} · Cost basis by currency:{" "}
          <span className="text-fg tabular-nums">{totalsText}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-muted text-[10px] uppercase tracking-wider border-b border-border">
              <th className="py-2 px-2 text-left font-normal">Ticker</th>
              <th className="py-2 px-2 text-left font-normal">Class</th>
              <th className="py-2 px-2 text-left font-normal">Book</th>
              <th className="py-2 px-2 text-right font-normal">Qty</th>
              <th className="py-2 px-2 text-right font-normal">Avg Cost</th>
              <th className="py-2 px-2 text-right font-normal">Last</th>
              <th className="py-2 px-2 text-right font-normal">Day%</th>
              <th className="py-2 px-2 text-right font-normal">Mkt Value</th>
              <th className="py-2 px-2 text-right font-normal">U. P&L</th>
              <th className="py-2 px-2 text-right font-normal">U. P&L %</th>
              <th className="py-2 px-2 text-left font-normal">Notes</th>
              <th className="py-2 px-2 text-right font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((h) => (
              <HoldingRow key={h.id} h={h} onDelete={() => remove(h.id)} />
            ))}
            {!items.length && (
              <tr>
                <td colSpan={12} className="py-6 text-center text-muted">
                  No holdings yet — add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
