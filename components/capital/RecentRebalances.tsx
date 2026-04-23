"use client";

import useSWR from "swr";
import { clsx } from "@/lib/format";

type Book = "investing" | "idx_trading" | "crypto_trading";

interface RebalanceEntry {
  id: string;
  decided_at: string;
  rationale: string;
  deltas: Record<string, number>;
  target_snapshot: Record<
    string,
    { target_pct: number; actual_pct: number; drift_pp: number }
  > | null;
  applied: boolean;
  applied_at: string | null;
  created_at: string;
}

interface Resp {
  rebalances: RebalanceEntry[];
}

const fetcher = (u: string) => fetch(u).then((r) => r.json());

const BOOK_LABEL: Record<Book, string> = {
  investing: "Invest",
  idx_trading: "IDX",
  crypto_trading: "Crypto",
};
const BOOK_ORDER: Book[] = ["investing", "idx_trading", "crypto_trading"];

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(d);
  } catch {
    return iso;
  }
}

function fmtDeltaShort(v: number): string {
  const abs = Math.abs(v);
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${Math.round(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k`;
  return `${sign}${abs}`;
}

/**
 * Rebalance journal — scrollable list of the most recent dated entries
 * from /api/capital/rebalance.  Each row shows:
 *   - decided date (Asia/Jakarta)
 *   - applied vs intent pill
 *   - compact per-arm delta pills (green for add, red for pull)
 *   - first ~160 chars of rationale
 *
 * Source of truth: the `capital_rebalance_log` table.  This is an audit
 * trail, not a ledger — deltas are Jenson's recorded intent, execution
 * still happens in sheets and broker portals.
 */
export function RecentRebalances() {
  const { data } = useSWR<Resp>("/api/capital/rebalance?limit=10", fetcher, {
    refreshInterval: 120_000,
  });

  if (!data) {
    return <div className="text-[11.5px] text-muted-2">Loading…</div>;
  }
  const list = data.rebalances ?? [];
  if (list.length === 0) {
    return (
      <div className="text-[11.5px] text-muted-2 leading-relaxed">
        No rebalances recorded yet. Use{" "}
        <span className="text-fg font-medium">Record rebalance</span> in the summary strip to log
        the first dated entry. Each entry captures the drift snapshot, per-arm delta in IDR,
        rationale, and whether the trade was executed or is still an intent.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {list.map((e) => {
        const entries = BOOK_ORDER.map((b) => [b, e.deltas?.[b] ?? 0] as [Book, number]).filter(
          ([, v]) => Math.abs(v) >= 500_000,
        );
        return (
          <div
            key={e.id}
            className="bg-panel-2 border border-border rounded px-3 py-[10px] space-y-1"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[12px] font-medium text-fg mono">{fmtDate(e.decided_at)}</span>
                <span
                  className={clsx(
                    "text-[9.5px] uppercase tracking-[0.12em] px-[6px] py-[1.5px] rounded",
                    e.applied
                      ? "bg-green/15 text-green border border-green/30"
                      : "bg-muted/10 text-muted border border-border",
                  )}
                >
                  {e.applied ? "Applied" : "Intent"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-[6px] text-[10.5px] mono">
                {entries.length === 0 && <span className="text-muted-2">no moves</span>}
                {entries.map(([book, v]) => (
                  <span
                    key={book}
                    className={clsx(
                      "px-[6px] py-[1px] rounded border",
                      v > 0
                        ? "text-green border-green/30 bg-green/10"
                        : "text-red border-red/30 bg-red/10",
                    )}
                  >
                    {BOOK_LABEL[book]} {fmtDeltaShort(v)}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-[11px] text-muted leading-snug line-clamp-2">{e.rationale}</div>
          </div>
        );
      })}
    </div>
  );
}
