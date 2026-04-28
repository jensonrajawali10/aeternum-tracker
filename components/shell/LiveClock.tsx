"use client";

import { useEffect, useState } from "react";

/**
 * Ticking WIB clock for the desktop TopBar — updates every second so
 * the page reads as "live" rather than a static dashboard. Format
 * matches Bloomberg-style HH:MM:SS WIB.
 *
 * Lazy useState initialiser keeps Date.now()-derived state out of the
 * render body (React 19 strict-purity rule).  setInterval lives in an
 * effect and clears on unmount.
 */
function nowWIB(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

export function LiveClock() {
  const [time, setTime] = useState<string>(() => nowWIB());

  useEffect(() => {
    const t = setInterval(() => setTime(nowWIB()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center gap-1.5">
      <span
        className="mono text-fg"
        style={{ fontSize: 11, letterSpacing: "0.04em" }}
        aria-label="Time in Asia/Jakarta"
      >
        {time}
      </span>
      <span
        className="mono uppercase text-muted-2"
        style={{ fontSize: 9, letterSpacing: "0.14em" }}
      >
        WIB
      </span>
    </div>
  );
}
