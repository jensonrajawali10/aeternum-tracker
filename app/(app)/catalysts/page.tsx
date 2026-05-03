import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { CatalystsClient } from "./CatalystsClient";

export const dynamic = "force-dynamic";

/**
 * /catalysts — the IDX-first structural-event ledger.  KBMI tier
 * changes, rights issues, backdoor listings, OJK actions, RUPS,
 * dividend ex-dates and earnings.  Drives the 7-day pre-event email
 * alerts (delivered by /api/cron/check-alerts when extended) and
 * pairs with the decision-memo workflow (a catalyst is the *why*
 * a memo gets written ahead of a position).
 */
export default function CatalystsPage() {
  return (
    <>
      <TopHeader
        stepLabel="Firm · Catalysts"
        title="Catalysts"
        subtitle="IDX-first structural events · KBMI · rights · RUPS · OJK · dividend ex · earnings"
      />
      <Panel
        title="Calendar"
        subtitle="Upcoming first · click a row to record outcome after it lands"
      >
        <CatalystsClient />
      </Panel>
    </>
  );
}
