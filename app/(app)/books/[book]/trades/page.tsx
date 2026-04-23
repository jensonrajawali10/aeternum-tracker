import { notFound } from "next/navigation";
import { Panel } from "@/components/Panel";
import { getBookMeta } from "@/lib/books/meta";
import { BookTradesTable } from "./BookTradesTable";

export const dynamic = "force-dynamic";

/**
 * Book trades tab — chronological feed of trades for this arm, with P&L
 * colouring + strategy + result.  Client-side SWR so it refreshes after
 * every sheet sync without a hard reload.
 */
export default async function BookTradesPage({
  params,
}: {
  params: Promise<{ book: string }>;
}) {
  const { book: slug } = await params;
  const meta = getBookMeta(slug);
  if (!meta) notFound();

  return (
    <Panel
      title="Trades"
      subtitle={`${meta.title} · most recent first · P&L in native ccy`}
    >
      <div className="mb-3 text-[10.5px] text-muted-2 leading-relaxed">
        Shows trades recorded via the Sheets sync only. Live Hyperliquid
        positions (perps, spot balances) appear on the Overview tab but
        don&apos;t create trade rows here until the HL fill sync runs — open
        positions that have never been flipped will always look missing
        from this tab.
      </div>
      <BookTradesTable book={meta.book} />
    </Panel>
  );
}
