"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useDensity } from "./DensityProvider";
import { clsx } from "@/lib/format";

interface Command {
  id: string;
  label: string;
  group: "Navigate" | "Books" | "Analysts" | "Actions";
  keywords?: string;
  run: () => void | Promise<void>;
  hint?: string;
}

const FIRM_NAV: { href: string; label: string }[] = [
  { href: "/dashboard", label: "Command Center" },
  { href: "/capital", label: "Capital" },
  { href: "/risk", label: "Firm Risk" },
  { href: "/journal", label: "Journal" },
];

const TOOL_NAV: { href: string; label: string }[] = [
  { href: "/watchlist", label: "Watchlist" },
  { href: "/alerts", label: "Alerts" },
  { href: "/news", label: "News" },
  { href: "/earnings", label: "Earnings" },
  { href: "/agents", label: "Analysts" },
  { href: "/settings", label: "Settings" },
];

const BOOKS: { slug: string; name: string }[] = [
  { slug: "investing", name: "Investing" },
  { slug: "idx-trading", name: "IDX Trading" },
  { slug: "crypto-trading", name: "Crypto Trading" },
];

const BOOK_TABS: { suffix: string; label: string }[] = [
  { suffix: "", label: "Overview" },
  { suffix: "/performance", label: "Performance" },
  { suffix: "/risk", label: "Risk" },
  { suffix: "/trades", label: "Trades" },
  { suffix: "/notes", label: "Notes" },
];

const ANALYST_SLUGS: { slug: string; name: string }[] = [
  { slug: "macro-intelligence", name: "Macro Intelligence" },
  { slug: "alpha-generator", name: "Alpha Generator" },
  { slug: "risk-sentinel", name: "Risk Sentinel" },
  { slug: "universe-brief", name: "Universe Brief" },
];

/**
 * Command palette — Cmd+K (or Ctrl+K on Windows) opens a global
 * spotlight-style search with every nav target, every book tab, every
 * analyst, and the most-used actions (currency toggle, density, sign
 * out).  Ships as a client-only modal; keyboard navigation arrow+enter,
 * esc closes.  Fuzzy-filter by label or keyword.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { density, toggle: toggleDensity, setDensity } = useDensity();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCursor(0);
  }, []);

  const setCurrency = useCallback(
    (ccy: "IDR" | "USD") => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("ccy", ccy);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const commands: Command[] = useMemo(() => {
    const cmds: Command[] = [];

    for (const n of FIRM_NAV) {
      cmds.push({
        id: `nav-${n.href}`,
        label: `Go to ${n.label}`,
        group: "Navigate",
        keywords: n.label.toLowerCase(),
        run: () => router.push(n.href),
      });
    }
    for (const n of TOOL_NAV) {
      cmds.push({
        id: `nav-${n.href}`,
        label: `Go to ${n.label}`,
        group: "Navigate",
        keywords: n.label.toLowerCase(),
        run: () => router.push(n.href),
      });
    }

    for (const b of BOOKS) {
      for (const t of BOOK_TABS) {
        cmds.push({
          id: `book-${b.slug}${t.suffix}`,
          label: `${b.name} · ${t.label}`,
          group: "Books",
          keywords: `${b.name} ${b.slug} ${t.label}`.toLowerCase(),
          run: () => router.push(`/books/${b.slug}${t.suffix}`),
        });
      }
    }

    for (const a of ANALYST_SLUGS) {
      cmds.push({
        id: `analyst-run-${a.slug}`,
        label: `Run ${a.name} now`,
        group: "Analysts",
        keywords: `${a.name} ${a.slug} run brief`.toLowerCase(),
        hint: a.slug,
        run: async () => {
          await fetch(`/api/agents/${a.slug}/trigger`, { method: "POST" });
          router.push("/agents");
        },
      });
    }

    cmds.push(
      {
        id: "action-ccy-idr",
        label: "Switch currency to IDR",
        group: "Actions",
        keywords: "rupiah indonesian",
        run: () => setCurrency("IDR"),
      },
      {
        id: "action-ccy-usd",
        label: "Switch currency to USD",
        group: "Actions",
        keywords: "dollar",
        run: () => setCurrency("USD"),
      },
      {
        id: "action-density-toggle",
        label: `Density · switch to ${density === "compact" ? "Roomy" : "Compact"}`,
        group: "Actions",
        keywords: "density compact comfortable layout",
        run: () => toggleDensity(),
      },
      {
        id: "action-density-roomy",
        label: "Density · Roomy (comfortable)",
        group: "Actions",
        keywords: "density comfortable roomy",
        run: () => setDensity("comfortable"),
      },
      {
        id: "action-density-compact",
        label: "Density · Compact",
        group: "Actions",
        keywords: "density compact tight",
        run: () => setDensity("compact"),
      },
      {
        id: "action-sign-out",
        label: "Sign out",
        group: "Actions",
        keywords: "logout leave",
        run: () => {
          const form = document.createElement("form");
          form.method = "POST";
          form.action = "/logout";
          document.body.appendChild(form);
          form.submit();
        },
      },
    );

    return cmds;
  }, [router, density, toggleDensity, setDensity, setCurrency]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    const terms = q.split(/\s+/);
    return commands.filter((c) => {
      const hay = `${c.label} ${c.keywords || ""} ${c.group}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [commands, query]);

  // Derive the effective cursor so an oversized cursor from a prior
  // longer list is clamped without a setState-in-effect round-trip.
  const effectiveCursor = filtered.length === 0 ? 0 : Math.min(cursor, filtered.length - 1);

  // Global hotkey: Cmd+K / Ctrl+K opens; Escape is handled inside the modal.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isK = e.key === "k" || e.key === "K";
      if (isK && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Autofocus input when opened
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  function runAt(i: number) {
    const c = filtered[i];
    if (!c) return;
    void c.run();
    close();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(filtered.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(effectiveCursor);
    }
  }

  if (!open) return null;

  // Group filtered commands
  const groups = new Map<Command["group"], Command[]>();
  for (const c of filtered) {
    const arr = groups.get(c.group) ?? [];
    arr.push(c);
    groups.set(c.group, arr);
  }

  let flatIdx = 0;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/60 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-full max-w-[560px] mx-4 bg-panel border border-border rounded-[10px] shadow-xl overflow-hidden">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a command or page…"
          className="w-full bg-transparent border-0 border-b border-border px-4 py-3 text-[13px] text-fg focus:outline-none"
        />
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-[12px] text-muted text-center">No matches.</div>
          )}
          {Array.from(groups.entries()).map(([group, items]) => (
            <div key={group}>
              <div className="px-4 pt-3 pb-1 text-[9.5px] uppercase tracking-[0.14em] text-muted-2">
                {group}
              </div>
              {items.map((c) => {
                const idx = flatIdx++;
                const active = idx === effectiveCursor;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onMouseEnter={() => setCursor(idx)}
                    onClick={() => runAt(idx)}
                    className={clsx(
                      "w-full text-left px-4 py-[7px] text-[12.5px] flex items-center justify-between transition-colors",
                      active ? "bg-elevated text-fg" : "text-muted hover:text-fg",
                    )}
                  >
                    <span>{c.label}</span>
                    {c.hint && (
                      <span className="mono text-[10.5px] text-muted-2">{c.hint}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="px-4 py-2 text-[10px] text-muted-2 border-t border-border flex items-center justify-between">
          <span>
            <kbd className="px-1 py-[1px] bg-bg border border-border rounded mono text-[9.5px]">↑↓</kbd>{" "}
            navigate ·{" "}
            <kbd className="px-1 py-[1px] bg-bg border border-border rounded mono text-[9.5px]">↵</kbd>{" "}
            select ·{" "}
            <kbd className="px-1 py-[1px] bg-bg border border-border rounded mono text-[9.5px]">esc</kbd>{" "}
            close
          </span>
          <span className="mono">⌘K</span>
        </div>
      </div>
    </div>
  );
}
