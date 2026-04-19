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
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const CATEGORIES = ["markets", "stock", "crypto", "economy"] as const;
type Category = (typeof CATEGORIES)[number];

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
  const [category, setCategory] = useState<Category>("markets");
  const { data, isLoading } = useSWR<{ items: NewsItem[]; fallback?: string }>(
    `/api/news?category=${category}`,
    fetcher,
    { refreshInterval: 120_000 },
  );

  const items = data?.items || [];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
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
            {c}
          </button>
        ))}
        {data?.fallback === "category" && (
          <span className="text-[10px] text-muted ml-2">
            no positions yet — showing {category} feed
          </span>
        )}
      </div>

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
                {(it.urgency ?? 0) >= 2 && (
                  <span className="ml-1 px-1 py-[1px] bg-red/20 text-red rounded text-[9px]">
                    BREAKING
                  </span>
                )}
                {(it.symbols || []).slice(0, 4).map((s) => (
                  <span key={s} className="text-accent">
                    {s.split(":").pop()}
                  </span>
                ))}
              </div>
              <div className="text-[13px] leading-snug">{it.title}</div>
              {it.summary && (
                <div className="text-[11px] text-muted mt-1 line-clamp-2">{it.summary}</div>
              )}
            </a>
          </li>
        ))}
        {!items.length && !isLoading && (
          <li className="py-8 text-center text-muted">No news</li>
        )}
      </ul>
    </div>
  );
}
