import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { AlertsManager } from "./AlertsManager";

export const dynamic = "force-dynamic";

export default function AlertsPage() {
  return (
    <>
      <TopHeader title="Alerts" subtitle="Price + P&L triggers · email + in-app" />
      <Panel>
        <AlertsManager />
      </Panel>
    </>
  );
}
