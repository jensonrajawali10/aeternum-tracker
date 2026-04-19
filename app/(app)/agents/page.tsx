import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { AgentsBoard } from "./AgentsBoard";
import { SignalFeed } from "@/components/SignalFeed";

export const dynamic = "force-dynamic";

export default function AgentsPage() {
  return (
    <>
      <TopHeader
        title="Agents"
        subtitle="Macro · alpha · risk · universe-brief — webhook bridge from Claude Code"
      />
      <Panel>
        <AgentsBoard />
      </Panel>
      <Panel title="Signal feed" subtitle="Webhook deliveries and manual triggers" className="mt-4">
        <SignalFeed />
      </Panel>
    </>
  );
}
