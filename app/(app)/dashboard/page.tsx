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
import { FxTicker } from "@/components/FxTicker";
import type { BookFilter } from "@/lib/types";

export const dynamic = "force-dynamic";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning, Jenson";
  if (h < 18) return "Good afternoon, Jenson";
  return "Good evening, Jenson";
}

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
      <TopHeader title="Dashboard" subtitle={greeting()}>
        <FxTicker from="USD" to="IDR" />
        <BookSwitcher current={book} />
        <CurrencyToggle current={ccy} />
      </TopHeader>

      <KpiRow book={book} currency={ccy} />

      {/* Benchmark chart folded into dashboard — replaces standalone /benchmark page */}
      <Panel
        title="NAV vs benchmarks"
        subtitle="Rebased to 100"
        className="mb-5"
      >
        <NavVsBenchmarkChart book={book} height={240} />
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4 mb-5">
        <Panel title="Recent signals" subtitle="Agent feed">
          <SignalFeed limit={8} />
        </Panel>
        <Panel title="Open positions" subtitle="Live marks · sorted by weight">
          <PositionsTable book={book} currency={ccy} limit={10} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4 mb-5">
        <Panel title="Rolling 30D alpha" subtitle="vs JCI and S&P 500">
          <AlphaDecompositionChart book={book} />
        </Panel>
        <Panel title="Alpha attribution" subtitle="YTD">
          <AlphaAttribution book={book} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Panel title="Exposure breakdown">
          <ExposureBars book={book} />
        </Panel>
        <Panel title="Sector concentration">
          <SectorDoughnut book={book} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
        <Panel title="Risk snapshot">
          <RiskSnapshot book={book} />
        </Panel>
        <Panel title="Strategy matrix" subtitle="Win rate, expectancy, hold time">
          <StrategyMatrix />
        </Panel>
      </div>
    </>
  );
}
