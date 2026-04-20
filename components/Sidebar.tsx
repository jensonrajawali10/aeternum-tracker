"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/format";

type NavItem = { href: string; label: string };
type NavGroup = { label: string; items: NavItem[] };

const NAV: NavGroup[] = [
  { label: "", items: [{ href: "/dashboard", label: "Dashboard" }] },
  {
    label: "Books",
    items: [
      { href: "/holdings", label: "Holdings" },
      { href: "/crypto-trading", label: "Crypto Trading" },
      { href: "/idx-trading", label: "IDX Trading" },
    ],
  },
  {
    label: "Analysis",
    items: [
      { href: "/positions", label: "Positions" },
      { href: "/benchmark", label: "Benchmarking" },
      { href: "/risk", label: "Risk" },
      { href: "/journal", label: "Journal" },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/alerts", label: "Alerts" },
      { href: "/watchlist", label: "Watchlist" },
      { href: "/news", label: "News Feed" },
      { href: "/earnings", label: "Earnings" },
      { href: "/agents", label: "Agents" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-[220px] shrink-0 border-r border-border bg-panel flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-border">
        <div className="text-accent font-semibold text-[13px] tracking-[0.18em]">AETERNUM</div>
        <div className="text-muted text-[10px] tracking-[0.12em] mt-1">PORTFOLIO TRACKER</div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-3" : ""}>
            {group.label && (
              <div className="px-5 py-1 text-muted-2 text-[9.5px] uppercase tracking-[0.18em] font-medium">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "block px-5 py-[7px] text-[12.5px] transition-colors border-l-2",
                    active
                      ? "text-accent border-accent bg-hover"
                      : "text-fg border-transparent hover:text-accent hover:bg-hover",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-border px-5 py-3">
        <form action="/logout" method="POST">
          <button
            type="submit"
            className="text-[11px] text-muted hover:text-accent tracking-wider uppercase transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
