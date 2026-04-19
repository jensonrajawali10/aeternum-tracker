import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { PositionsTable } from "@/components/PositionsTable";
import { KpiRow } from "@/components/KpiRow";
import { BookSwitcher } from "@/components/BookSwitcher";
import { CurrencyToggle } from "@/components/CurrencyToggle";
import type { BookFilter } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PositionsPage({
  searchParams,
}: {
  searchParams: Promise<{ book?: string; ccy?: string }>;
}) {
  const params = await searchParams;
  const book = (params.book || "all") as BookFilter;
  const ccy = (params.ccy === "USD" ? "USD" : "IDR") as "IDR" | "USD";
  return (
    <>
      <TopHeader title="Positions" subtitle="All open exposures across books">
        <BookSwitcher current={book} />
        <CurrencyToggle current={ccy} />
      </TopHeader>
      <KpiRow book={book} currency={ccy} />
      <Panel>
        <PositionsTable book={book} currency={ccy} />
      </Panel>
    </>
  );
}
