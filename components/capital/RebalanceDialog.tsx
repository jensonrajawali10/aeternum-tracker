"use client";

import { useEffect, useState } from "react";
import { mutate } from "swr";
import { clsx, fmtCurrency } from "@/lib/format";

type Book = "investing" | "idx_trading" | "crypto_trading";
type DriftStatus = "on_target" | "drifting" | "rebalance";

export interface DriftRow {
  slug: string;
  book: Book | "other";
  title: string;
  target_pct: number;
  actual_pct: number;
  actual_nav_idr: number;
  drift_pp: number;
  status: DriftStatus;
}

interface Props {
  onClose: () => void;
  firmNavIdr: number;
  rows: DriftRow[];
}

const BOOK_ORDER: Book[] = ["investing", "idx_trading", "crypto_trading"];

function computeSuggested(firmNavIdr: number, rows: DriftRow[]): Record<Book, number> {
  const out: Record<Book, number> = {
    investing: 0,
    idx_trading: 0,
    crypto_trading: 0,
  };
  if (firmNavIdr <= 0) return out;
  for (const r of rows) {
    if (!BOOK_ORDER.includes(r.book as Book)) continue;
    const targetIdr = firmNavIdr * (r.target_pct / 100);
    const delta = targetIdr - r.actual_nav_idr;
    out[r.book as Book] = Math.round(delta / 1_000_000) * 1_000_000; // round to nearest IDR 1M
  }
  return out;
}

/**
 * Rebalance dialog — the "record a decision" flow for Capital
 * Allocation.  Precomputes a suggested delta per arm that would bring
 * actual back onto target, lets Jenson override any amount or zero it
 * out, then POSTs the bundle (rationale, deltas map, target snapshot)
 * to /api/capital/rebalance.  The entry becomes a dated row the
 * correlation + allocation pages both read from.
 *
 * Intentionally light on mechanics — we're not actually moving capital
 * inside the app.  The log is the contract; the execution happens in
 * sheets / broker portals.  Think of this as a journal entry with the
 * numbers pre-filled.
 *
 * Mount-on-open pattern: the parent only renders this component when the
 * dialog should be visible, so every open is a fresh mount and the
 * initial `useState` values (suggested deltas snapshot, empty rationale)
 * are re-derived naturally.  Closing unmounts and discards all state.
 */
export function RebalanceDialog({ onClose, firmNavIdr, rows }: Props) {
  const [deltas, setDeltas] = useState<Record<Book, number>>(() =>
    computeSuggested(firmNavIdr, rows),
  );
  const [suggested] = useState<Record<Book, number>>(() => computeSuggested(firmNavIdr, rows));
  const [rationale, setRationale] = useState("");
  const [markApplied, setMarkApplied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const net = BOOK_ORDER.reduce((a, b) => a + (deltas[b] || 0), 0);
  const zeroSum = Math.abs(net) < 500_000; // within IDR 500k of zero is fine

  async function submit() {
    setBusy(true);
    setErr(null);
    const snapshot: Record<string, { target_pct: number; actual_pct: number; drift_pp: number }> = {};
    for (const r of rows) {
      if (!BOOK_ORDER.includes(r.book as Book)) continue;
      snapshot[r.book] = {
        target_pct: r.target_pct,
        actual_pct: r.actual_pct,
        drift_pp: r.drift_pp,
      };
    }
    const res = await fetch("/api/capital/rebalance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rationale,
        deltas,
        target_snapshot: snapshot,
        applied: markApplied,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setErr(j?.error || "Failed to record rebalance.");
      return;
    }
    await Promise.all([
      mutate("/api/capital/allocation"),
      mutate("/api/capital/rebalance?limit=10"),
    ]);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[640px] mx-4 bg-panel border border-border rounded-[10px] overflow-hidden">
        <header className="px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-medium text-fg tracking-[-0.01em]">Record a rebalance</h2>
          <div className="text-[11px] text-muted mt-[2px]">
            Writes a dated entry to the capital journal. Executing the trades still
            happens out of the app — this is the decision log.
          </div>
        </header>
        <div className="px-5 py-4 space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-2 mb-2">
              Delta per arm · IDR
            </div>
            <div className="space-y-2">
              {rows
                .filter((r) => BOOK_ORDER.includes(r.book as Book))
                .map((r) => {
                  const b = r.book as Book;
                  const v = deltas[b];
                  const suggestedVal = suggested[b];
                  return (
                    <div
                      key={r.slug}
                      className="flex items-center gap-3 bg-panel-2 border border-border rounded px-3 py-[8px]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium text-fg">{r.title}</div>
                        <div className="text-[10.5px] text-muted-2 mono">
                          target {r.target_pct.toFixed(1)}% · actual {r.actual_pct.toFixed(1)}% ·
                          drift {r.drift_pp > 0 ? "+" : ""}
                          {r.drift_pp.toFixed(1)}pp
                        </div>
                      </div>
                      <input
                        type="number"
                        value={v}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setDeltas((d) => ({ ...d, [b]: Number.isFinite(n) ? n : 0 }));
                        }}
                        step={1_000_000}
                        className="w-[180px] text-right mono text-[12px]"
                      />
                      <button
                        type="button"
                        onClick={() => setDeltas((d) => ({ ...d, [b]: suggestedVal }))}
                        className="text-[10px] uppercase tracking-[0.12em] text-muted hover:text-accent"
                        title="Reset to suggested"
                      >
                        ↺
                      </button>
                    </div>
                  );
                })}
            </div>
            <div className="flex items-center justify-between mt-2 text-[10.5px]">
              <span className="text-muted-2">
                Net moved: <span className="mono text-fg">{fmtCurrency(net, "IDR")}</span>
              </span>
              <span className={clsx(zeroSum ? "text-green" : "text-[#d4a64a]")}>
                {zeroSum ? "Net zero ✓" : "Net flow non-zero — adding/removing firm capital?"}
              </span>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-2 mb-1">
              Rationale
            </div>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={3}
              placeholder="Why now? What regime or signal triggered this? Link to the analyst brief that prompted it if applicable."
              className="w-full text-[12px]"
            />
          </div>

          <label className="flex items-center gap-2 text-[11.5px] text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={markApplied}
              onChange={(e) => setMarkApplied(e.target.checked)}
            />
            Mark as applied (deltas executed already — else entry is an intent)
          </label>

          {err && (
            <div className="text-[11.5px] text-red border border-red/40 rounded px-3 py-2 bg-red/10">
              {err}
            </div>
          )}
        </div>
        <footer className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="border border-border text-muted hover:text-fg px-3 py-[6px] rounded text-[10.5px] uppercase tracking-[0.12em]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || rationale.trim().length < 3}
            className="bg-accent text-bg hover:bg-accent/90 px-4 py-[6px] rounded text-[10.5px] font-semibold uppercase tracking-[0.12em] disabled:opacity-60"
          >
            {busy ? "Saving…" : "Record rebalance"}
          </button>
        </footer>
      </div>
    </div>
  );
}
