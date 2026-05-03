"use client";

import { useEffect, useState } from "react";
import type { CatalystEventType, CatalystSeverity } from "./CatalystsClient";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const EVENT_TYPES: { value: CatalystEventType; label: string }[] = [
  { value: "kbmi_change", label: "KBMI tier change" },
  { value: "rights_issue", label: "Rights issue" },
  { value: "backdoor_listing", label: "Backdoor listing" },
  { value: "compliance", label: "Compliance / sanction" },
  { value: "rups", label: "RUPS / EGM" },
  { value: "dividend_ex", label: "Dividend ex-date" },
  { value: "earnings", label: "Earnings release" },
  { value: "regulatory", label: "Regulatory action (OJK / BEI)" },
  { value: "macro", label: "Macro event" },
  { value: "other", label: "Other" },
];

const SEVERITIES: { value: CatalystSeverity; label: string }[] = [
  { value: "info", label: "Signal — informational" },
  { value: "watch", label: "Watch — keep an eye on" },
  { value: "breach", label: "Breach — action probable" },
];

const BOOKS: { value: string; label: string }[] = [
  { value: "", label: "— firm-wide / no book —" },
  { value: "investing", label: "Investing" },
  { value: "idx_trading", label: "IDX Trading" },
  { value: "crypto_trading", label: "Crypto Trading" },
  { value: "firm", label: "Firm" },
];

function todayWIB(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * CatalystForm — modal dialog mirroring the MemoForm / RebalanceDialog
 * pattern.  Mount-on-open from the parent so every open is a fresh
 * lazy-init useState (React 19 strict-purity safe).
 */
export function CatalystForm({ onClose, onSuccess }: Props) {
  const [eventDate, setEventDate] = useState<string>(() => todayWIB());
  const [eventType, setEventType] = useState<CatalystEventType>("earnings");
  const [severity, setSeverity] = useState<CatalystSeverity>("watch");
  const [ticker, setTicker] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [linkedBook, setLinkedBook] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSubmit = title.trim().length >= 3 && eventDate.length === 10;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    const body: Record<string, string | null> = {
      event_type: eventType,
      event_date: eventDate,
      severity,
      title: title.trim(),
      ticker: ticker.trim() || null,
      notes: notes.trim() || null,
      source_url: sourceUrl.trim() || null,
      linked_book: linkedBook || null,
    };
    const res = await fetch("/api/catalysts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setErr(j?.error || "Failed to record catalyst.");
      return;
    }
    onSuccess();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center pt-[8vh] bg-black/60 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[680px] mx-4 bg-panel border border-border rounded-[10px] overflow-hidden">
        <header className="px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-medium text-fg tracking-[-0.01em]">
            Record a catalyst
          </h2>
          <div className="text-[11px] text-muted mt-[2px]">
            Dated structural event · drives 7-day pre-alert + post-event memo
            pairing
          </div>
        </header>
        <div className="px-5 py-4 space-y-4 max-h-[72vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_160px] gap-3">
            <div>
              <div className="label mb-1">Event date</div>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full text-[12px]"
              />
            </div>
            <div>
              <div className="label mb-1">
                Title <span className="text-loss">*</span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder='e.g. "BBRI EGM — KBMI 4 reclassification vote"'
                className="w-full text-[12px]"
                maxLength={240}
              />
            </div>
            <div>
              <div className="label mb-1">Severity</div>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as CatalystSeverity)}
                className="w-full text-[12px]"
              >
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[180px_180px_1fr] gap-3">
            <div>
              <div className="label mb-1">Type</div>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as CatalystEventType)}
                className="w-full text-[12px]"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="label mb-1">Ticker (optional)</div>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="BBRI · MAPB · ADRO"
                className="w-full text-[12px] mono"
              />
            </div>
            <div>
              <div className="label mb-1">Linked book (optional)</div>
              <select
                value={linkedBook}
                onChange={(e) => setLinkedBook(e.target.value)}
                className="w-full text-[12px]"
              >
                {BOOKS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="label mb-1">Source URL (optional)</div>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://www.idx.co.id/…  ·  https://www.ojk.go.id/…"
              className="w-full text-[12px]"
            />
          </div>

          <div>
            <div className="label mb-1">Notes (optional)</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Why this catalyst matters · expected mechanism · linked memo / position"
              className="w-full text-[12px]"
            />
          </div>

          {err && (
            <div className="text-[11.5px] text-loss border border-loss/40 rounded px-3 py-2 bg-loss/10">
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
            className="btn-pill btn-pill-primary !py-[8px] !px-[20px] !text-[10.5px]"
          >
            {busy ? "Saving…" : "Record catalyst"}
          </button>
        </footer>
      </div>
    </div>
  );
}
