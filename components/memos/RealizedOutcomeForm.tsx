"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtDate } from "@/lib/format";

interface Props {
  memoId: string;
  initialOutcome: string | null;
  initialRealizedAt: string | null;
}

/**
 * RealizedOutcomeForm — the retroactive "what actually happened" entry
 * on the memo detail page.  Two modes:
 *   - read mode if an outcome is already on file (with an Edit button)
 *   - edit mode if empty, or after Edit pressed
 * PATCHes /api/memos/[id] with { realized_outcome }.  Backend stamps
 * realized_at server-side when realized_outcome is set without an
 * explicit timestamp, so the client just sends the text.
 *
 * router.refresh() pulls fresh server-rendered detail after save so
 * the read-mode display reflects the latest values from the DB.
 */
export function RealizedOutcomeForm({
  memoId,
  initialOutcome,
  initialRealizedAt,
}: Props) {
  const router = useRouter();
  const hasOutcome = !!initialOutcome && initialOutcome.trim().length > 0;
  const [mode, setMode] = useState<"read" | "edit">(hasOutcome ? "read" : "edit");
  const [draft, setDraft] = useState<string>(initialOutcome ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (draft.trim().length === 0) {
      setErr("Outcome can't be empty.");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/memos/${memoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ realized_outcome: draft.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setErr(j?.error || "Failed to save outcome.");
      return;
    }
    setMode("read");
    router.refresh();
  }

  if (mode === "read" && hasOutcome) {
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-fg leading-relaxed whitespace-pre-wrap">
          {initialOutcome}
        </p>
        <div className="flex items-center justify-between text-[10.5px] text-muted-2">
          <span>
            {initialRealizedAt
              ? `Recorded ${fmtDate(initialRealizedAt, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "Asia/Jakarta",
                })} WIB`
              : "Recorded"}
          </span>
          <button
            type="button"
            onClick={() => setMode("edit")}
            className="text-muted hover:text-fg uppercase tracking-[0.12em]"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!hasOutcome && (
        <div className="text-[11px] text-muted-2 leading-relaxed">
          Outcome not yet recorded. When the trade plays out, write what
          actually happened — was the thesis right? Did invalidation fire?
          What was the realized P&amp;L vs the expected one?
        </div>
      )}
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={6}
        placeholder="What actually happened — realized P&L, whether the catalyst played out, lessons for next time."
        className="w-full text-[12px]"
      />
      {err && (
        <div className="text-[11px] text-red border border-red/40 rounded px-2 py-1 bg-red/10">
          {err}
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        {hasOutcome && (
          <button
            type="button"
            onClick={() => {
              setDraft(initialOutcome ?? "");
              setMode("read");
              setErr(null);
            }}
            disabled={busy}
            className="border border-border text-muted hover:text-fg px-3 py-[5px] rounded text-[10px] uppercase tracking-[0.12em]"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={busy || draft.trim().length === 0}
          className="bg-accent text-bg hover:bg-accent/90 px-3 py-[5px] rounded text-[10px] font-semibold uppercase tracking-[0.12em] disabled:opacity-60"
        >
          {busy ? "Saving…" : hasOutcome ? "Save" : "Record outcome"}
        </button>
      </div>
    </div>
  );
}
