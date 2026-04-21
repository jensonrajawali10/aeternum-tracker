"use client";

import { useState } from "react";
import useSWR from "swr";
import { fmtDate, fmtNumber } from "@/lib/format";
import type { AssetClass } from "@/lib/types";

interface CalendarRow {
  ticker: string;
  company: string;
  date: string;
  session: "pre" | "post" | "during" | "unknown";
  eps_consensus: number | null;
  revenue_consensus: string | null;
  asset_class?: AssetClass;
}

interface Summary {
  ticker: string;
  next_earnings_date: string | null;
  last_report_date: string | null;
  consensus: { eps: number | null; revenue: string | null };
  recent_reported: {
    eps: number | null;
    revenue: string | null;
    surprise_pct: number | null;
  } | null;
  highlights: string[];
  risks: string[];
  guidance: string | null;
  sources: { title: string; url: string }[];
  generated_at: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SESSION_LABEL: Record<CalendarRow["session"], string> = {
  pre: "pre-market",
  post: "post-market",
  during: "intraday",
  unknown: "—",
};

// Best-effort asset-class guess when the calendar row doesn't carry it.
// IDX tickers are 4 chars and alphabetic. US tickers can be 1-5 chars.
// This is a fallback only — the real answer is carried by the server in
// `asset_class` on the CalendarRow.
function inferAssetClass(ticker: string): AssetClass {
  const t = ticker.toUpperCase().replace(/\.JK$/, "");
  if (/\.JK$/i.test(ticker)) return "idx_equity";
  // Well-known IDX 4-letter tickers that would otherwise look US:
  const IDX_HINTS = new Set([
    "BBRI", "BBCA", "BMRI", "BBNI", "TLKM", "ASII", "ADRO", "INCO", "ANTM", "PTBA",
    "UNVR", "GGRM", "HMSP", "ICBP", "INDF", "KLBF", "SMGR", "UNTR", "MDKA", "MEDC",
    "TINS", "EXCL", "TOWR", "TPIA", "CPIN", "JPFA", "GOTO", "BUKA", "AMRT", "ISAT",
  ]);
  if (IDX_HINTS.has(t)) return "idx_equity";
  return "us_equity";
}

export function EarningsBoard() {
  const { data, isLoading } = useSWR<{ rows: CalendarRow[]; error?: string }>(
    "/api/earnings",
    fetcher,
    { refreshInterval: 10 * 60_000, revalidateOnFocus: false },
  );
  const [selected, setSelected] = useState<{
    ticker: string;
    assetClass: AssetClass;
  } | null>(null);
  const summaryUrl = selected
    ? `/api/earnings/${encodeURIComponent(selected.ticker)}?asset_class=${selected.assetClass}`
    : null;
  const { data: summary, isLoading: summaryLoading } = useSWR<Summary>(summaryUrl, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  });

  const rows = data?.rows || [];

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted mb-2">
          Upcoming · next 90 days
        </div>
        {isLoading && <div className="text-muted text-[12px]">Loading calendar…</div>}
        {data?.error && (
          <div className="text-[11px] text-muted mb-2">{data.error}</div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-muted text-[10px] uppercase tracking-wider border-b border-border">
                <th className="py-2 px-2 text-left font-normal">Ticker</th>
                <th className="py-2 px-2 text-left font-normal">Company</th>
                <th className="py-2 px-2 text-left font-normal">Date</th>
                <th className="py-2 px-2 text-left font-normal">Session</th>
                <th className="py-2 px-2 text-right font-normal">EPS est</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.ticker}-${r.date}`}
                  className={`border-b border-border hover:bg-hover cursor-pointer ${
                    selected?.ticker === r.ticker ? "bg-hover" : ""
                  }`}
                  onClick={() =>
                    setSelected({
                      ticker: r.ticker,
                      assetClass: r.asset_class || inferAssetClass(r.ticker),
                    })
                  }
                >
                  <td className="py-[7px] px-2 font-medium">{r.ticker}</td>
                  <td className="py-[7px] px-2 text-[11px]">{r.company}</td>
                  <td className="py-[7px] px-2 text-[11px]">
                    {fmtDate(r.date, { month: "short", day: "numeric" })}
                  </td>
                  <td className="py-[7px] px-2 text-[11px] text-muted">
                    {SESSION_LABEL[r.session]}
                  </td>
                  <td className="py-[7px] px-2 text-right tabular-nums text-[11px]">
                    {r.eps_consensus != null ? fmtNumber(r.eps_consensus, 2) : "—"}
                  </td>
                </tr>
              ))}
              {!rows.length && !isLoading && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted">
                    No upcoming earnings detected
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted mb-2">
          Call summary {selected ? `· ${selected.ticker}` : ""}
        </div>
        {!selected && (
          <div className="text-muted text-[12px] p-4 bg-panel-2 rounded border border-border">
            Select a ticker on the left to pull a Perplexity-generated summary of the most recent
            earnings call.
          </div>
        )}
        {selected && summaryLoading && (
          <div className="text-muted text-[12px]">Loading Yahoo Finance data…</div>
        )}
        {selected && summary && (
          <div className="space-y-3 text-[12px]">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Next report" value={summary.next_earnings_date || "—"} />
              <Stat label="Last report" value={summary.last_report_date || "—"} />
              <Stat
                label="Cons. EPS"
                value={summary.consensus.eps != null ? fmtNumber(summary.consensus.eps, 2) : "—"}
              />
              <Stat label="Cons. revenue" value={summary.consensus.revenue || "—"} />
              {summary.recent_reported && (
                <>
                  <Stat
                    label="Reported EPS"
                    value={
                      summary.recent_reported.eps != null
                        ? fmtNumber(summary.recent_reported.eps, 2)
                        : "—"
                    }
                  />
                  <Stat
                    label="Surprise"
                    value={
                      summary.recent_reported.surprise_pct != null
                        ? `${fmtNumber(summary.recent_reported.surprise_pct, 1)}%`
                        : "—"
                    }
                    tone={
                      (summary.recent_reported.surprise_pct ?? 0) > 0
                        ? "pos"
                        : (summary.recent_reported.surprise_pct ?? 0) < 0
                          ? "neg"
                          : undefined
                    }
                  />
                </>
              )}
            </div>

            {summary.highlights.length > 0 && (
              <Section title="Highlights">
                <ul className="list-disc list-inside space-y-1 text-[11px]">
                  {summary.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </Section>
            )}

            {summary.risks.length > 0 && (
              <Section title="Risks">
                <ul className="list-disc list-inside space-y-1 text-[11px]">
                  {summary.risks.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </Section>
            )}

            {summary.guidance && (
              <Section title="Guidance">
                <p className="text-[11px]">{summary.guidance}</p>
              </Section>
            )}

            {summary.sources.length > 0 && (
              <Section title="Sources">
                <ul className="space-y-1 text-[10px]">
                  {summary.sources.map((s, i) => (
                    <li key={i}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline"
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  const toneClass = tone === "pos" ? "text-green" : tone === "neg" ? "text-red" : "";
  return (
    <div className="bg-panel-2 rounded border border-border p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`text-[13px] font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted mb-1">{title}</div>
      {children}
    </div>
  );
}
