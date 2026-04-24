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

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const ANALYSTS = [
  { slug: "macro-intelligence", name: "Macro Intelligence" },
  { slug: "alpha-generator", name: "Alpha Generator" },
  { slug: "risk-sentinel", name: "Risk Sentinel" },
  { slug: "universe-brief", name: "Universe Brief" },
] as const;

/**
 * Agent-integrations panel — the webhook-key plumbing for the four
 * Claude Code skills that post signals back to this app.  Lives under
 * Settings (infrastructure), not under Analysts (research reading).
 *
 * Each row: one analyst, live key state (or "no key"), generate /
 * regenerate control.  Plaintext key is shown once on generate — copy
 * immediately.  Regenerate revokes the previous key.
 */
export function AgentIntegrationsPanel() {
  const { data } = useSWR<{ keys: AgentKey[] }>("/api/agents/keys", fetcher);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkReveal, setBulkReveal] = useState<Record<string, string> | null>(null);

  const keysBySlug: Record<string, AgentKey | undefined> = {};
  for (const k of data?.keys || []) {
    if (k.revoked_at) continue;
    keysBySlug[k.agent_slug] = k;
  }
  const missing = ANALYSTS.filter((a) => !keysBySlug[a.slug]);

  async function generateAllMissing() {
    if (missing.length === 0) return;
    setBulkBusy(true);
    const results = await Promise.all(
      missing.map(async (a) => {
        const res = await fetch("/api/agents/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent_slug: a.slug }),
        });
        const json = (await res.json().catch(() => ({}))) as { plaintext?: string };
        return [a.slug, json.plaintext ?? ""] as const;
      }),
    );
    setBulkBusy(false);
    const reveal: Record<string, string> = {};
    for (const [slug, plaintext] of results) {
      if (plaintext) reveal[slug] = plaintext;
    }
    if (Object.keys(reveal).length > 0) setBulkReveal(reveal);
    mutate("/api/agents/keys");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="text-[11px] text-muted leading-relaxed flex-1">
          Each analyst posts briefs to{" "}
          <code className="bg-bg border border-border rounded px-1 py-[1px] text-[10.5px]">
            /api/agents/webhook
          </code>{" "}
          with a Bearer key scoped to one slug. Generate once, paste into the skill
          config locally, and forget about it — the keys stay put across app deploys.
        </div>
        {missing.length > 1 && (
          <button
            onClick={generateAllMissing}
            disabled={bulkBusy}
            className="shrink-0 border border-accent/40 text-accent hover:bg-accent/10 px-3 py-[6px] rounded text-[10px] font-semibold uppercase tracking-[0.12em] disabled:opacity-60"
            title={`Creates one key per missing analyst (${missing.length} keys)`}
          >
            {bulkBusy ? "Generating…" : `Generate all missing (${missing.length})`}
          </button>
        )}
      </div>

      {bulkReveal && (
        <div className="rounded-[8px] border border-accent/40 bg-accent/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.14em] text-accent">
              New keys — copy now, never shown again
            </div>
            <button
              onClick={() => setBulkReveal(null)}
              className="text-[10px] text-muted hover:text-fg uppercase tracking-wider"
            >
              Dismiss
            </button>
          </div>
          {ANALYSTS.filter((a) => bulkReveal[a.slug]).map((a) => (
            <div key={a.slug} className="space-y-1">
              <div className="text-[10.5px] text-muted mono">{a.slug}</div>
              <code className="block text-[10.5px] bg-bg border border-border rounded p-2 break-all mono">
                {bulkReveal[a.slug]}
              </code>
            </div>
          ))}
        </div>
      )}

      <div className="divide-y divide-border border border-border rounded-[8px] overflow-hidden">
        {ANALYSTS.map((a) => (
          <IntegrationRow key={a.slug} analyst={a} existingKey={keysBySlug[a.slug]} />
        ))}
      </div>
    </div>
  );
}

function IntegrationRow({
  analyst,
  existingKey,
}: {
  analyst: (typeof ANALYSTS)[number];
  existingKey?: AgentKey;
}) {
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    const res = await fetch("/api/agents/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_slug: analyst.slug }),
    });
    const json = await res.json();
    setBusy(false);
    if (json.plaintext) setNewKey(json.plaintext);
    mutate("/api/agents/keys");
  }

  return (
    <div className="px-4 py-3 bg-panel-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold text-fg">{analyst.name}</div>
          <div className="text-[10.5px] text-muted mono">{analyst.slug}</div>
        </div>
        <button
          onClick={generate}
          disabled={busy}
          className="border border-border text-fg hover:border-accent/60 hover:text-accent px-3 py-[6px] rounded text-[10px] font-semibold uppercase tracking-[0.12em] disabled:opacity-60 shrink-0"
        >
          {busy ? "…" : existingKey ? "Regenerate" : "Generate key"}
        </button>
      </div>

      <div className="mt-2 flex items-center gap-3 text-[11px]">
        {existingKey ? (
          <>
            <span className="mono bg-bg border border-border rounded px-2 py-[2px] text-[10.5px]">
              {existingKey.key_prefix}••••••••
            </span>
            <span className="text-muted-2">
              Created {fmtDate(existingKey.created_at, { month: "short", day: "numeric" })}
              {existingKey.last_used_at && (
                <>
                  {" · last used "}
                  {fmtDate(existingKey.last_used_at, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </>
              )}
            </span>
          </>
        ) : (
          <span className="text-muted">No key on file</span>
        )}
      </div>

      {newKey && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-accent mb-1">
            New key — copy now, never shown again
          </div>
          <code className="block text-[10.5px] bg-bg border border-border rounded p-2 break-all mono">
            {newKey}
          </code>
          <div className="text-[10.5px] text-muted mt-2">
            Use in Claude Code:{" "}
            <code className="mono text-fg">
              curl -H &quot;Authorization: Bearer {newKey.slice(0, 12)}…&quot; …
            </code>
          </div>
        </div>
      )}
    </div>
  );
}
