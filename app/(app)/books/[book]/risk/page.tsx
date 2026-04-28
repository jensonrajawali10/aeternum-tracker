import { notFound } from "next/navigation";
import { Panel } from "@/components/Panel";
import { RiskSnapshot } from "@/components/RiskSnapshot";
import { ExposureBars } from "@/components/ExposureBars";
import { ConcentrationBars } from "@/components/ConcentrationBars";
import { getBookMeta } from "@/lib/books/meta";

export const dynamic = "force-dynamic";

/**
 * Book risk tab — metrics + concentration scoped to this arm.  Mirrors the
 * firm-level /risk page but with `book` filter pre-applied.
 */
export default async function BookRiskPage({
  params,
}: {
  params: Promise<{ book: string }>;
}) {
  const { book: slug } = await params;
  const meta = getBookMeta(slug);
  if (!meta) notFound();

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Panel title="Risk snapshot" subtitle={`${meta.title} · vol, beta, drawdown`}>
          <RiskSnapshot book={meta.book} />
        </Panel>
        <Panel title="Exposure breakdown" subtitle="Asset class + currency">
          <ExposureBars book={meta.book} />
        </Panel>
      </div>
      <Panel title="Concentration by ticker" subtitle="Top 7 + rest">
        <ConcentrationBars book={meta.book} />
      </Panel>
    </>
  );
}
