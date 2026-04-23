import { notFound } from "next/navigation";
import Link from "next/link";
import { Panel } from "@/components/Panel";
import { getBookMeta } from "@/lib/books/meta";

export const dynamic = "force-dynamic";

/**
 * Book notes tab — the "mandate" page for this arm.  Shows what the arm is
 * for, who runs it, the risk budget.  Placeholder today — later this is where
 * decision memos + recent debrief posts live.
 */
export default async function BookNotesPage({
  params,
}: {
  params: Promise<{ book: string }>;
}) {
  const { book: slug } = await params;
  const meta = getBookMeta(slug);
  if (!meta) notFound();

  const rows: { label: string; value: string }[] = [
    { label: "Mandate", value: meta.mandate },
    { label: "Portfolio manager", value: meta.pm },
    { label: "Risk budget", value: `${meta.risk_budget_pct}% of firm capital` },
    { label: "Time horizon", value: meta.time_horizon },
    { label: "Benchmark", value: meta.benchmark },
  ];

  const sourceLink =
    meta.slug === "idx-trading"
      ? { label: "External sheet onboarding", href: "/idx-trading" }
      : meta.slug === "crypto-trading"
        ? { label: "Hyperliquid connection", href: "/crypto-trading" }
        : { label: "Holdings sheet source", href: "/settings" };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
      <Panel title="Mandate & setup" subtitle="What this arm is for">
        <dl className="grid grid-cols-[140px_1fr] gap-y-2.5 text-[12px]">
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <dt className="text-muted-2 uppercase tracking-[0.08em] text-[10.5px] pt-[1px]">
                {r.label}
              </dt>
              <dd className="text-fg leading-relaxed">{r.value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel title="Operations" subtitle="Source of truth + onboarding">
        <div className="text-[11.5px] text-muted leading-relaxed space-y-3">
          <p>
            Trades for this book sync from{" "}
            <Link href={sourceLink.href} className="text-accent hover:underline">
              {sourceLink.label}
            </Link>
            .
          </p>
          <p className="text-muted-2 pt-2 border-t border-border">
            Decision memos (dated decided / why / expected / invalidation /
            outcome) are on the roadmap but not live yet. For now, journal
            rationale lives on the{" "}
            <Link href="/journal" className="text-accent hover:underline">
              firm journal
            </Link>{" "}
            and capital-level decisions on the{" "}
            <Link href="/capital" className="text-accent hover:underline">
              rebalance log
            </Link>
            .
          </p>
        </div>
      </Panel>
    </div>
  );
}
