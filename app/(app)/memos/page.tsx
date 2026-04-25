import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { MemosClient } from "./MemosClient";

export const dynamic = "force-dynamic";

/**
 * Decision Memos — dated record of why · what I expected · what
 * invalidates the call.  Filled in BEFORE the trade plays out so
 * post-mortems have ground truth and can't be retconned.  RLS is
 * owner-only; the page is a thin server-rendered shell, all SWR
 * + dialog state lives in MemosClient.
 */
export default function MemosPage() {
  return (
    <>
      <TopHeader
        title="Decision Memos"
        subtitle="Dated record of why · what I expected · what invalidates the call"
      />
      <Panel
        title="Recorded decisions"
        subtitle="Newest first · click a row for the full rationale and outcome"
      >
        <MemosClient />
      </Panel>
    </>
  );
}
