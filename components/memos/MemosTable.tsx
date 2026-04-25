"use client";

import Link from "next/link";
import { BookBadge } from "@/components/Badge";
import { fmtDate, clsx } from "@/lib/format";
import type { BookType } from "@/lib/types";

// linked_book widens BookType with "firm" (capital-allocation memos that
// span the whole portfolio rather than one arm). The migration's CHECK
// constraint allows the same four values, so this matches the wire shape.
export type MemoLinkedBook = BookType | "firm";

export interface DecisionMemo {
  id: string;
  user_id: string;
  decided_at: string;
  decision: string;
  why: string;
  expected_outcome: string;
  invalidation: string;
  linked_ticker: string | null;
  linked_book: MemoLinkedBook | null;
  realized_outcome: string | null;
  realized_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  memos: DecisionMemo[];
  isLoading: boolean;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

/**
 * Memos list — one row per recorded decision, newest first.  The decision
 * itself is the primary column (truncated to ~80ch); ticker/book are
 * optional context.  Status is binary — either an outcome has been
 * recorded retroactively or the memo is still open and waiting on the
 * trade to play out.  Row click navigates to the detail page where the
 * full rationale + outcome edit live.
 */
export function MemosTable({ memos, isLoading }: Props) {
  if (isLoading && memos.length === 0) {
    return <div className="text-[11.5px] text-muted-2">Loading…</div>;
  }

  if (memos.length === 0) {
    return (
      <div className="text-[11.5px] text-muted-2 leading-relaxed">
        No memos yet — record decisions as you make them so post-mortems have
        ground truth. Use{" "}
        <span className="text-fg font-medium">+ New memo</span> top-right to log
        the first one. Each memo captures decided / why / expected outcome /
        invalidation up front, so when the trade plays out you can compare
        reality against the prior view honestly.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11.5px] tabular-nums">
        <thead>
          <tr className="text-muted text-[10px] uppercase tracking-wider border-b border-border">
            <th className="py-2 px-2 text-left font-normal">Decided</th>
            <th className="py-2 px-2 text-left font-normal">Decision</th>
            <th className="py-2 px-2 text-left font-normal">Book</th>
            <th className="py-2 px-2 text-left font-normal">Ticker</th>
            <th className="py-2 px-2 text-left font-normal">Status</th>
          </tr>
        </thead>
        <tbody>
          {memos.map((m) => {
            const recorded = m.realized_outcome != null && m.realized_outcome.trim().length > 0;
            return (
              <tr
                key={m.id}
                className="border-b border-border hover:bg-hover cursor-pointer"
              >
                <td className="py-[6px] px-2">
                  <Link href={`/memos/${m.id}`} className="block text-fg">
                    {fmtDate(m.decided_at, {
                      year: "2-digit",
                      month: "short",
                      day: "numeric",
                      timeZone: "Asia/Jakarta",
                    })}
                  </Link>
                </td>
                <td className="py-[6px] px-2">
                  <Link
                    href={`/memos/${m.id}`}
                    title={m.decision}
                    className="block text-fg"
                  >
                    {truncate(m.decision, 80)}
                  </Link>
                </td>
                <td className="py-[6px] px-2">
                  <Link href={`/memos/${m.id}`} className="block">
                    {m.linked_book ? <BookBadge book={m.linked_book} /> : <span className="text-muted-2">—</span>}
                  </Link>
                </td>
                <td className="py-[6px] px-2">
                  <Link href={`/memos/${m.id}`} className="block">
                    {m.linked_ticker ? (
                      <span className="mono text-fg">{m.linked_ticker}</span>
                    ) : (
                      <span className="text-muted-2">—</span>
                    )}
                  </Link>
                </td>
                <td className="py-[6px] px-2">
                  <Link href={`/memos/${m.id}`} className="block">
                    <span
                      className={clsx(
                        "inline-flex items-center px-[7px] py-[2px] border rounded-[3px] text-[10.5px] font-medium mono",
                        recorded
                          ? "bg-green/10 text-green border-green/30"
                          : "bg-elevated text-muted border-border",
                      )}
                    >
                      {recorded ? "Outcome recorded" : "Open"}
                    </span>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
