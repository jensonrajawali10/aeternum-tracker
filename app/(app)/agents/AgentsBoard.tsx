"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { fmtDate } from "@/lib/format";

interface AgentKey {
  id: string;
  agent_slug: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

interface SignalStats {
  agent_slug: string;
  total: number;
  unacknowledged: number;
  last_at: string | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const AGENTS = [
  {
    slug: "macro-intelligence",
    name: "Macro Intelligence",
    desc: "Global rates, FX, commodities, Indonesia transmission, capital flows.",
    color: "#7fa2d6",
  },
  {
    slug: "alpha-generator",
    name: "Alpha Generator",
    desc: "IDX small-cap catalyst hunting — KBMI, rights, backdoor, compliance.",
    color: "#d4a64a",
  },
  {
    slug: "risk-sentinel",
    name: "Risk Sentinel",
    desc: "Concentration, correlation, drawdown triggers, reflexivity warnings.",
    color: "#e06666",
  },
  {
    slug: "universe-brief",
    name: "Universe Brief",
    desc: "Daily morning note: overnight moves, calendar, flags for watchlist.",
    color: "#9fd69f",
  },
] as const;

export function AgentsBoard() {
  const { data: keysData } = useSWR<{ keys: AgentKey[] }>("/api/agents/keys", fetcher);
  const { data: signalsData } = useSWR<{ signals: { agent_slug: string; created_at: string; acknowledged: boolean }[] }>(
    "/api/agents/signals?limit=200",
    fetcher,
    { refreshInterval: 60_000 },
  );

  const stats: Record<string, SignalStats> = {};
  for (const a of AGENTS) stats[a.slug] = { agent_slug: a.slug, total: 0, unacknowledged: 0, last_at: null };
  for (const s of signalsData?.signals || []) {
    const st = stats[s.agent_slug];
    if (!st) continue;
    st.total++;
    if (!s.acknowledged) st.unacknowledged++;
    if (!st.last_at || s.created_at > st.last_at) st.last_at = s.created_at;
  }

  const keysBySlug: Record<string, AgentKey | undefined> = {};
  for (const k of keysData?.keys || []) {
    if (k.revoked_at) continue;
    keysBySlug[k.agent_slug] = k;
  }

  return (
    <div className="grid md:grid-cols-2 gap-3">
      {AGENTS.map((a) => (
        <AgentCard
          key={a.slug}
          agent={a}
          stats={stats[a.slug]}
          existingKey={keysBySlug[a.slug]}
        />
      ))}
    </div>
  );
}

function AgentCard({
  agent,
  stats,
  existingKey,
}: {
  agent: (typeof AGENTS)[number];
  stats: SignalStats;
  existingKey?: AgentKey;
}) {
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    const res = await fetch("/api/agents/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_slug: agent.slug }),
    });
    const json = await res.json();
    setBusy(false);
    if (json.plaintext) setNewKey(json.plaintext);
    mutate("/api/agents/keys");
  }

  async function trigger() {
    setBusy(true);
    await fetch(`/api/agents/${agent.slug}/trigger`, { method: "POST" });
    setBusy(false);
    mutate("/api/agents/signals?limit=200");
  }

  return (
    <div className="bg-panel-2 border border-border rounded p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: agent.color }}
            />
            <h3 className="text-[13px] font-semibold">{agent.name}</h3>
          </div>
          <div className="text-[11px] text-muted">{agent.desc}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 my-3">
        <Stat label="Total" value={String(stats.total)} />
        <Stat label="Unack" value={String(stats.unacknowledged)} tone={stats.unacknowledged > 0 ? "warn" : undefined} />
        <Stat
          label="Last"
          value={stats.last_at ? fmtDate(stats.last_at, { month: "short", day: "numeric" }) : "—"}
        />
      </div>

      <div className="text-[10px] uppercase tracking-wider text-muted mb-1">Webhook key</div>
      {existingKey ? (
        <div className="text-[11px] font-mono bg-bg rounded p-2 mb-2">
          {existingKey.key_prefix}••••••••
          {existingKey.last_used_at && (
            <span className="text-muted ml-2">
              · last used {fmtDate(existingKey.last_used_at, { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      ) : (
        <div className="text-[11px] text-muted mb-2">No key — generate below</div>
      )}

      {newKey && (
        <div className="mb-2">
          <div className="text-[10px] uppercase tracking-wider text-accent mb-1">
            New key — copy now, never shown again
          </div>
          <code className="block text-[10px] bg-bg rounded p-2 break-all">{newKey}</code>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={generate}
          disabled={busy}
          className="bg-accent text-bg px-3 py-[6px] rounded text-[10px] font-semibold uppercase tracking-wider disabled:opacity-60"
        >
          {existingKey ? "Regenerate" : "Generate key"}
        </button>
        <button
          onClick={trigger}
          disabled={busy}
          className="border border-border text-fg px-3 py-[6px] rounded text-[10px] font-semibold uppercase tracking-wider hover:bg-hover disabled:opacity-60"
        >
          Log run
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`text-[14px] font-semibold tabular-nums ${tone === "warn" ? "text-red" : ""}`}>
        {value}
      </div>
    </div>
  );
}
