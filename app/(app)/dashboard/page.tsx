import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { KpiRow } from "@/components/KpiRow";
import { PositionsTable } from "@/components/PositionsTable";
import { ExposureBars } from "@/components/ExposureBars";
import { BookSwitcher } from "@/components/BookSwitcher";
import { CurrencyToggle } from "@/components/CurrencyToggle";
import { NavVsBenchmarkChart } from "@/components/NavVsBenchmarkChart";
import { AlphaDecompositionChart } from "@/components/AlphaDecompositionChart";
import { AlphaAttribution } from "@/components/AlphaAttribution";
import { RiskSnapshot } from "@/components/RiskSnapshot";
import { SectorDoughnut } from "@/components/SectorDoughnut";
import { StrategyMatrix } from "@/components/StrategyMatrix";
import { SignalFeed } from "@/components/SignalFeed";
import type { BookFilter } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ book?: string; ccy?: string }>;
}) {
  const params = await searchParams;
  const book = (params.book || "all") as BookFilter;
  const ccy = (params.ccy === "USD" ? "USD" : "IDR") as "IDR" | "USD";

  return (
    <>
      <TopHeader title="Dashboard" subtitle="Live portfolio • IDR base • IDX + US + Crypto">
        <BookSwitcher current={book} />
        <CurrencyToggle current={ccy} />
      </TopHeader>

      <KpiRow book={book} currency={ccy} />

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4 mb-4">
        <Panel title="NAV vs Benchmarks" subtitle="Rebased to 100">
          <NavVsBenchmarkChart book={book} />
        </Panel>
        <Panel title="Recent Signals" subtitle="Agent feed">
          <SignalFeed limit={8} />
        </Panel>
      </div>

      <Panel title="Open Positions" subtitle="Live marks • sorted by weight" className="mb-4">
        <PositionsTable book={book} currency={ccy} limit={15} />
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4 mb-4">
        <Panel title="Rolling 30D Alpha" subtitle="vs IHSG and S&P 500">
          <AlphaDecompositionChart book={book} />
        </Panel>
        <Panel title="Alpha Attribution" subtitle="YTD">
          <AlphaAttribution book={book} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Panel title="Exposure Breakdown">
          <ExposureBars book={book} />
        </Panel>
        <Panel title="Sector Concentration">
          <SectorDoughnut book={book} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
        <Panel title="Risk Snapshot">
          <RiskSnapshot book={book} />
        </Panel>
        <Panel title="Strategy Matrix" subtitle="Win rate, expectancy, hold time">
          <StrategyMatrix />
        </Panel>
      </div>
    </>
  );
}
