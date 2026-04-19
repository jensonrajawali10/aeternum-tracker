import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { NavVsBenchmarkChart } from "@/components/NavVsBenchmarkChart";
import { AlphaDecompositionChart } from "@/components/AlphaDecompositionChart";
import { AlphaAttribution } from "@/components/AlphaAttribution";
import { BookSwitcher } from "@/components/BookSwitcher";
import type { BookFilter } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BenchmarkPage({
  searchParams,
}: {
  searchParams: Promise<{ book?: string }>;
}) {
  const params = await searchParams;
  const book = (params.book || "all") as BookFilter;
  return (
    <>
      <TopHeader title="Benchmarking" subtitle="vs IHSG and S&P 500 — separate lines, no blend">
        <BookSwitcher current={book} />
      </TopHeader>
      <Panel title="NAV vs Benchmarks" subtitle="Rebased to 100" className="mb-4">
        <NavVsBenchmarkChart book={book} />
      </Panel>
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4">
        <Panel title="Rolling 30D Alpha" subtitle="bps/day — vs each benchmark independently">
          <AlphaDecompositionChart book={book} />
        </Panel>
        <Panel title="Alpha Attribution" subtitle="YTD">
          <AlphaAttribution book={book} />
        </Panel>
      </div>
    </>
  );
}
