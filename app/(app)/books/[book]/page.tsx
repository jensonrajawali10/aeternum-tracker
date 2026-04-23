import { notFound } from "next/navigation";
import { Panel } from "@/components/Panel";
import { KpiRow } from "@/components/KpiRow";
import { PositionsTable } from "@/components/PositionsTable";
import { ExposureBars } from "@/components/ExposureBars";
import { getBookMeta } from "@/lib/books/meta";

export const dynamic = "force-dynamic";

/**
 * Book overview tab — scoped KPIs + live positions + exposure split.
 * Defaults to IDR; user can flip via the CurrencyToggle on the layout
 * TopHeader.
 */
export default async function BookOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ book: string }>;
  searchParams?: Promise<{ ccy?: string }>;
}) {
  const { book: slug } = await params;
  const sp = (await searchParams) ?? {};
  const ccy = sp.ccy === "USD" ? "USD" : "IDR";
  const meta = getBookMeta(slug);
  if (!meta) notFound();

  return (
    <>
      <KpiRow book={meta.book} currency={ccy as "IDR" | "USD"} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4 mt-5">
        <Panel
          title="Open positions"
          subtitle="Live marks · sorted by weight"
          className="min-h-0"
        >
          <PositionsTable book={meta.book} currency={ccy as "IDR" | "USD"} />
        </Panel>
        <Panel title="Exposure breakdown" subtitle="Asset class and currency">
          <ExposureBars book={meta.book} />
        </Panel>
      </div>
    </>
  );
}
