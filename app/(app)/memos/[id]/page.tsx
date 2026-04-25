import Link from "next/link";
import { notFound } from "next/navigation";
import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { BookBadge } from "@/components/Badge";
import { supabaseServer } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { RealizedOutcomeForm } from "@/components/memos/RealizedOutcomeForm";
import type { DecisionMemo } from "@/components/memos/MemosTable";

export const dynamic = "force-dynamic";

const MEMO_COLUMNS =
  "id, user_id, decided_at, decision, why, expected_outcome, invalidation, linked_ticker, linked_book, realized_outcome, realized_at, created_at, updated_at";

/**
 * Memo detail page — server-rendered for the static fields (decision /
 * why / expected outcome / invalidation), with a client subform for the
 * retroactive realized-outcome edit.  Owner-only via RLS; an unknown id
 * (or one that belongs to another user) renders 404.
 */
export default async function MemoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("decision_memos")
    .select(MEMO_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) notFound();
  const memo = data as DecisionMemo;

  return (
    <>
      <TopHeader
        title="Memo"
        subtitle={`Decided ${fmtDate(memo.decided_at, {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "Asia/Jakarta",
        })}`}
      >
        <Link
          href="/memos"
          className="border border-border text-muted hover:text-fg px-3 py-[6px] rounded text-[10.5px] uppercase tracking-[0.12em]"
        >
          ← All memos
        </Link>
      </TopHeader>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        <div className="space-y-4">
          <Panel title="Decision">
            <div className="space-y-2">
              <p className="text-[13.5px] text-fg leading-relaxed whitespace-pre-wrap">
                {memo.decision}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-[10.5px] text-muted-2">
                {memo.linked_book && (
                  <span className="inline-flex items-center gap-1">
                    <span className="uppercase tracking-[0.12em]">Book</span>
                    <BookBadge book={memo.linked_book} />
                  </span>
                )}
                {memo.linked_ticker && (
                  <span className="inline-flex items-center gap-1">
                    <span className="uppercase tracking-[0.12em]">Ticker</span>
                    <span className="mono text-fg">{memo.linked_ticker}</span>
                  </span>
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Why" subtitle="Rationale at decision time">
            <p className="text-[12px] text-fg leading-relaxed whitespace-pre-wrap">
              {memo.why}
            </p>
          </Panel>

          <Panel title="Expected outcome" subtitle="What success looks like">
            <p className="text-[12px] text-fg leading-relaxed whitespace-pre-wrap">
              {memo.expected_outcome}
            </p>
          </Panel>

          <Panel title="Invalidation" subtitle="Explicit kill criteria">
            <p className="text-[12px] text-fg leading-relaxed whitespace-pre-wrap">
              {memo.invalidation}
            </p>
          </Panel>
        </div>

        <div>
          <Panel title="Realized outcome" subtitle="Filled in after the trade plays out">
            <RealizedOutcomeForm
              memoId={memo.id}
              initialOutcome={memo.realized_outcome}
              initialRealizedAt={memo.realized_at}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
