"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { fmtNumber, fmtDate } from "@/lib/format";
import type { AlertType } from "@/lib/types";

interface Alert {
  id: string;
  ticker: string | null;
  alert_type: AlertType;
  threshold: number;
  notify_email: boolean;
  notify_inapp: boolean;
  active: boolean;
  created_at: string;
}

interface HistoryRow {
  id: string;
  alert_id: string;
  ticker: string | null;
  value: number | null;
  triggered_at: string;
  notified_email: boolean;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TYPE_LABELS: Record<AlertType, string> = {
  price_above: "Price ≥",
  price_below: "Price ≤",
  pnl_pct: "P&L %",
  pnl_abs: "P&L abs (IDR)",
};

export function AlertsManager() {
  const { data } = useSWR<{ alerts: Alert[]; history: HistoryRow[] }>("/api/alerts", fetcher, {
    refreshInterval: 60_000,
  });
  const [ticker, setTicker] = useState("");
  const [type, setType] = useState<AlertType>("price_above");
  const [threshold, setThreshold] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [creating, setCreating] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(threshold);
    if (!Number.isFinite(num)) return;
    if ((type === "price_above" || type === "price_below") && !ticker.trim()) return;
    setCreating(true);
    await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: ticker.trim() || null,
        alert_type: type,
        threshold: num,
        notify_email: notifyEmail,
        notify_inapp: true,
      }),
    });
    setCreating(false);
    setTicker("");
    setThreshold("");
    mutate("/api/alerts");
  }

  async function toggle(id: string, active: boolean) {
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    mutate("/api/alerts");
  }

  async function remove(id: string) {
    await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    mutate("/api/alerts");
  }

  const needsTicker = type === "price_above" || type === "price_below";

  return (
    <div>
      <form
        onSubmit={create}
        className="flex flex-wrap items-end gap-2 mb-4 p-3 bg-panel-2 rounded border border-border"
      >
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AlertType)}
            className="text-[12px]"
          >
            <option value="price_above">Price ≥</option>
            <option value="price_below">Price ≤</option>
            <option value="pnl_pct">Portfolio P&L %</option>
            <option value="pnl_abs">Portfolio P&L abs (IDR)</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
            Ticker {needsTicker ? "" : "(optional)"}
          </label>
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="BBRI / AAPL"
            disabled={!needsTicker}
            className="text-[12px] disabled:opacity-40"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
            Threshold
          </label>
          <input
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="3200"
            inputMode="decimal"
            className="text-[12px]"
          />
        </div>
        <label className="flex items-center gap-1 text-[11px] text-muted">
          <input
            type="checkbox"
            checked={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.checked)}
          />
          Email
        </label>
        <button
          type="submit"
          disabled={creating}
          className="bg-accent text-bg px-3 py-[6px] rounded text-[11px] font-semibold uppercase tracking-wider disabled:opacity-60"
        >
          {creating ? "…" : "Arm"}
        </button>
      </form>

      <div className="overflow-x-auto mb-6">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-muted text-[10px] uppercase tracking-wider border-b border-border">
              <th className="py-2 px-2 text-left font-normal">Status</th>
              <th className="py-2 px-2 text-left font-normal">Ticker</th>
              <th className="py-2 px-2 text-left font-normal">Trigger</th>
              <th className="py-2 px-2 text-right font-normal">Threshold</th>
              <th className="py-2 px-2 text-left font-normal">Notify</th>
              <th className="py-2 px-2 text-left font-normal">Created</th>
              <th className="py-2 px-2 text-right font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {(data?.alerts || []).map((a) => (
              <tr key={a.id} className="border-b border-border hover:bg-hover">
                <td className="py-[7px] px-2">
                  <button
                    onClick={() => toggle(a.id, !a.active)}
                    className={`px-2 py-[2px] rounded text-[10px] uppercase tracking-wider ${
                      a.active
                        ? "bg-green/20 text-green"
                        : "bg-muted/20 text-muted"
                    }`}
                  >
                    {a.active ? "Armed" : "Paused"}
                  </button>
                </td>
                <td className="py-[7px] px-2 font-medium">{a.ticker || "—"}</td>
                <td className="py-[7px] px-2">{TYPE_LABELS[a.alert_type]}</td>
                <td className="py-[7px] px-2 text-right tabular-nums">
                  {fmtNumber(a.threshold, a.alert_type === "pnl_pct" ? 2 : 0)}
                  {a.alert_type === "pnl_pct" ? "%" : ""}
                </td>
                <td className="py-[7px] px-2 text-[11px] text-muted">
                  {[a.notify_email && "email", a.notify_inapp && "in-app"]
                    .filter(Boolean)
                    .join(" · ")}
                </td>
                <td className="py-[7px] px-2 text-[11px] text-muted">
                  {fmtDate(a.created_at, { month: "short", day: "numeric" })}
                </td>
                <td className="py-[7px] px-2 text-right">
                  <button
                    onClick={() => remove(a.id)}
                    className="text-[11px] text-muted hover:text-red"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {!data?.alerts?.length && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-muted">
                  No alerts armed
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted mb-2">
          Recent fires · last 20
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-muted text-[10px] uppercase tracking-wider border-b border-border">
                <th className="py-2 px-2 text-left font-normal">When</th>
                <th className="py-2 px-2 text-left font-normal">Ticker</th>
                <th className="py-2 px-2 text-right font-normal">Value</th>
                <th className="py-2 px-2 text-left font-normal">Email</th>
              </tr>
            </thead>
            <tbody>
              {(data?.history || []).map((h) => (
                <tr key={h.id} className="border-b border-border">
                  <td className="py-[7px] px-2 text-[11px] text-muted">
                    {fmtDate(h.triggered_at, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-[7px] px-2">{h.ticker || "—"}</td>
                  <td className="py-[7px] px-2 text-right tabular-nums">
                    {h.value != null ? fmtNumber(h.value, 2) : "—"}
                  </td>
                  <td className="py-[7px] px-2 text-[11px]">
                    {h.notified_email ? (
                      <span className="text-green">sent</span>
                    ) : (
                      <span className="text-muted">skipped</span>
                    )}
                  </td>
                </tr>
              ))}
              {!data?.history?.length && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted">
                    No fires yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
