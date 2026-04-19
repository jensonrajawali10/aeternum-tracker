import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { EarningsBoard } from "./EarningsBoard";

export const dynamic = "force-dynamic";

export default function EarningsPage() {
  return (
    <>
      <TopHeader
        title="Earnings"
        subtitle="Perplexity sonar · upcoming calendar + call summaries for your book"
      />
      <Panel>
        <EarningsBoard />
      </Panel>
    </>
  );
}
