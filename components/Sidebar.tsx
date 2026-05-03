"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clsx } from "@/lib/format";

type NavItem = { href: string; label: string; exactMatch?: boolean };
type NavGroup = { label: string; num: string; items: NavItem[] };

/**
 * Sidebar restructure for the CIO cockpit model:
 *
 *   FIRM  — the view from the holding company: all-books aggregate, capital
 *           between arms, firm-wide risk, the decision journal.
 *   BOOKS — each trading arm as its own workspace (/books/<slug>) with
 *           Positions/Performance/Risk/Trades/Notes tabs.
 *   TOOLS — supporting utilities that span the firm: alerts, watchlist,
 *           news, earnings, analysts, settings.
 *
 * Active state matches the URL prefix so all book sub-routes stay lit under
 * their BOOKS entry.
 *
 * Responsive behaviour:
 *   - md+ viewports: always-visible 172px left column (current desktop).
 *   - <md viewports: fixed-positioned drawer, off-screen by default;
 *     slides in when MobileTopBar dispatches `aeternum:sidebar` events.
 *     Backdrop click and any nav click both close the drawer.
 */
// Hyperlane-style numbered groups — the prefix becomes part of the
// group identity so the sidebar reads as a sectioned table of contents
// rather than three loose lists. Numbers stay zero-padded for visual
// alignment even after the codebase grows past 9 groups.
const NAV: NavGroup[] = [
  {
    num: "01",
    label: "Firm",
    items: [
      { href: "/dashboard", label: "Command Center" },
      { href: "/capital", label: "Capital" },
      { href: "/risk", label: "Firm Risk" },
      { href: "/journal", label: "Journal" },
      { href: "/memos", label: "Memos" },
      { href: "/catalysts", label: "Catalysts" },
    ],
  },
  {
    num: "02",
    label: "Books",
    items: [
      { href: "/books/investing", label: "Investing" },
      { href: "/books/idx-trading", label: "IDX Trading" },
      { href: "/books/crypto-trading", label: "Crypto Trading" },
    ],
  },
  {
    num: "03",
    label: "Tools",
    items: [
      { href: "/watchlist", label: "Watchlist" },
      { href: "/alerts", label: "Alerts" },
      { href: "/news", label: "News" },
      { href: "/earnings", label: "Earnings" },
      { href: "/agents", label: "Analysts" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function onToggle(e: Event) {
      const ev = e as CustomEvent<{ open: boolean }>;
      setMobileOpen(!!ev.detail?.open);
    }
    window.addEventListener("aeternum:sidebar", onToggle);
    return () => window.removeEventListener("aeternum:sidebar", onToggle);
  }, []);

  return (
    <>
      {/* Mobile backdrop — visible only when drawer is open on <md */}
      <div
        onClick={() => {
          window.dispatchEvent(
            new CustomEvent("aeternum:sidebar", { detail: { open: false } }),
          );
        }}
        className={clsx(
          "md:hidden fixed inset-0 z-40 bg-bg/70 backdrop-blur-sm transition-opacity",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        aria-hidden
      />
      <aside
        className={clsx(
          "border-r border-border bg-panel flex flex-col",
          // Desktop: inline 172px column. Height fills remaining vertical
          // space below the global TopBar (no longer h-screen since we
          // now have a topbar+footer chrome above/below).
          "md:w-[172px] md:shrink-0 md:flex md:h-auto md:self-stretch md:translate-x-0",
          // Mobile: fixed-position drawer, 85vw wide max 300px, slides from left.
          "fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[300px] h-screen transition-transform duration-200 md:relative md:inset-auto md:h-auto",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="px-4 pt-4 pb-3 border-b border-border md:hidden">
          {/* Mobile drawer header — desktop sidebar's header is rolled up
              into the global TopBar, so we only need a wordmark here when
              the drawer is the only chrome (mobile <md viewport). */}
          <div className="flex items-baseline gap-2">
            <span
              className="w-[6px] h-[6px] rounded-full inline-block"
              style={{
                background: "var(--color-accent)",
                boxShadow: "0 0 8px 0 var(--color-accent)",
              }}
            />
            <span
              className="font-medium text-fg"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                letterSpacing: "-0.01em",
              }}
            >
              Aeternum
            </span>
          </div>
          <div className="mono text-[9px] text-muted-2 mt-[3px] pl-[14px] tracking-[0.18em] uppercase">
            CIO cockpit
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map((group, gi) => (
            <div key={gi} className={gi > 0 ? "mt-4" : ""}>
              {group.label && (
                <div className="px-[14px] py-1 mb-[2px] flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em]">
                  {/* Group number stays amber — brand-mark spine.
                      Active page state inside the group lights up
                      in purple instead. */}
                  <span className="mono text-amber">{group.num}</span>
                  <span className="text-muted-2">{group.label}</span>
                  <span
                    className="flex-1 h-px bg-border"
                    aria-hidden
                  />
                </div>
              )}
              {group.items.map((item) => {
                const active = item.exactMatch
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch
                    className={clsx(
                      "relative block pl-[14px] pr-3 py-[6px] text-[12px] transition-all duration-150",
                      active
                        ? "text-fg"
                        : "text-muted hover:text-fg hover:bg-elevated hover:translate-x-[1px]",
                    )}
                    style={
                      active
                        ? { background: "var(--color-purple-bg)" }
                        : undefined
                    }
                  >
                    {active && (
                      // Active rail switched from amber accent to purple
                      // chrome per the terminal brief — purple is reserved
                      // for active nav state and :focus-visible outlines.
                      <span
                        className="absolute left-0 top-0 bottom-0 w-[2px]"
                        style={{ background: "var(--color-purple)" }}
                        aria-hidden
                      />
                    )}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-border px-[14px] py-3">
          <form action="/logout" method="POST">
            <button
              type="submit"
              className="text-[11px] text-muted hover:text-fg transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
