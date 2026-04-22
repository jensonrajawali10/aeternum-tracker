"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import { Panel } from "@/components/Panel";

interface Resp {
  cc_emails: string[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CcEmailsPanel() {
  const { data, mutate, isLoading } = useSWR<Resp>("/api/hot-news-settings", fetcher);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  // clear transient hints
  useEffect(() => {
    if (!savedHint) return;
    const t = setTimeout(() => setSavedHint(null), 2500);
    return () => clearTimeout(t);
  }, [savedHint]);

  const commit = useCallback(
    async (next: string[]) => {
      setSaving(true);
      setErr(null);
      try {
        const res = await fetch("/api/hot-news-settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cc_emails: next }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        await mutate();
        setSavedHint("saved");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "save failed");
      } finally {
        setSaving(false);
      }
    },
    [mutate],
  );

  const add = async () => {
    const candidate = input.trim().toLowerCase();
    if (!candidate) return;
    if (!EMAIL_RE.test(candidate)) {
      setErr("Not a valid email");
      return;
    }
    const current = data?.cc_emails ?? [];
    if (current.includes(candidate)) {
      setErr("Already in list");
      return;
    }
    if (current.length >= 20) {
      setErr("Max 20 recipients");
      return;
    }
    setInput("");
    await commit([...current, candidate]);
  };

  const remove = async (email: string) => {
    const current = data?.cc_emails ?? [];
    await commit(current.filter((e) => e !== email));
  };

  const list = data?.cc_emails ?? [];

  return (
    <Panel
      title="Email CC list"
      subtitle="Copied on hot-news digests, alert fires, and critical agent signals"
    >
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="email"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (err) setErr(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="partner@domain.com"
            className="flex-1 bg-elevated border border-border rounded px-3 py-[6px] text-[12px] outline-none focus:border-accent"
            disabled={saving}
          />
          <button
            type="button"
            onClick={add}
            disabled={saving || !input.trim()}
            className="bg-accent text-bg px-3 py-[6px] rounded text-[12px] font-medium disabled:opacity-40"
          >
            Add
          </button>
        </div>

        {(err || savedHint) && (
          <div className={`text-[11px] ${err ? "text-neg" : "text-pos"}`}>
            {err || savedHint}
          </div>
        )}

        {isLoading ? (
          <div className="text-[11px] text-muted">Loading…</div>
        ) : list.length === 0 ? (
          <div className="text-[11px] text-muted">No CC recipients yet.</div>
        ) : (
          <ul className="divide-y divide-border border border-border rounded">
            {list.map((email) => (
              <li
                key={email}
                className="flex items-center justify-between px-3 py-[6px] text-[12px]"
              >
                <span className="font-mono break-all">{email}</span>
                <button
                  type="button"
                  onClick={() => remove(email)}
                  disabled={saving}
                  className="text-[11px] text-muted hover:text-neg transition-colors disabled:opacity-40"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="text-[11px] text-muted">
          {list.length}/20 recipients
        </div>
      </div>
    </Panel>
  );
}
