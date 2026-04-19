import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { StrategyMatrix } from "@/components/StrategyMatrix";
import { MoodScatter } from "@/components/MoodScatter";
import { ConvictionCalibration } from "@/components/ConvictionCalibration";
import { MistakesTaxonomy } from "@/components/MistakesTaxonomy";
import { HoldTimeDistribution } from "@/components/HoldTimeDistribution";
import { JournalTable } from "./JournalTable";

export const dynamic = "force-dynamic";

export default function JournalPage() {
  return (
    <>
      <TopHeader title="Journal" subtitle="Trade log, strategy diagnostics, self-awareness" />
      <Panel title="Strategy Matrix" subtitle="Win rate · Expectancy · Avg R:R · Hold time" className="mb-4">
        <StrategyMatrix />
      </Panel>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Panel title="Mood vs P&L">
          <MoodScatter />
        </Panel>
        <Panel title="Conviction Calibration">
          <ConvictionCalibration />
        </Panel>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Panel title="Mistakes Taxonomy" subtitle="Cost by type">
          <MistakesTaxonomy />
        </Panel>
        <Panel title="Hold Time Distribution">
          <HoldTimeDistribution />
        </Panel>
      </div>
      <Panel title="Trade Log" subtitle="Read-only — edit in Google Sheets, syncs back">
        <JournalTable />
      </Panel>
    </>
  );
}
