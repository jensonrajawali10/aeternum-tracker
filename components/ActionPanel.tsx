"use client";

import { useState } from "react";
import Link from "next/link";
import { clsx } from "@/lib/format";
import { SignalFeed } from "./SignalFeed";
import { MoversList } from "./MoversList";
import { ExceptionsList } from "./ExceptionsList";

type TabKey = "signals" | "movers" | "catalysts" | "exceptions";

const TABS: { key: TabKey; label: string }[] = [
  { key: "signals", label: "Signals" },
  { key: "movers", label: "Movers" },
  { key: "catalysts", label: "Catalysts" },
  { key: "exceptions", label: "Exceptions" },
];

/**
 * Dashboard Action Panel — the "what needs attention today" feed.  Four
 * tabs reflecting different triage lenses: agent signals, biggest 1D
 * movers, upcoming catalysts (news + earnings), and book exceptions
 * (stale marks, missing stops, deep drawdowns).
 */
export function ActionPanel() {
  const [tab, setTab] = useState<TabKey>("signals");

  return (
    <div>
      <div className="flex items-center gap-1 border-b border-border -mx-4 px-4 mb-3 overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={clsx(
                "relative px-3 py-2 text-[11.5px] tracking-wide transition-colors whitespace-nowrap",
                active ? "text-fg" : "text-muted hover:text-fg",
              )}
            >
              {t.label}
              {active && (
                <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-accent rounded-t" />
              )}
            </button>
          );
        })}
      </div>
      <div className="min-h-[240px]">
        {tab === "signals" && <SignalFeed limit={8} />}
        {tab === "movers" && <MoversList />}
        {tab === "catalysts" && <CatalystsTab />}
        {tab === "exceptions" && <ExceptionsList />}
      </div>
    </div>
  );
}

function CatalystsTab() {
  return (
    <div className="text-[11.5px] text-muted leading-relaxed py-4 space-y-3">
      <p>
        Dedicated catalysts view is a follow-up commit. In the meantime, the
        full feeds live at{" "}
        <Link href="/earnings" className="text-accent hover:underline">
          /earnings
        </Link>{" "}
        (upcoming reports for your tickers) and{" "}
        <Link href="/news" className="text-accent hover:underline">
          /news
        </Link>{" "}
        (Yahoo Finance feed per position / watchlist).
      </p>
      <p>
        Planned: dated calendar rail with earnings + macro prints + dividend
        ex-dates for every ticker in positions and watchlist, plus severity
        tags for agent-flagged catalysts.
      </p>
    </div>
  );
}
