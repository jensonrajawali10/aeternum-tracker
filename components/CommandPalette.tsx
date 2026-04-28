"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Command } from "cmdk";
import useSWR from "swr";
import { useDensity } from "./DensityProvider";

interface Position {
  ticker: string;
  asset_class: string;
}
interface PositionsResp {
  positions: Position[];
}
interface WatchItem {
  id: string;
  ticker: string;
  asset_class: string;
}
interface WatchResp {
  items: WatchItem[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const FIRM_NAV: { href: string; label: string; hint?: string }[] = [
  { href: "/dashboard", label: "Command Center", hint: "g d" },
  { href: "/capital", label: "Capital", hint: "g c" },
  { href: "/risk", label: "Firm Risk", hint: "g r" },
  { href: "/journal", label: "Journal", hint: "g j" },
  { href: "/memos", label: "Memos", hint: "g m" },
];

const BOOK_NAV: { href: string; label: string }[] = [
  { href: "/books/investing", label: "Investing" },
  { href: "/books/idx-trading", label: "IDX Trading" },
  { href: "/books/crypto-trading", label: "Crypto Trading" },
];

const TOOL_NAV: { href: string; label: string; hint?: string }[] = [
  { href: "/watchlist", label: "Watchlist", hint: "g w" },
  { href: "/alerts", label: "Alerts" },
  { href: "/news", label: "News" },
  { href: "/earnings", label: "Earnings" },
  { href: "/agents", label: "Analysts" },
  { href: "/settings", label: "Settings" },
];

const SKILL_TRIGGERS: { slug: string; name: string }[] = [
  { slug: "macro-intelligence", name: "Macro Intelligence" },
  { slug: "alpha-generator", name: "Alpha Generator" },
  { slug: "risk-sentinel", name: "Risk Sentinel" },
  { slug: "universe-brief", name: "Universe Brief" },
];

function tickerIcon(asset_class: string): string {
  if (asset_class === "crypto" || asset_class === "fx") return "₿";
  return "$";
}

/**
 * CommandPalette — Cmd+K (or Ctrl+K) opens a global terminal-style
 * spotlight built on cmdk.  `/` opens it too when not focused on an
 * input.  Three groups + actions:
 *
 *   TICKERS   — fuzzy search over open positions + watchlist
 *   PAGES     — every nav target (Firm / Books / Tools)
 *   ACTIONS   — currency toggle, density toggle, skill triggers
 *
 * Skill triggers are bookmarks: selecting one POSTs to the existing
 * /api/agents/[slug]/trigger and shows a toast.  Real agent execution
 * still happens locally in Claude Code — this just records the manual
 * invocation in the signals feed.
 *
 * Listens for the `aeternum:command-palette` window event so any
 * surface can open the palette without prop-drilling (the TopBar's
 * command-bar trigger uses this).
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { density, toggle: toggleDensity } = useDensity();

  // Pull positions + watchlist on demand — only fetch when the palette
  // has been opened at least once so we don't spend a request on every
  // page load.  SWR caches across opens.
  const [primed, setPrimed] = useState(false);
  const { data: positions } = useSWR<PositionsResp>(
    primed ? "/api/positions" : null,
    fetcher,
    { dedupingInterval: 30_000 },
  );
  const { data: watchlist } = useSWR<WatchResp>(
    primed ? "/api/watchlist" : null,
    fetcher,
    { dedupingInterval: 30_000 },
  );

  // Combined ticker set — dedup by ticker, positions come first.
  const tickers: { ticker: string; asset_class: string; source: "position" | "watchlist" }[] = (() => {
    const seen = new Map<
      string,
      { ticker: string; asset_class: string; source: "position" | "watchlist" }
    >();
    for (const p of positions?.positions ?? []) {
      if (!seen.has(p.ticker)) {
        seen.set(p.ticker, {
          ticker: p.ticker,
          asset_class: p.asset_class,
          source: "position",
        });
      }
    }
    for (const w of watchlist?.items ?? []) {
      if (!seen.has(w.ticker)) {
        seen.set(w.ticker, {
          ticker: w.ticker,
          asset_class: w.asset_class,
          source: "watchlist",
        });
      }
    }
    return [...seen.values()];
  })();

  const close = useCallback(() => setOpen(false), []);

  const openAndPrime = useCallback(() => {
    setPrimed(true);
    setOpen(true);
  }, []);

  // Cmd/Ctrl+K, "/" (when not in an input), and the global window event
  useEffect(() => {
    function isFormElement(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t.isContentEditable
      );
    }
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openAndPrime();
        return;
      }
      if (e.key === "/" && !isFormElement(e.target) && !open) {
        e.preventDefault();
        openAndPrime();
      }
    }
    function onAppEvent() {
      openAndPrime();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("aeternum:command-palette", onAppEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("aeternum:command-palette", onAppEvent);
    };
  }, [open, openAndPrime]);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  const setCurrency = useCallback(
    (ccy: "IDR" | "USD") => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("ccy", ccy);
      router.replace(`?${params.toString()}`);
      close();
    },
    [close, router, searchParams],
  );

  const triggerSkill = useCallback(
    async (slug: string) => {
      close();
      try {
        await fetch(`/api/agents/${slug}/trigger`, { method: "POST" });
      } catch {
        // best-effort log — real execution happens in Claude Code locally
      }
    },
    [close],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[14vh] px-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <Command
        label="Command palette"
        loop
        className="w-full max-w-[640px] rounded-[8px] overflow-hidden border"
        style={{
          background: "var(--color-panel)",
          borderColor: "var(--color-border-strong)",
          boxShadow:
            "0 20px 60px -10px rgba(0,0,0,0.6), 0 8px 24px -6px rgba(0,0,0,0.4)",
        }}
      >
        <div
          className="flex items-center gap-2 px-4 h-[48px] border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <circle cx="6" cy="6" r="4.5" stroke="var(--color-muted)" strokeWidth="1.2" />
            <line
              x1="9"
              y1="9"
              x2="12"
              y2="12"
              stroke="var(--color-muted)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          <Command.Input
            autoFocus
            placeholder="Search tickers, jump to a page, trigger an analyst…"
            className="flex-1 bg-transparent border-none outline-none text-fg text-[13px] placeholder:text-muted-2"
            style={{ padding: 0 }}
          />
          <kbd
            className="mono text-[9.5px] px-1.5 py-[1px] rounded-[2px]"
            style={{
              background: "var(--color-bg)",
              border: "1px solid var(--color-border-strong)",
              color: "var(--color-muted)",
            }}
          >
            Esc
          </kbd>
        </div>

        <Command.List
          className="max-h-[440px] overflow-y-auto p-2 cmdpal-list"
          style={{ background: "var(--color-panel)" }}
        >
          <Command.Empty className="px-3 py-6 text-center text-[11.5px] text-muted-2">
            No matches.
          </Command.Empty>

          <Command.Group heading="Tickers">
            {tickers.length === 0 && primed ? (
              <Command.Item disabled className="cmd-row cmd-row-disabled">
                <span className="text-muted-2 text-[11px]">
                  No positions or watchlist on file yet.
                </span>
              </Command.Item>
            ) : null}
            {tickers.map((t) => (
              <Command.Item
                key={`tk-${t.ticker}`}
                value={`ticker ${t.ticker} ${t.source}`}
                onSelect={() =>
                  go(`/watchlist?ticker=${encodeURIComponent(t.ticker)}`)
                }
                className="cmd-row"
              >
                <span
                  className="mono inline-flex items-center justify-center w-[18px] h-[18px] rounded-[3px] shrink-0"
                  style={{
                    background: "var(--color-bg)",
                    color:
                      t.asset_class === "crypto"
                        ? "var(--color-magenta)"
                        : "var(--color-cyan)",
                    fontSize: 10,
                  }}
                >
                  {tickerIcon(t.asset_class)}
                </span>
                <span className="mono text-fg text-[12px] flex-1">{t.ticker}</span>
                <span
                  className="text-[10px] uppercase tracking-[0.10em] text-muted-2"
                >
                  {t.source}
                </span>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Pages · Firm">
            {FIRM_NAV.map((p) => (
              <Command.Item
                key={`firm-${p.href}`}
                value={`firm ${p.label}`}
                onSelect={() => go(p.href)}
                className="cmd-row"
              >
                <span className="text-[12px] flex-1">{p.label}</span>
                {p.hint && <kbd className="cmd-hint">{p.hint}</kbd>}
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Pages · Books">
            {BOOK_NAV.map((p) => (
              <Command.Item
                key={`book-${p.href}`}
                value={`book ${p.label}`}
                onSelect={() => go(p.href)}
                className="cmd-row"
              >
                <span className="text-[12px] flex-1">{p.label}</span>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Pages · Tools">
            {TOOL_NAV.map((p) => (
              <Command.Item
                key={`tool-${p.href}`}
                value={`tool ${p.label}`}
                onSelect={() => go(p.href)}
                className="cmd-row"
              >
                <span className="text-[12px] flex-1">{p.label}</span>
                {p.hint && <kbd className="cmd-hint">{p.hint}</kbd>}
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Actions">
            <Command.Item
              value="action currency idr"
              onSelect={() => setCurrency("IDR")}
              className="cmd-row"
            >
              <span className="text-[12px] flex-1">Currency · IDR</span>
            </Command.Item>
            <Command.Item
              value="action currency usd"
              onSelect={() => setCurrency("USD")}
              className="cmd-row"
            >
              <span className="text-[12px] flex-1">Currency · USD</span>
            </Command.Item>
            <Command.Item
              value="action density toggle"
              onSelect={() => {
                toggleDensity();
                close();
              }}
              className="cmd-row"
            >
              <span className="text-[12px] flex-1">
                Density · toggle ({density})
              </span>
            </Command.Item>
            {SKILL_TRIGGERS.map((s) => (
              <Command.Item
                key={`skill-${s.slug}`}
                value={`action skill ${s.slug} ${s.name}`}
                onSelect={() => triggerSkill(s.slug)}
                className="cmd-row"
              >
                <span
                  className="mono text-[9.5px] uppercase tracking-[0.14em] shrink-0"
                  style={{ color: "var(--color-accent)" }}
                >
                  trigger
                </span>
                <span className="text-[12px] flex-1">{s.name}</span>
                <span className="text-[10px] mono text-muted-2">{s.slug}</span>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>

        <div
          className="px-4 h-[28px] flex items-center gap-3 border-t text-[10px] mono uppercase text-muted-2"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-bg)",
            letterSpacing: "0.14em",
          }}
        >
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
          <div className="flex-1" />
          <span>⌘K · /</span>
        </div>
      </Command>
    </div>
  );
}
