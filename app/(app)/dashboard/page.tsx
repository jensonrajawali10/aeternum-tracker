import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { KpiRow } from "@/components/KpiRow";
import { BooksStrip } from "@/components/BooksStrip";
import { ActionPanel } from "@/components/ActionPanel";
import { CurrencyToggle } from "@/components/CurrencyToggle";
import { RiskSnapshot } from "@/components/RiskSnapshot";
import { SectorDoughnut } from "@/components/SectorDoughnut";
import { StrategyMatrix } from "@/components/StrategyMatrix";
import { FxTicker } from "@/components/FxTicker";
import { AsOfStamp } from "@/components/AsOfStamp";
import { TopMovers } from "@/components/TopMovers";
import { QuickAddWatchlist } from "@/components/QuickAddWatchlist";
import { NavVsBenchmarkChart } from "@/components/NavVsBenchmarkChart";
import { DrawdownChart } from "@/components/DrawdownChart";

export const dynamic = "force-dynamic";

function greeting(): string {
  // Server renders in UTC on Vercel — pin greeting to WIB (Asia/Jakarta, UTC+7)
  // so Jenson sees "morning/afternoon/evening" against his actual local time.
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  if (hour < 12) return "Good morning, Jenson";
  if (hour < 18) return "Good afternoon, Jenson";
  return "Good evening, Jenson";
}

/**
 * Command Center — the firm-level landing page.  Structured around three
 * concerns a CIO needs first thing in the morning:
 *
 *   1. Firm Pulse     — NAV, unrealised, YTD, gross/net exposure across all books
 *   2. Books Strip    — how each arm is contributing today (Investing / IDX / Crypto)
 *   3. Action Panel   — what needs attention: signals, movers, catalysts, exceptions
 *
 * Concentration + risk sit below as a calmer second fold.  Per-book
 * performance charts (NAV-vs-benchmark, rolling alpha, attribution) moved
 * into each book workspace at /books/[slug]/performance so the firm view
 * doesn't double up on what the book tabs already show.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ccy?: string }>;
}) {
  const params = await searchParams;
  const ccy = (params.ccy === "USD" ? "USD" : "IDR") as "IDR" | "USD";

  return (
    <>
      <TopHeader
        stepLabel="Firm Pulse"
        title="Command Center"
        subtitle={greeting()}
      >
        <AsOfStamp />
        <FxTicker from="USD" to="IDR" />
        <CurrencyToggle current={ccy} />
      </TopHeader>

      {/* Firm Pulse — single KPI row across all books */}
      <KpiRow book="all" currency={ccy} />

      {/* Books strip — one card per arm with click-through to workspace */}
      <div className="mt-5">
        <BooksStrip />
      </div>

      {/* NAV equity curve + drawdown — the visual depth a CIO cockpit
          needs. NAV vs JCI vs S&P on top, drawdown directly below so
          the eye can read the shape and the floor in one glance. */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4 mt-5">
        <Panel
          title="NAV vs benchmarks"
          subtitle="Rebased to 100 · firm-wide"
        >
          <NavVsBenchmarkChart book="all" height={260} />
        </Panel>
        <Panel
          title="Drawdown"
          subtitle="Peak-to-trough on NAV · firm-wide"
        >
          <DrawdownChart book="all" height={260} />
        </Panel>
      </div>

      {/* Top movers — Day P&L + best/worst performer (3-cell performance card) */}
      <div className="mt-5">
        <Panel
          title="Top movers · today"
          subtitle="Day P&L · best and worst by daily % change"
        >
          <TopMovers book="all" />
        </Panel>
      </div>

      {/* Action panel + quick-add watchlist side-by-side on wide screens */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mt-5">
        <Panel title="Needs attention" subtitle="Triage feed across all books">
          <ActionPanel />
        </Panel>
        <Panel
          title="Quick add to watchlist"
          subtitle="Record intent without leaving the dashboard"
        >
          <QuickAddWatchlist />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
        <Panel title="Concentration by ticker" subtitle="Top 7 positions + rest · firm-wide">
          <SectorDoughnut book="all" />
        </Panel>
        <Panel title="Risk snapshot" subtitle="Vol, Sharpe, Sortino, beta vs JCI + S&P">
          <RiskSnapshot book="all" />
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Strategy matrix" subtitle="Win rate, expectancy, hold time · firm-wide">
          <StrategyMatrix />
        </Panel>
      </div>
    </>
  );
}
