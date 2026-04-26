"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import type { AssetClass } from "@/lib/types";

const ASSET_CLASSES: { value: AssetClass; label: string }[] = [
  { value: "idx_equity", label: "IDX Equity" },
  { value: "us_equity", label: "US Equity" },
  { value: "crypto", label: "Crypto" },
  { value: "fx", label: "FX" },
];

/**
 * Quick add to watchlist — the dashboard-resident shortcut to record a
 * ticker without bouncing to /watchlist.  Aeternum's source-of-truth is
 * the Sheets sync for *positions*, but the watchlist is a pre-trade
 * holding pen that lives entirely inside the app, so a direct write
 * here doesn't conflict with the sheet-as-truth model.
 *
 * On submit:
 *   1. POST { ticker (uppercased), asset_class, notes? } to /api/watchlist
 *   2. Mutate the /api/watchlist SWR cache so the dedicated /watchlist
 *      page reflects the new row immediately on next visit
 *   3. Show a transient success badge then reset the form
 *
 * This is the "Add Position form" piece of the PortfolioPulse spec
 * adapted for Aeternum — recording intent before sizing into the trade.
 */
export function QuickAddWatchlist() {
  const { mutate } = useSWRConfig();
  const [ticker, setTicker] = useState("");
  const [assetClass, setAssetClass] = useState<AssetClass>("idx_equity");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!ticker.trim()) return;
    setBusy(true);
    setErr(null);
    setStatus("idle");
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: ticker.trim().toUpperCase(),
        asset_class: assetClass,
        notes: notes.trim() || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setErr(j?.error || "Failed to add to watchlist.");
      setStatus("err");
      return;
    }
    setStatus("ok");
    setTicker("");
    setNotes("");
    // Refresh the dedicated /watchlist page's cache so the new row is
    // there next time Jenson navigates over.
    mutate("/api/watchlist");
    // Auto-clear the success chip after a couple of seconds so the form
    // doesn't feel stuck in "just saved" state.
    setTimeout(() => setStatus((s) => (s === "ok" ? "idle" : s)), 2500);
  }

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted leading-relaxed">
        Drop a ticker on your watchlist without leaving the dashboard.
        Same store as the dedicated{" "}
        <a href="/watchlist" className="text-accent-text hover:underline">
          /watchlist
        </a>{" "}
        page.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-2">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="MAPB.JK · BTC · TSLA"
          className="w-full text-[12px] mono"
          onKeyDown={(e) => {
            if (e.key === "Enter" && ticker.trim()) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <select
          value={assetClass}
          onChange={(e) => setAssetClass(e.target.value as AssetClass)}
          className="w-full text-[12px]"
        >
          {ASSET_CLASSES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Note (optional) — why am I watching this"
        className="w-full text-[12px]"
      />
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10.5px] min-h-[14px]">
          {status === "ok" && (
            <span className="text-success">Added · refreshing…</span>
          )}
          {status === "err" && <span className="text-loss">{err}</span>}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !ticker.trim()}
          className="btn-pill btn-pill-primary !py-[8px] !px-[20px] !text-[10.5px]"
        >
          {busy ? "Adding…" : "+ Add to watchlist"}
        </button>
      </div>
    </div>
  );
}
