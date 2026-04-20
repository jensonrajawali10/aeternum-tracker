import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { HoldingsManager } from "./HoldingsManager";

export const dynamic = "force-dynamic";

export default function HoldingsPage() {
  return (
    <>
      <TopHeader title="Holdings" subtitle="Current investment positions · live marks · unrealized P&L" />
      <Panel>
        <HoldingsManager />
      </Panel>
    </>
  );
}
