import { notFound } from "next/navigation";
import { TopHeader } from "@/components/TopHeader";
import { BookTabs } from "@/components/BookTabs";
import { AsOfStamp } from "@/components/AsOfStamp";
import { CurrencyToggle } from "@/components/CurrencyToggle";
import { getBookMeta } from "@/lib/books/meta";

export const dynamic = "force-dynamic";

/**
 * Book workspace layout — one per trading arm (investing / idx-trading /
 * crypto-trading).  Renders a book-specific TopHeader with mandate + PM
 * chip, the tab bar, and the child route's content.
 */
export default async function BookLayout({
  children,
  params,
  searchParams,
}: {
  children: React.ReactNode;
  params: Promise<{ book: string }>;
  searchParams?: Promise<{ ccy?: string }>;
}) {
  const { book } = await params;
  const sp = (await searchParams) ?? {};
  const ccy = sp.ccy === "USD" ? "USD" : "IDR";
  const meta = getBookMeta(book);
  if (!meta) notFound();

  const base = `/books/${meta.slug}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/performance`, label: "Performance" },
    { href: `${base}/risk`, label: "Risk" },
    { href: `${base}/trades`, label: "Trades" },
    { href: `${base}/notes`, label: "Notes" },
  ];

  return (
    <>
      <TopHeader title={meta.title} subtitle={meta.subtitle}>
        <div className="hidden sm:flex items-center gap-2 text-[10.5px] text-muted-2 tabular-nums border border-border bg-panel-2 rounded-[4px] px-2.5 py-1.5 font-mono">
          <span>
            <span className="text-muted">PM</span>{" "}
            <span className="text-fg/90">{meta.pm}</span>
          </span>
          <span className="text-border">·</span>
          <span>
            <span className="text-muted">Budget</span>{" "}
            <span className="text-fg/90">{meta.risk_budget_pct}%</span>
          </span>
          <span className="text-border">·</span>
          <span>
            <span className="text-muted">Bench</span>{" "}
            <span className="text-fg/90">{meta.benchmark}</span>
          </span>
        </div>
        <AsOfStamp />
        <CurrencyToggle current={ccy as "IDR" | "USD"} />
      </TopHeader>
      <BookTabs tabs={tabs} />
      {children}
    </>
  );
}
