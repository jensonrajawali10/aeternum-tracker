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
      { href: "/crypto-trading", label: "Crypto" },
      { href: "/idx-trading", label: "IDX trades" },
    ],
  },
  {
    label: "Analysis",
    items: [
      { href: "/positions", label: "Positions" },
      { href: "/risk", label: "Risk" },
      { href: "/journal", label: "Journal" },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/alerts", label: "Alerts" },
      { href: "/watchlist", label: "Watchlist" },
      { href: "/news", label: "News feed" },
      { href: "/earnings", label: "Earnings" },
      { href: "/agents", label: "Agents" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-[160px] shrink-0 border-r border-border bg-panel hidden md:flex flex-col h-screen sticky top-0">
      <div className="px-4 pt-5 pb-3 border-b border-border">
        <div className="flex items-baseline gap-2">
          <span className="w-[6px] h-[6px] rounded-full bg-accent inline-block" />
          <span className="serif text-[15px] text-fg">Aeternum</span>
        </div>
        <div className="mono text-[10px] text-muted-2 mt-[2px] pl-[14px]">tracker</div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-3" : ""}>
            {group.label && (
              <div className="px-[14px] py-1 text-[10.5px] text-muted-2">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  className={clsx(
                    "relative block pl-[14px] pr-3 py-[6px] text-[12px] transition-all duration-150",
                    active ? "text-fg bg-elevated" : "text-muted hover:text-fg hover:bg-elevated hover:translate-x-[1px]",
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[12px] bg-accent rounded-[1px]" />
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
  );
}
