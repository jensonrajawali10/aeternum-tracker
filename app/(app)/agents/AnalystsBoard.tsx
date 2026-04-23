"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { fmtDate } from "@/lib/format";
import { SeverityBadge } from "@/components/Badge";
import type { Severity } from "@/lib/types";

interface Signal {
  id: string;
  agent_slug: string;
  signal_type: string;
  ticker: string | null;
  severity: Severity | "warn";
  title: string;
  body: string | null;
  created_at: string;
  acknowledged: boolean;
}

interface SignalStats {
  agent_slug: string;
  total: number;
  unacknowledged: number;
  last_at: string | null;
  latest: Signal | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const ANALYSTS = [
  {
    slug: "macro-intelligence",
    name: "Macro Intelligence",
    desc: "Global rates, FX, commodities. Watches Indonesia transmission + capital flows.",
    color: "#7fa2d6",
  },
  {
    slug: "alpha-generator",
    name: "Alpha Generator",
    desc: "IDX small-cap catalysts — KBMI tier moves, rights, backdoor listings, compliance breaks.",
    color: "#d4a64a",
  },
  {
    slug: "risk-sentinel",
    name: "Risk Sentinel",
    desc: "Book-level concentration, correlation, drawdown triggers, reflexivity warnings.",
    color: "#e06666",
  },
  {
    slug: "universe-brief",
    name: "Universe Brief",
    desc: "Daily pre-open note — overnight moves, calendar, flags for watchlist and book.",
    color: "#9fd69f",
  },
] as const;

/**
 * Analysts board — the four in-house research voices framed as an
 * advisory circle rather than a dev webhook console.  Each card surfaces
 * the most recent brief preview so the status at a glance is "what did
 * they say last" not "is the key configured".  Webhook-key plumbing
 * lives in Settings → Agent integrations.
 */
export function AnalystsBoard() {
  const { data: signalsData } = useSWR<{ signals: Signal[] }>(
    "/api/agents/signals?limit=200",
    fetcher,
    { refreshInterval: 60_000 },
  );

  const stats: Record<string, SignalStats> = {};
  for (const a of ANALYSTS) {
    stats[a.slug] = { agent_slug: a.slug, total: 0, unacknowledged: 0, last_at: null, latest: null };
  }
  for (const s of signalsData?.signals || []) {
    const st = stats[s.agent_slug];
    if (!st) continue;
    st.total++;
    if (!s.acknowledged) st.unacknowledged++;
    if (!st.last_at || s.created_at > st.last_at) {
      st.last_at = s.created_at;
      st.latest = s;
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-3">
      {ANALYSTS.map((a) => (
        <AnalystCard key={a.slug} analyst={a} stats={stats[a.slug]} />
      ))}
    </div>
  );
}

function AnalystCard({
  analyst,
  stats,
}: {
  analyst: (typeof ANALYSTS)[number];
  stats: SignalStats;
}) {
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    await fetch(`/api/agents/${analyst.slug}/trigger`, { method: "POST" });
    setBusy(false);
    mutate("/api/agents/signals?limit=200");
  }

  const latest = stats.latest;
  const sev = latest
    ? ((latest.severity === "warn" ? "warning" : latest.severity) as Severity)
    : null;

  return (
    <div className="bg-panel-2 border border-border rounded-[10px] p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-[2px]">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ background: analyst.color }}
            />
            <h3 className="text-[13px] font-semibold text-fg tracking-[-0.01em]">{analyst.name}</h3>
          </div>
          <div className="text-[11px] text-muted leading-snug">{analyst.desc}</div>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="border border-border text-fg hover:border-accent/60 hover:text-accent px-3 py-[6px] rounded text-[10px] font-semibold uppercase tracking-[0.12em] disabled:opacity-60 shrink-0"
        >
          {busy ? "…" : "Run now"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 my-3 border-t border-b border-border py-2">
        <Stat label="Briefs" value={String(stats.total)} />
        <Stat
          label="Unack"
          value={String(stats.unacknowledged)}
          tone={stats.unacknowledged > 0 ? "warn" : undefined}
        />
        <Stat
          label="Last run"
          value={stats.last_at ? fmtDate(stats.last_at, { month: "short", day: "numeric" }) : "—"}
        />
      </div>

      <div className="text-[9.5px] uppercase tracking-[0.14em] text-muted-2 mb-1">
        Latest brief
      </div>
      {latest && sev ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {latest.ticker && <span className="mono text-[11px] text-fg">{latest.ticker}</span>}
            <SeverityBadge sev={sev} />
            <span className="mono text-[10.5px] text-muted-2 ml-auto">
              {fmtDate(latest.created_at, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="text-[12.5px] text-fg leading-snug">{latest.title}</div>
          {latest.body && (
            <div className="text-[11px] text-muted leading-relaxed line-clamp-3">{latest.body}</div>
          )}
        </div>
      ) : (
        <div className="text-[11px] text-muted py-2">
          No briefs yet. Hit <span className="text-fg">Run now</span> to log a manual invocation,
          or route a webhook via{" "}
          <a href="/settings" className="text-accent hover:underline">
            Settings → Agent integrations
          </a>
          .
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-[0.14em] text-muted-2">{label}</div>
      <div className={`text-[13.5px] font-semibold tabular-nums mono ${tone === "warn" ? "text-red" : "text-fg"}`}>
        {value}
      </div>
    </div>
  );
}
