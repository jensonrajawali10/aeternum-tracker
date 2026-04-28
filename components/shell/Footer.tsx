"use client";

import { useEffect, useState } from "react";

/**
 * Footer status strip — terminal-feel 22px row pinned to the bottom of
 * every authenticated page. Communicates connection health, market
 * session at a glance, and the ⌘K hint.  Stays subtle (muted text,
 * tight font) so it never competes with main content.
 *
 * Connection state and feed health are placeholders for now: the dot
 * goes green if the page has been alive >2s without an error event.
 * Hook up real /api/health checks in a future pass.
 */
export function Footer() {
  const [connected, setConnected] = useState(false);
  // App version is build-time-fixed; lazy useState initialiser keeps the
  // env read out of the effect (React 19 strict-purity rule -- no
  // unnecessary setState-in-effect).
  const [version] = useState<string>(
    () => process.env.NEXT_PUBLIC_APP_VERSION || "dev",
  );

  useEffect(() => {
    const t = setTimeout(() => setConnected(true), 2_000);
    return () => clearTimeout(t);
  }, []);

  return (
    <footer
      className="flex items-center gap-3 px-4 border-t"
      style={{
        height: 22,
        borderColor: "var(--color-border)",
        background: "var(--color-panel)",
        fontSize: 10,
      }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block rounded-full"
          style={{
            width: 5,
            height: 5,
            background: connected ? "var(--color-up)" : "var(--color-muted-2)",
            boxShadow: connected ? "0 0 5px 0 var(--color-up)" : "none",
          }}
          aria-hidden
        />
        <span
          className="mono uppercase text-muted"
          style={{ letterSpacing: "0.14em" }}
        >
          {connected ? "Connected" : "Connecting…"}
        </span>
      </div>

      <span style={{ color: "var(--color-border-strong)" }}>·</span>

      <span
        className="mono uppercase text-muted-2"
        style={{ letterSpacing: "0.14em" }}
      >
        Quote feed: Yahoo · CoinGecko · HL
      </span>

      <div className="flex-1" />

      <span
        className="mono uppercase text-muted-2 hidden md:inline"
        style={{ letterSpacing: "0.14em" }}
      >
        v{version}
      </span>

      <span style={{ color: "var(--color-border-strong)" }} className="hidden md:inline">
        ·
      </span>

      <span
        className="mono uppercase text-muted hidden md:inline"
        style={{ letterSpacing: "0.14em" }}
      >
        ⌘K · Command
      </span>
    </footer>
  );
}
