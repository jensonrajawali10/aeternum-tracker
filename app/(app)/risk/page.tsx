import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { RiskSnapshot } from "@/components/RiskSnapshot";
import { ExposureBars } from "@/components/ExposureBars";
import { SectorDoughnut } from "@/components/SectorDoughnut";
import { BookSwitcher } from "@/components/BookSwitcher";
import type { BookFilter } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RiskPage({
  searchParams,
}: {
  searchParams: Promise<{ book?: string }>;
}) {
  const params = await searchParams;
  const book = (params.book || "all") as BookFilter;
  return (
    <>
      <TopHeader
        stepLabel="Firm · Risk"
        title="Risk"
        subtitle="Vol, beta, drawdown, VaR, concentration"
      >
        <BookSwitcher current={book} />
      </TopHeader>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 mb-4">
        <Panel title="Risk Snapshot">
          <RiskSnapshot book={book} />
        </Panel>
        <Panel title="Exposure Breakdown">
          <ExposureBars book={book} />
        </Panel>
      </div>
      <Panel title="Top Concentrations">
        <SectorDoughnut book={book} />
      </Panel>
    </>
  );
}
