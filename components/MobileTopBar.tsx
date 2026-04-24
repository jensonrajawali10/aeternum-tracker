"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Mobile-only top bar with a hamburger that toggles the Sidebar drawer.
 * Desktop has its own always-visible sidebar so this component is
 * hidden via md:hidden.  The drawer state is broadcast via a CustomEvent
 * so the Sidebar component (a sibling) can listen without a shared
 * client parent — keeps the server-rendered AppLayout clean.
 *
 * Route changes auto-close the drawer (better UX than leaving it open
 * when the user taps a nav item).
 */
export function MobileTopBar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // React-19-blessed "derive state during render" pattern — closes the
  // drawer whenever the route changes (nav click) without tripping the
  // set-state-in-effect rule.  Setting state in a render pass is
  // legal when it's guarded by a changed-input comparison.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("aeternum:sidebar", { detail: { open } }),
    );
    // Prevent body scroll when drawer is open.
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden sticky top-0 z-40 flex items-center justify-between border-b border-border bg-panel/95 backdrop-blur px-3 py-2.5">
      <button
        type="button"
        aria-label={open ? "Close navigation" : "Open navigation"}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center w-8 h-8 rounded border border-border text-muted hover:text-fg hover:border-border/80"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          {open ? (
            <path
              d="M3 3l10 10M13 3L3 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          ) : (
            <>
              <path d="M2 4h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </>
          )}
        </svg>
      </button>
      <div className="flex items-baseline gap-1.5">
        <span className="w-[5px] h-[5px] rounded-full bg-accent inline-block" />
        <span className="serif text-[14px] text-fg">Aeternum</span>
      </div>
      <span className="w-8" aria-hidden />
    </div>
  );
}
