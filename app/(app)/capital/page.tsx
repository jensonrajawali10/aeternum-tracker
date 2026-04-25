import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { CapitalSummary } from "@/components/capital/CapitalSummary";
import { AllocationDriftTable } from "@/components/capital/AllocationDriftTable";
import { CorrelationHeatmap } from "@/components/capital/CorrelationHeatmap";
import { RecentRebalances } from "@/components/capital/RecentRebalances";

export const dynamic = "force-dynamic";

/**
 * Capital Allocation — the firm-level mandate page.  Four concerns:
 *
 *   1. Summary strip    — firm NAV (IDR + USD), drift headline, last rebalance + CTA
 *   2. Drift table      — target vs actual per arm with band visual + status pill
 *   3. Correlation      — cross-arm pairwise correlation heatmap (30/90/180d)
 *   4. Rebalance journal — dated log of recorded decisions, most recent first
 *
 * The "Record rebalance" CTA in the summary opens a dialog that writes a
 * dated delta entry to the capital journal.  Executing the trades still
 * happens out of the app (sheets / broker portals) — this page is the
 * decision log + firm mandate diagnostic.
 */
export default function CapitalPage() {
  return (
    <>
      <TopHeader
        step="01"
        stepLabel="Capital Allocation"
        title="Capital Allocation"
        subtitle="Target vs actual drift per arm · cross-arm correlation · firm mandate view"
      />
      <CapitalSummary />
      <Panel
        title="Allocation by arm"
        subtitle="Target risk budget vs actual NAV share"
        className="mt-5"
      >
        <AllocationDriftTable />
      </Panel>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-4 mt-5">
        <Panel
          title="Cross-arm correlation"
          subtitle="Daily NAV log-returns · Pearson"
        >
          <CorrelationHeatmap />
        </Panel>
        <Panel
          title="Diversification notes"
          subtitle="Why this matters"
        >
          <div className="text-[11.5px] text-muted leading-relaxed space-y-3">
            <p>
              Correlation on NAV returns tells you whether your three arms are actually
              providing diversification or just three flavours of the same trade. A firm
              with <span className="text-red font-semibold">+0.8</span> across every pair
              has one book in three costumes. A firm with two arms near zero and one
              negative is running a real barbell.
            </p>
            <p>
              Useful reads to run quarterly:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Investing × IDX Trading correlation should be moderate positive (both
                IDX-denominated), but drift above +0.85 means the trading book is just
                mirroring long-book beta.
              </li>
              <li>
                Crypto × anything else should land near zero for most windows — if it
                spikes positive during risk-off, crypto is no longer diversifying.
              </li>
              <li>
                Short windows (30d) read as noise; use the 180d window to settle the
                regime view and the 30d window to spot a correlation break.
              </li>
            </ul>
            <p className="text-muted-2 pt-1 border-t border-border">
              Bands and rebalance thresholds are configured centrally in{" "}
              <code className="mono text-fg">lib/books/meta.ts</code> and the allocation
              endpoint — adjust there to change firm-wide policy.
            </p>
          </div>
        </Panel>
      </div>
      <Panel
        title="Rebalance journal"
        subtitle="Dated decisions — most recent first"
        className="mt-5"
      >
        <RecentRebalances />
      </Panel>
    </>
  );
}
