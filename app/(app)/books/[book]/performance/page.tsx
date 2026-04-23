import { notFound } from "next/navigation";
import { Panel } from "@/components/Panel";
import { NavVsBenchmarkChart } from "@/components/NavVsBenchmarkChart";
import { AlphaDecompositionChart } from "@/components/AlphaDecompositionChart";
import { AlphaAttribution } from "@/components/AlphaAttribution";
import { getBookMeta } from "@/lib/books/meta";

export const dynamic = "force-dynamic";

/**
 * Book performance tab — NAV rebased vs the book's benchmark(s) + rolling
 * 30d alpha.  Jenson's question here is always "is this arm paying for its
 * seat?" so we show the NAV curve, the alpha decomposition, and the YTD
 * attribution table side-by-side.
 */
export default async function BookPerformancePage({
  params,
}: {
  params: Promise<{ book: string }>;
}) {
  const { book: slug } = await params;
  const meta = getBookMeta(slug);
  if (!meta) notFound();

  return (
    <>
      <Panel
        title={`Performance vs ${meta.benchmark}`}
        subtitle="% change since period start · rebased to 100"
        className="mb-4"
      >
        <NavVsBenchmarkChart book={meta.book} height={260} />
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4">
        <Panel title="Rolling 30D alpha" subtitle={`vs ${meta.benchmark}`}>
          <AlphaDecompositionChart book={meta.book} />
        </Panel>
        <Panel title="Alpha attribution" subtitle="YTD">
          <AlphaAttribution book={meta.book} />
        </Panel>
      </div>
    </>
  );
}
