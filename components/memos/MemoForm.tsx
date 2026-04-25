"use client";

import { useEffect, useState } from "react";
import type { BookType } from "@/lib/types";

type LinkedBook = "" | "firm" | BookType;

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const BOOK_OPTIONS: { value: LinkedBook; label: string }[] = [
  { value: "", label: "— none —" },
  { value: "firm", label: "Firm (capital allocation)" },
  { value: "investing", label: "Investing" },
  { value: "idx_trading", label: "IDX Trading" },
  { value: "crypto_trading", label: "Crypto Trading" },
];

/**
 * Returns today's date in Asia/Jakarta as YYYY-MM-DD.  Used as the
 * default for the decided_at field — most memos are recorded the day
 * the decision was made, so today is the right anchor.  Locale is
 * en-CA because that gives ISO-style YYYY-MM-DD output.
 */
function todayWIB(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * MemoForm — the "record a decision" dialog.  Mirrors RebalanceDialog
 * (mount-on-open from parent, lazy useState initialiser, fetch with
 * cookie auth via supabaseServer middleware).  All four narrative
 * fields are required because the value of a decision memo *is* having
 * decided / why / expected / invalidation written down ahead of time.
 *
 * Mount-on-open pattern: parent (MemosClient) only renders this when the
 * dialog should be visible, so every open is a fresh mount and the
 * lazy useState initialisers run cleanly.  Closing unmounts and discards
 * all state.  This satisfies React 19 strict-purity by keeping the
 * date-derived initial value out of the render path on subsequent renders.
 */
export function MemoForm({ onClose, onSuccess }: Props) {
  const [decidedAt, setDecidedAt] = useState<string>(() => todayWIB());
  const [decision, setDecision] = useState("");
  const [why, setWhy] = useState("");
  const [expected, setExpected] = useState("");
  const [invalidation, setInvalidation] = useState("");
  const [linkedTicker, setLinkedTicker] = useState("");
  const [linkedBook, setLinkedBook] = useState<LinkedBook>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSubmit =
    decision.trim().length >= 3 &&
    why.trim().length >= 3 &&
    expected.trim().length >= 3 &&
    invalidation.trim().length >= 3 &&
    decidedAt.length === 10;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    const body: Record<string, string | null> = {
      decided_at: decidedAt,
      decision: decision.trim(),
      why: why.trim(),
      expected_outcome: expected.trim(),
      invalidation: invalidation.trim(),
      linked_ticker: linkedTicker.trim() || null,
      linked_book: linkedBook === "" ? null : linkedBook,
    };
    const res = await fetch("/api/memos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setErr(j?.error || "Failed to record memo.");
      return;
    }
    onSuccess();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center pt-[6vh] bg-black/60 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[680px] mx-4 bg-panel border border-border rounded-[10px] overflow-hidden">
        <header className="px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-medium text-fg tracking-[-0.01em]">Record a decision memo</h2>
          <div className="text-[11px] text-muted mt-[2px]">
            Dated record of why · what I expected · what invalidates the call.
            Filled in ahead of the trade so post-mortems have ground truth.
          </div>
        </header>
        <div className="px-5 py-4 space-y-4 max-h-[72vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_180px] gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-2 mb-1">
                Decided on
              </div>
              <input
                type="date"
                value={decidedAt}
                onChange={(e) => setDecidedAt(e.target.value)}
                className="w-full text-[12px]"
              />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-2 mb-1">
                Linked ticker (optional)
              </div>
              <input
                type="text"
                value={linkedTicker}
                onChange={(e) => setLinkedTicker(e.target.value)}
                placeholder="MAPB.JK · BTC · leave blank for capital memos"
                className="w-full text-[12px] mono"
              />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-2 mb-1">
                Linked book
              </div>
              <select
                value={linkedBook}
                onChange={(e) => setLinkedBook(e.target.value as LinkedBook)}
                className="w-full text-[12px]"
              >
                {BOOK_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-2 mb-1">
              Decision <span className="text-red">*</span>
            </div>
            <input
              type="text"
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              placeholder='Open MAPB at 3,950, sized 4% NAV'
              className="w-full text-[12px]"
              maxLength={240}
            />
            <div className="text-[10px] text-muted-2 mt-[2px]">
              One-line summary — what action was taken and at what size/price.
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-2 mb-1">
              Why <span className="text-red">*</span>
            </div>
            <textarea
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              rows={4}
              placeholder="Rationale — the structural-catalyst thesis, the macro setup, the screen that flagged it. Be specific enough that a year from now you can tell whether the reason still held."
              className="w-full text-[12px]"
            />
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-2 mb-1">
              Expected outcome <span className="text-red">*</span>
            </div>
            <textarea
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              rows={3}
              placeholder="What success looks like — target price, time horizon, the specific re-rating you're underwriting. Numbers, not vibes."
              className="w-full text-[12px]"
            />
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-2 mb-1">
              Invalidation <span className="text-red">*</span>
            </div>
            <textarea
              value={invalidation}
              onChange={(e) => setInvalidation(e.target.value)}
              rows={3}
              placeholder="When am I wrong — explicit kill criteria. A price level, a thesis-breaking event, a fundamental that has to hold. If this fires, exit without renegotiating."
              className="w-full text-[12px]"
            />
          </div>

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
            disabled={busy || !canSubmit}
            className="bg-accent text-bg hover:bg-accent/90 px-4 py-[6px] rounded text-[10.5px] font-semibold uppercase tracking-[0.12em] disabled:opacity-60"
          >
            {busy ? "Saving…" : "Record memo"}
          </button>
        </footer>
      </div>
    </div>
  );
}
