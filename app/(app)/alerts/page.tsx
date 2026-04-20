import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { AlertsManager } from "./AlertsManager";
import { HotNewsPanel } from "./HotNewsPanel";

export const dynamic = "force-dynamic";

export default function AlertsPage() {
  return (
    <>
      <TopHeader title="Alerts" subtitle="Price + P&L triggers · hot news email · in-app feed" />
      <Panel title="Hot news email" className="mb-4">
        <HotNewsPanel />
      </Panel>
      <Panel title="Price & P&L alerts">
        <AlertsManager />
      </Panel>
    </>
  );
}
