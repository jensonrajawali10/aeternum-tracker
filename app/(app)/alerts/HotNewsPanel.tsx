"use client";

import useSWR, { mutate } from "swr";
import { useEffect, useState } from "react";
import { fmtDate } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";

interface RecentRow {
  news_id: string;
  title: string;
  url: string;
  source: string | null;
  ticker: string | null;
  score: number;
  reasons: string[];
  sent_at: string;
  email_ok: boolean;
}

interface Resp {
  hot_news_email: boolean;
  hot_news_min_score: number;
  hot_news_last_run_at: string | null;
  recent: RecentRow[];
}

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export function HotNewsPanel() {
  const { data } = useSWR<Resp>("/api/hot-news-settings", fetcher, {
    refreshInterval: 20_000,
    revalidateOnFocus: true,
    keepPreviousData: true,
    dedupingInterval: 5_000,
  });
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [livePulse, setLivePulse] = useState(false);

  // Supabase Realtime: subscribe to news_alert_sent INSERTs so we re-fetch the
  // moment the cron writes a new hot row.  This is the actual "realtime" — SWR
  // polling is a 20s fallback; this fires on server push with zero delay.
  useEffect(() => {
    const sb = supabaseBrowser();
    const ch = sb
      .channel("hot-news-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "news_alert_sent" },
        () => {
          mutate("/api/hot-news-settings");
          setLivePulse(true);
          setTimeout(() => setLivePulse(false), 1200);
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, []);

  async function toggle(enabled: boolean) {
    await fetch("/api/hot-news-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hot_news_email: enabled }),
    });
    mutate("/api/hot-news-settings");
  }

  async function setScore(score: number) {
    await fetch("/api/hot-news-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hot_news_min_score: score }),
    });
    mutate("/api/hot-news-settings");
  }

  async function checkNow() {
    setChecking(true);
    setMsg(null);
    const r = await fetch("/api/cron/hot-news", { method: "POST" });
    const j = await r.json();
    setChecking(false);
    if (!r.ok) {
      setMsg(j.error || "Failed");
      return;
    }
    setMsg(`Scanned · ${j.flagged || 0} flagged, ${j.emailed || 0} emailed`);
    mutate("/api/hot-news-settings");
  }

  const enabled = data?.hot_news_email ?? true;
  const score = data?.hot_news_min_score ?? 60;

  return (
    <div className="mb-6 p-4 bg-panel-2 rounded border border-border">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="text-fg text-[13px] font-semibold">Hot news email alerts</div>
            <span
              className={`flex items-center gap-1 px-1.5 py-[1px] rounded text-[9px] uppercase tracking-wider border ${
                livePulse
                  ? "bg-green/20 text-green border-green/50"
                  : "bg-panel text-muted-2 border-border"
              } transition-colors`}
              title="Realtime subscription to news_alert_sent — updates push the moment the cron inserts a row"
            >
              <span
                className={`w-[5px] h-[5px] rounded-full ${livePulse ? "bg-green animate-pulse" : "bg-green/60"}`}
              />
              {livePulse ? "new" : "live"}
            </span>
          </div>
          <div className="text-muted text-[11px] leading-relaxed max-w-xl">
            Emails you breaking headlines for your positions + watchlist: halts, M&A, earnings surprises,
            ratings changes, bankruptcies, regulatory actions, hacks, ±double-digit moves. Dedupes so
            you never get the same story twice.
          </div>
        </div>
        <label className="flex items-center gap-2 text-[12px] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => toggle(e.target.checked)}
            className="accent-accent"
          />
          <span className={enabled ? "text-green" : "text-muted"}>{enabled ? "Armed" : "Off"}</span>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[11px] text-muted">
          Sensitivity
          <select
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="text-[11px]"
          >
            <option value={40}>High (score ≥ 40 — more emails)</option>
            <option value={60}>Medium (score ≥ 60 — default)</option>
            <option value={80}>Low (score ≥ 80 — only major events)</option>
          </select>
        </label>
        <button
          onClick={checkNow}
          disabled={checking}
          className="px-3 py-1 rounded border border-border hover:border-accent text-[11px] tracking-wide disabled:opacity-50"
        >
          {checking ? "Checking…" : "Check now"}
        </button>
        {data?.hot_news_last_run_at && (
          <span className="text-[10.5px] text-muted-2">
            Last run {fmtDate(data.hot_news_last_run_at, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        {msg && <span className="text-[10.5px] text-accent">· {msg}</span>}
      </div>

      {data?.recent && data.recent.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="text-[10px] uppercase tracking-wider text-muted mb-2">Recent hot items</div>
          <div className="space-y-2 max-h-[260px] overflow-auto">
            {data.recent.slice(0, 10).map((r) => (
              <div key={r.news_id} className="text-[11.5px]">
                <div className="flex items-center gap-2 text-[10px] text-muted-2 mb-0.5">
                  {r.ticker && <span className="text-accent font-semibold">{r.ticker}</span>}
                  <span>{r.source}</span>
                  <span>· score {r.score}</span>
                  <span>· {fmtDate(r.sent_at, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  {r.email_ok && <span className="text-green">· emailed</span>}
                </div>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group text-fg hover:text-accent hover:underline transition-colors block leading-snug"
                >
                  {r.title}
                  <span
                    aria-hidden
                    className="ml-1 inline-block align-baseline text-[10px] text-muted-2 group-hover:text-accent transition-colors"
                  >
                    ↗
                  </span>
                </a>
                {r.reasons.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {r.reasons.slice(0, 4).map((reason) => (
                      <span key={reason} className="text-[9px] px-1.5 py-[1px] rounded bg-panel border border-border text-muted-2 uppercase tracking-wide">
                        {reason}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
