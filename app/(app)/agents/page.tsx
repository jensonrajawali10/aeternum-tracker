import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { AnalystsBoard } from "./AnalystsBoard";
import { MorningBrief } from "./MorningBrief";
import { SignalFeed } from "@/components/SignalFeed";

export const dynamic = "force-dynamic";

/**
 * Analysts — the in-house advisory circle framed as four specialists
 * Jenson consults each morning rather than four webhooks he maintains.
 *
 *   · Morning brief (top)      — today's universe-brief or a request CTA
 *   · Four analyst cards       — latest brief preview + Run-now per voice
 *   · Brief archive (bottom)   — full chronological signal feed
 *
 * Webhook key CRUD moved to Settings → Agent integrations so this page
 * is for reading research, not for configuring the bridge.
 */
export default function AnalystsPage() {
  return (
    <>
      <TopHeader
        title="Analysts"
        subtitle="Four voices — macro · alpha · risk · universe-brief. Wired via Claude Code."
      />
      <MorningBrief />
      <Panel
        title="Advisory circle"
        subtitle="Latest brief per analyst · click Run now to log a manual invocation"
        className="mt-5"
      >
        <AnalystsBoard />
      </Panel>
      <Panel
        title="Brief archive"
        subtitle="Every signal delivered by webhook or manual trigger"
        className="mt-5"
      >
        <SignalFeed />
      </Panel>
    </>
  );
}
