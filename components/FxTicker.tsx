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
    <div className="flex items-center gap-2 px-3 h-[28px] rounded-[6px] border border-border bg-panel mono text-[11px]">
      <span className="text-muted">{from}/{to}</span>
      <span className="text-fg">
        {isLoading || !data?.rate ? "…" : fmtNumber(data.rate, to === "IDR" ? 0 : 4)}
      </span>
      {data?.day_change_pct != null && (
        <span className={`text-[10.5px] ${signClass(data.day_change_pct)}`}>
          {fmtPct(data.day_change_pct, 2, true)}
        </span>
      )}
      <span className="live-dot ml-[2px]" title="Live" />
    </div>
  );
}
