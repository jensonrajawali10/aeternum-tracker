"use client";

import { useState } from "react";
import useSWR from "swr";
import { MemosTable, type DecisionMemo } from "@/components/memos/MemosTable";
import { MemoForm } from "@/components/memos/MemoForm";

interface MemosResp {
  memos: DecisionMemo[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * MemosClient — owns the SWR list + the "+ New memo" dialog state.  The
 * dialog uses the mount-on-open pattern (parent conditionally renders
 * MemoForm) so React 19 strict-purity rules are satisfied: every open
 * is a fresh mount and the lazy useState initialisers in MemoForm run
 * cleanly without setState-in-effect warnings.
 */
export function MemosClient() {
  const { data, isLoading, mutate } = useSWR<MemosResp>("/api/memos", fetcher, {
    refreshInterval: 60_000,
  });
  const [dialogOpen, setDialogOpen] = useState(false);

  const memos = data?.memos ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10.5px] text-muted-2">
          {memos.length} {memos.length === 1 ? "memo" : "memos"} on file
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="bg-accent text-bg hover:bg-accent/90 px-3 py-[6px] rounded text-[10.5px] font-semibold uppercase tracking-[0.12em]"
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
