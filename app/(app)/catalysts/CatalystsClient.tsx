"use client";

import { useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { fmtDate, clsx } from "@/lib/format";
import { CatalystForm } from "./CatalystForm";

export type CatalystEventType =
  | "kbmi_change"
  | "rights_issue"
  | "backdoor_listing"
  | "compliance"
  | "rups"
  | "dividend_ex"
  | "earnings"
  | "regulatory"
  | "macro"
  | "other";

export type CatalystSeverity = "info" | "watch" | "breach";

export interface Catalyst {
  id: string;
  user_id: string;
  ticker: string | null;
  event_type: CatalystEventType;
  event_date: string;
  severity: CatalystSeverity;
  title: string;
  notes: string | null;
  source_url: string | null;
  linked_book: string | null;
  alert_sent_at: string | null;
  confirmed_at: string | null;
  outcome_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CatalystsResp {
  catalysts: Catalyst[];
}

const fetcher = (u: string) => fetch(u).then((r) => r.json());

const EVENT_TYPE_LABEL: Record<CatalystEventType, string> = {
  kbmi_change: "KBMI",
  rights_issue: "Rights",
  backdoor_listing: "Backdoor",
  compliance: "Compliance",
  rups: "RUPS",
  dividend_ex: "Div ex",
  earnings: "Earnings",
  regulatory: "Reg",
  macro: "Macro",
  other: "Other",
};

const SEVERITY_TONE: Record<CatalystSeverity, { bg: string; border: string; text: string; label: string }> = {
  info: {
    bg: "color-mix(in srgb, var(--color-cyan) 10%, transparent)",
    border: "color-mix(in srgb, var(--color-cyan) 30%, transparent)",
    text: "var(--color-cyan)",
    label: "signal",
  },
  watch: {
    bg: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
    border: "color-mix(in srgb, var(--color-accent) 30%, transparent)",
    text: "var(--color-accent)",
    label: "watch",
  },
  breach: {
    bg: "color-mix(in srgb, var(--color-down) 10%, transparent)",
    border: "color-mix(in srgb, var(--color-down) 30%, transparent)",
    text: "var(--color-down)",
    label: "breach",
  },
};

type Filter = "all" | "upcoming" | "past";

function daysFromToday(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function CatalystsClient() {
  const { mutate } = useSWRConfig();
  const { data, isLoading } = useSWR<CatalystsResp>(
    "/api/catalysts",
    fetcher,
    { refreshInterval: 120_000 },
  );
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const list = data?.catalysts ?? [];
    if (filter === "all") return list;
    const today = new Date().toISOString().slice(0, 10);
    if (filter === "upcoming") return list.filter((c) => c.event_date >= today);
    return list.filter((c) => c.event_date < today).reverse(); // most recent past first
  }, [data, filter]);

  const all = data?.catalysts ?? [];

  async function remove(id: string) {
    if (!confirm("Delete this catalyst?")) return;
    const res = await fetch(`/api/catalysts?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    mutate("/api/catalysts");
  }

  const upcomingCount = all.filter(
    (c) => c.event_date >= new Date().toISOString().slice(0, 10),
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em]">
          {(["upcoming", "past", "all"] as Filter[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={clsx(
                "px-2.5 h-[26px] rounded-[4px] mono transition-colors",
                filter === k
                  ? "bg-elevated text-fg"
                  : "text-muted-2 hover:text-fg",
              )}
            >
              {k}
              {k === "upcoming" && upcomingCount > 0 && (
                <span className="ml-1 text-amber">· {upcomingCount}</span>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="btn-pill btn-pill-primary !py-[8px] !px-[20px] !text-[10.5px]"
        >
          + Record catalyst
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px] tabular-nums">
          <thead>
            <tr
              className="text-muted-2 text-[9.5px] uppercase border-b"
              style={{
                letterSpacing: "0.14em",
                borderColor: "var(--color-border-strong)",
              }}
            >
              <th className="py-1.5 px-2 text-left font-medium">Date</th>
              <th className="py-1.5 px-2 text-left font-medium">Days</th>
              <th className="py-1.5 px-2 text-left font-medium">Ticker</th>
              <th className="py-1.5 px-2 text-left font-medium">Type</th>
              <th className="py-1.5 px-2 text-left font-medium">Title</th>
              <th className="py-1.5 px-2 text-left font-medium">Sev</th>
              <th className="py-1.5 px-2 text-left font-medium">Status</th>
              <th className="py-1.5 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && !data && (
              <tr>
                <td
                  colSpan={8}
                  className="py-3 text-center text-muted-2 text-[10.5px] uppercase"
                  style={{ letterSpacing: "0.12em" }}
                >
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="py-6 text-center text-muted-2 text-[11px] leading-relaxed"
                >
                  {filter === "upcoming"
                    ? "No upcoming catalysts. Record KBMI tier moves, rights issues, RUPS, dividend ex-dates as you spot them."
                    : filter === "past"
                      ? "No past catalysts on file."
                      : "No catalysts yet."}
                </td>
              </tr>
            )}
            {filtered.map((c) => {
              const days = daysFromToday(c.event_date);
              const tone = SEVERITY_TONE[c.severity];
              const t7 =
                c.alert_sent_at == null && days <= 7 && days >= 0;
              return (
                <tr
                  key={c.id}
                  className="border-b transition-colors hover:bg-elevated/50"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <td className="py-[6px] px-2 mono text-fg">
                    {fmtDate(c.event_date, {
                      day: "numeric",
                      month: "short",
                      year: "2-digit",
                      timeZone: "Asia/Jakarta",
                    })}
                  </td>
                  <td
                    className={clsx(
                      "py-[6px] px-2 mono text-[11px]",
                      days < 0
                        ? "text-muted-2"
                        : days <= 7
                          ? "text-amber"
                          : "text-muted",
                    )}
                  >
                    {days === 0 ? "today" : days > 0 ? `T-${days}` : `${days}d`}
                  </td>
                  <td className="py-[6px] px-2 mono text-fg">
                    {c.ticker ?? <span className="text-muted-2">—</span>}
                  </td>
                  <td className="py-[6px] px-2 mono uppercase text-muted text-[10px] tracking-[0.10em]">
                    {EVENT_TYPE_LABEL[c.event_type]}
                  </td>
                  <td className="py-[6px] px-2 text-fg">
                    {c.source_url ? (
                      <a
                        href={c.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {c.title}
                      </a>
                    ) : (
                      c.title
                    )}
                  </td>
                  <td className="py-[6px] px-2">
                    <span
                      className="inline-flex items-center px-[6px] py-[1px] rounded-[3px] mono uppercase border"
                      style={{
                        fontSize: 9.5,
                        letterSpacing: "0.10em",
                        background: tone.bg,
                        borderColor: tone.border,
                        color: tone.text,
                      }}
                    >
                      {tone.label}
                    </span>
                  </td>
                  <td className="py-[6px] px-2 text-[10.5px]">
                    {c.confirmed_at ? (
                      <span className="text-up mono">recorded</span>
                    ) : t7 ? (
                      <span className="text-amber mono">T-7 alert pending</span>
                    ) : days < 0 ? (
                      <span className="text-muted-2 mono">past · no outcome</span>
                    ) : (
                      <span className="text-muted-2 mono">scheduled</span>
                    )}
                  </td>
                  <td className="py-[6px] px-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="text-muted-2 hover:text-loss text-[10px] uppercase tracking-[0.10em]"
                      title="Delete catalyst"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-muted-2 leading-relaxed pt-1 border-t border-border">
        T-7 alerts: scheduled to fire from the existing alerts cron (
        <code className="mono">/api/cron/check-alerts</code>) on a follow-up
        wire. Recording an outcome (confirmed_at + outcome_notes) is the
        catalyst-side equivalent of the memo realized-outcome flow — pair it
        with a Decision Memo so the post-mortem is grounded.
      </div>

      {dialogOpen && (
        <CatalystForm
          onClose={() => setDialogOpen(false)}
          onSuccess={() => {
            setDialogOpen(false);
            mutate("/api/catalysts");
          }}
        />
      )}
    </div>
  );
}
