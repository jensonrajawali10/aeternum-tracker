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
      <BookTradesTable book={meta.book} />
    </Panel>
  );
}
