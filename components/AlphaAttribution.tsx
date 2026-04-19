"use client";

import useSWR from "swr";
import { fmtPct, fmtNumber, signClass } from "@/lib/format";

interface AlphaResp {
  attribution: {
    vs_ihsg: {
      ytd_alpha_pct: number;
      info_ratio: number;
      days_outperform_pct: number;
      active_vol_pct: number;
      hit_rate_pct: number;
    };
    vs_spx: {
      ytd_alpha_pct: number;
      info_ratio: number;
      days_outperform_pct: number;
      active_vol_pct: number;
      hit_rate_pct: number;
    };
  };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function AlphaAttribution({ book }: { book: string }) {
  const bookParam = book === "all" ? "" : `?book=${book}`;
  const { data } = useSWR<AlphaResp>(`/api/portfolio/alpha${bookParam}`, fetcher, {
    refreshInterval: 120_000,
  });

  const rows: { label: string; key: keyof AlphaResp["attribution"]["vs_ihsg"]; fmt: (v: number) => string; signed?: boolean }[] = [
    { label: "YTD Alpha", key: "ytd_alpha_pct", fmt: (v) => fmtPct(v, 2, true), signed: true },
    { label: "Info Ratio", key: "info_ratio", fmt: (v) => fmtNumber(v, 2), signed: true },
    { label: "Days Outperform", key: "days_outperform_pct", fmt: (v) => fmtPct(v, 1) },
    { label: "Active Vol", key: "active_vol_pct", fmt: (v) => fmtPct(v, 1) },
    { label: "Hit Rate", key: "hit_rate_pct", fmt: (v) => fmtPct(v, 1) },
  ];

  return (
    <table className="w-full text-[12px] tabular-nums">
      <thead>
        <tr className="text-muted text-[10px] uppercase tracking-wider border-b border-border">
          <th className="py-2 text-left font-normal">Metric</th>
          <th className="py-2 text-right font-normal">vs IHSG</th>
          <th className="py-2 text-right font-normal">vs S&amp;P</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const i = data?.attribution.vs_ihsg?.[r.key];
          const s = data?.attribution.vs_spx?.[r.key];
          return (
            <tr key={r.key} className="border-b border-border">
              <td className="py-[7px] text-muted">{r.label}</td>
              <td className={`py-[7px] text-right ${r.signed ? signClass(i ?? null) : ""}`}>
                {i != null ? r.fmt(i) : "—"}
              </td>
              <td className={`py-[7px] text-right ${r.signed ? signClass(s ?? null) : ""}`}>
                {s != null ? r.fmt(s) : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
