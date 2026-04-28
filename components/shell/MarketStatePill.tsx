"use client";

import { useEffect, useState } from "react";

type Market = "IDX" | "NYSE" | "CRYPTO";
type State = "OPEN" | "PRE" | "CLOSED" | "AFTER";

/**
 * Compute IDX session state from the current time in WIB.
 *   Mon-Fri: pre 08:55-09:00, open 09:00-12:00 + 13:30-16:00
 *   Sat/Sun: closed
 */
function idxState(now: Date): State {
  const wib = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const day = wib.getDay();
  if (day === 0 || day === 6) return "CLOSED";
  const minutes = wib.getHours() * 60 + wib.getMinutes();
  if (minutes >= 8 * 60 + 55 && minutes < 9 * 60) return "PRE";
  if (minutes >= 9 * 60 && minutes < 12 * 60) return "OPEN";
  if (minutes >= 13 * 60 + 30 && minutes < 16 * 60) return "OPEN";
  return "CLOSED";
}

/**
 * Compute NYSE session state from current time.  Returns one of
 * PRE (04:00-09:30 ET), OPEN (09:30-16:00 ET), AFTER (16:00-20:00 ET),
 * CLOSED otherwise. DST shifts handled by the IANA zone string.
 */
function nyseState(now: Date): State {
  const et = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const day = et.getDay();
  if (day === 0 || day === 6) return "CLOSED";
  const minutes = et.getHours() * 60 + et.getMinutes();
  if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) return "PRE";
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return "OPEN";
  if (minutes >= 16 * 60 && minutes < 20 * 60) return "AFTER";
  return "CLOSED";
}

function stateColor(state: State): string {
  if (state === "OPEN") return "var(--color-up)";
  if (state === "PRE" || state === "AFTER") return "var(--color-accent)";
  return "var(--color-muted-2)";
}

export function MarketStatePill({ market }: { market: Market }) {
  const [state, setState] = useState<State>("CLOSED");

  useEffect(() => {
    function tick() {
      const now = new Date();
      if (market === "IDX") setState(idxState(now));
      else if (market === "NYSE") setState(nyseState(now));
      else setState("OPEN"); // crypto trades 24/7
    }
    tick();
    // 30s cadence is fine — session boundaries shift at minute granularity
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [market]);

  const color = stateColor(state);
  const label = market === "CRYPTO" ? "24H" : state;

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 h-[20px] rounded-[3px] border"
      style={{
        borderColor: "var(--color-border-strong)",
        background: "var(--color-panel-2)",
      }}
    >
      <span
        className="inline-block rounded-full"
        style={{
          width: 5,
          height: 5,
          background: color,
          boxShadow: `0 0 5px 0 ${color}`,
        }}
        aria-hidden
      />
      <span
        className="mono uppercase text-fg"
        style={{ fontSize: 9.5, letterSpacing: "0.14em" }}
      >
        {market}
      </span>
      <span
        className="mono uppercase"
        style={{
          fontSize: 9,
          letterSpacing: "0.14em",
          color: state === "OPEN" ? "var(--color-up)" : "var(--color-muted)",
        }}
      >
        {label}
      </span>
    </div>
  );
}
