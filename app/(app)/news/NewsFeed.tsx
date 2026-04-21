"use client";

import { useState } from "react";
import useSWR from "swr";
import { fmtDate } from "@/lib/format";

interface NewsItem {
  id: string;
  title: string;
  published: number;
  source: string;
  url: string;
  summary?: string;
  symbols?: string[];
  urgency?: number;
  score?: number;
  reasons?: string[];
}

interface FeedResp {
  items: NewsItem[];
  fallback?: string;
  agent?: boolean;
  category?: string;
  symbols?: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const CATEGORIES = ["all", "macro", "idx", "stock", "crypto", "markets", "economy"] as const;
type Category = (typeof CATEGORIES)[number];
const CATEGORY_LABEL: Record<Category, string> = {
  all: "All",
  macro: "Macro",
  idx: "IDX",
  stock: "Stocks",
  crypto: "Crypto",
  markets: "Markets",
  economy: "Economy",
};

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return fmtDate(new Date(ms).toISOString(), { month: "short", day: "numeric" });
}

export function NewsFeed() {
  const [category, setCategory] = useState<Category>("all");
  const [hideNoise, setHideNoise] = useState(true);
  const { data, isLoading } = useSWR<FeedResp>(
    `/api/news?category=${category}`,
    fetcher,
    { refreshInterval: 180_000 },
  );

  const raw = data?.items || [];
  // When agent is on, hide items it flagged noise (urgency 0) by default.
  const items = hideNoise && data?.agent
    ? raw.filter((i) => (i.urgency ?? 0) >= 1)
    : raw;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-2 py-[4px] rounded text-[10px] uppercase tracking-wider ${
              category === c
                ? "bg-accent text-bg"
                : "bg-panel-2 text-muted hover:text-fg"
            }`}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
        <div className="flex-1" />
        <span
          className={`px-2 py-[3px] rounded text-[9px] uppercase tracking-wider border ${
            data?.agent
              ? "bg-accent/15 text-accent border-accent/40"
              : "bg-panel-2 text-muted border-border"
          }`}
          title={data?.agent ? "Llama 3.3 70B re-ranks headlines and labels what matters" : "Agent not configured — showing raw feed"}
        >
          {data?.agent ? "agent · llama 3.3" : "agent off"}
        </span>
        {data?.agent && (
          <button
            onClick={() => setHideNoise((v) => !v)}
            className={`px-2 py-[3px] rounded text-[9px] uppercase tracking-wider border ${
              hideNoise
                ? "bg-panel-2 text-fg border-border"
                : "bg-panel-2 text-muted border-border hover:text-fg"
            }`}
          >
            {hideNoise ? "hiding noise" : "showing all"}
          </button>
        )}
      </div>

      {data?.symbols != null && (
        <div className="text-[10px] text-muted mb-2">
          Merged: {data.symbols} tracked tickers + macro + IDX + US markets + crypto · {items.length} shown
        </div>
      )}

      {isLoading && <div className="text-muted text-[12px]">Loading feed…</div>}

      <ul className="divide-y divide-border">
        {items.map((it) => (
          <li key={it.id} className="py-3">
            <a
              href={it.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:bg-hover -mx-2 px-2 py-1 rounded"
            >
              <div className="flex items-center gap-2 text-[10px] text-muted uppercase tracking-wider mb-1">
                <span>{it.source}</span>
                <span>·</span>
                <span>{timeAgo(it.published)}</span>
                {(it.urgency ?? 0) >= 3 && (
                  <span className="ml-1 px-1 py-[1px] bg-red/20 text-red rounded text-[9px] font-bold">
                    BREAKING
                  </span>
                )}
                {(it.urgency ?? 0) === 2 && (
                  <span className="ml-1 px-1 py-[1px] bg-accent/20 text-accent rounded text-[9px] font-bold">
                    HOT
                  </span>
                )}
                {(it.urgency ?? 0) === 1 && (
                  <span className="ml-1 px-1 py-[1px] bg-panel-2 text-muted rounded text-[9px]">
                    context
                  </span>
                )}
                {(it.symbols || []).slice(0, 4).map((s) => (
                  <span key={s} className="text-accent">
                    {s.split(":").pop()}
                  </span>
                ))}
              </div>
              <div className="text-[13px] leading-snug">{it.title}</div>
              {it.reasons && it.reasons.length > 0 && (
                <div className="text-[10px] text-accent mt-1">
                  {it.reasons.slice(0, 2).join(" · ")}
                </div>
              )}
              {it.summary && !it.reasons?.length && (
                <div className="text-[11px] text-muted mt-1 line-clamp-2">{it.summary}</div>
              )}
            </a>
          </li>
        ))}
        {!items.length && !isLoading && (
          <li className="py-8 text-center text-muted">
            {hideNoise && data?.agent && raw.length > 0
              ? "Agent filtered everything as noise. Try 'showing all' or switch to Macro/IDX tab."
              : "No news"}
          </li>
        )}
      </ul>
    </div>
  );
}
