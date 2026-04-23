"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";

interface NavResp {
  fx?: { usd_idr?: number };
  hl?: { account_value_idr?: number };
}

interface PositionsResp {
  positions?: { ticker: string; live_price: number | null }[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Tiny timestamp / context pill that shows:
 *   · "As of 14:23 WIB" (client clock, Jakarta time)
 *   · "FX 17,303" (USD→IDR from /api/portfolio/nav)
 *   · "N stale" (positions whose last mark is >10 min old)
 *
 * Drop into TopHeader's `children` slot alongside the BookSwitcher so every
 * live-data page carries the same context bar.
 */
export function AsOfStamp() {
  const { data: nav } = useSWR<NavResp>("/api/portfolio/nav", fetcher, { refreshInterval: 60_000 });
  const { data: pos } = useSWR<PositionsResp>("/api/positions", fetcher, { refreshInterval: 60_000 });

  // Re-render every 30s so the wall-clock portion stays current
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  // `tick` is only here to retrigger the component — reference it so the
  // linter doesn't strip it out as unused.
  void tick;

  const wib = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

  const fx = nav?.fx?.usd_idr;
  const fxLabel = fx ? fx.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—";

  // A position with no live_price means the quote fetch failed or the price
  // cache returned null — flag those as "stale" so Jenson knows some marks on
  // the page are falling back to entry price.
  const stale = (pos?.positions ?? []).filter((p) => p.live_price == null).length;

  return (
    <div className="flex items-center gap-2 text-[10.5px] text-muted-2 tabular-nums border border-border bg-panel-2 rounded-[4px] px-2.5 py-1.5 font-mono">
      <span>
        <span className="text-muted">As of</span>{" "}
        <span className="text-fg/90">{wib} WIB</span>
      </span>
      <span className="text-border">·</span>
      <span>
        <span className="text-muted">FX</span>{" "}
        <span className="text-fg/90">{fxLabel}</span>
      </span>
      {stale > 0 && (
        <>
          <span className="text-border">·</span>
          <span className="text-amber-400/90" title="Positions with marks older than 10 min">
            {stale} stale
          </span>
        </>
      )}
    </div>
  );
}
