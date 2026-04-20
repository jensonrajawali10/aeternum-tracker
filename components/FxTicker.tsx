"use client";

import useSWR from "swr";
import { fmtNumber, fmtPct, signClass } from "@/lib/format";

interface FxResp {
  pair: string;
  rate: number;
  prev_close: number | null;
  day_change_pct: number | null;
  at: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function FxTicker({ from = "USD", to = "IDR" }: { from?: string; to?: string }) {
  const { data, isLoading } = useSWR<FxResp>(
    `/api/fx?from=${from}&to=${to}`,
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: true },
  );

  return (
    <div className="flex items-center gap-2 px-3 py-[5px] rounded border border-border bg-panel text-[11px]">
      <span className="text-muted tracking-[0.12em] uppercase">{from}/{to}</span>
      <span className="font-semibold tabular-nums">
        {isLoading || !data?.rate ? "…" : fmtNumber(data.rate, to === "IDR" ? 0 : 4)}
      </span>
      {data?.day_change_pct != null && (
        <span className={`tabular-nums text-[10px] ${signClass(data.day_change_pct)}`}>
          {fmtPct(data.day_change_pct, 2, true)}
        </span>
      )}
      <span className="w-[6px] h-[6px] rounded-full bg-accent/70 animate-pulse" title="Live" />
    </div>
  );
}
