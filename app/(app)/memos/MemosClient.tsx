"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { MemosTable, type DecisionMemo } from "@/components/memos/MemosTable";
import { MemoForm } from "@/components/memos/MemoForm";

interface MemosResp {
  memos: DecisionMemo[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * MemosClient — owns the SWR list + the "+ New memo" dialog state.
 *
 * G5 ticker filter: when the URL carries ?ticker=BBCA the list filters
 * client-side to memos linked to that symbol.  Lets PositionsTable +
 * BookOverview link directly to the relevant memos for any ticker
 * without a dedicated /tickers/[ticker] route (which is the bigger G2
 * item still on the audit board).
 */
export function MemosClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tickerFilter = (searchParams.get("ticker") || "").trim().toUpperCase();

  const { data, isLoading, mutate } = useSWR<MemosResp>("/api/memos", fetcher, {
    refreshInterval: 60_000,
  });
  const [dialogOpen, setDialogOpen] = useState(false);

  const memos = useMemo(() => {
    const list = data?.memos ?? [];
    if (!tickerFilter) return list;
    return list.filter(
      (m) => (m.linked_ticker || "").toUpperCase() === tickerFilter,
    );
  }, [data, tickerFilter]);

  function clearFilter() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("ticker");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-[10.5px] text-muted-2">
            {memos.length} {memos.length === 1 ? "memo" : "memos"}{" "}
            {tickerFilter ? "for" : "on file"}
          </div>
          {tickerFilter && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-[2px] rounded-[3px] border text-[10px] uppercase tracking-[0.10em] mono"
              style={{
                background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
                borderColor:
                  "color-mix(in srgb, var(--color-accent) 30%, transparent)",
                color: "var(--color-accent)",
              }}
            >
              {tickerFilter}
              <button
                type="button"
                onClick={clearFilter}
                className="hover:text-fg ml-0.5"
                aria-label="Clear ticker filter"
                title="Clear ticker filter"
              >
                ×
              </button>
            </span>
          )}
          {tickerFilter && (
            <Link
              href="/memos"
              className="text-[10.5px] mono uppercase tracking-[0.10em] text-muted-2 hover:text-fg"
            >
              all memos →
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="btn-pill btn-pill-primary !py-[8px] !px-[20px] !text-[10.5px]"
        >
          + New memo
        </button>
      </div>

      <MemosTable memos={memos} isLoading={isLoading} />

      {dialogOpen && (
        <MemoForm
          onClose={() => setDialogOpen(false)}
          onSuccess={() => {
            setDialogOpen(false);
            mutate();
          }}
        />
      )}
    </div>
  );
}
