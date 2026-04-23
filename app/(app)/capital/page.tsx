import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { BOOKS } from "@/lib/books/meta";

export const dynamic = "force-dynamic";

/**
 * Capital Allocation placeholder — the real implementation (target vs
 * actual drift, rebalance action, cross-arm correlation heatmap) lands
 * in Weeks 3-5 of the CIO rebuild.  For now this page just renders the
 * mandate / PM / risk-budget roll-up so Jenson can see the arm split
 * at a glance.
 */
export default function CapitalPage() {
  const books = Object.values(BOOKS);
  const totalBudget = books.reduce((a, b) => a + b.risk_budget_pct, 0);

  return (
    <>
      <TopHeader
        title="Capital Allocation"
        subtitle="Target risk budget per arm · drift + rebalance view lands in next iteration"
      />
      <Panel
        title="Target allocation by book"
        subtitle={`${books.length} arms · ${totalBudget}% of firm capital budgeted`}
      >
        <table className="w-full text-[12px] tabular-nums">
          <thead className="text-muted text-[10px] uppercase tracking-[0.14em] border-b border-border">
            <tr>
              <th className="text-left py-2">Book</th>
              <th className="text-left">Mandate</th>
              <th className="text-left">PM</th>
              <th className="text-right">Target %</th>
            </tr>
          </thead>
          <tbody>
            {books.map((b) => (
              <tr key={b.slug} className="border-b border-border">
                <td className="py-2 font-medium text-fg">{b.title}</td>
                <td className="text-muted max-w-[360px]">{b.mandate}</td>
                <td className="text-muted">{b.pm}</td>
                <td className="text-right text-fg">{b.risk_budget_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 text-[10.5px] text-muted-2 leading-relaxed border-t border-border pt-3">
          Next iteration will add: actual NAV per arm, drift bands, rebalance
          buttons that write target deltas into the journal, and a pairwise
          correlation heatmap (investing × idx_trading × crypto_trading).
        </div>
      </Panel>
    </>
  );
}
