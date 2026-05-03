"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { fmtCurrency, fmtDate, clsx } from "@/lib/format";

type Book = "investing" | "idx_trading" | "crypto_trading" | "firm";
type FlowType =
  | "contribution"
  | "withdrawal"
  | "dividend"
  | "fee"
  | "tax"
  | "transfer";

interface CashFlow {
  id: string;
  user_id: string;
  book: Book;
  flow_date: string;
  flow_type: FlowType;
  amount_idr: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface FlowsResp {
  flows: CashFlow[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const BOOKS: { value: Book; label: string }[] = [
  { value: "firm", label: "Firm (capital allocation)" },
  { value: "investing", label: "Investing" },
  { value: "idx_trading", label: "IDX Trading" },
  { value: "crypto_trading", label: "Crypto Trading" },
];

const TYPES: { value: FlowType; label: string; sign: "+" | "-" | "?" }[] = [
  { value: "contribution", label: "Contribution", sign: "+" },
  { value: "dividend", label: "Dividend in", sign: "+" },
  { value: "transfer", label: "Transfer (signed)", sign: "?" },
  { value: "withdrawal", label: "Withdrawal", sign: "-" },
  { value: "fee", label: "Fee / brokerage", sign: "-" },
  { value: "tax", label: "Tax outflow", sign: "-" },
];

function todayWIB(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const BOOK_LABEL: Record<Book, string> = {
  firm: "Firm",
  investing: "Inv",
  idx_trading: "IDX",
  crypto_trading: "Crypto",
};

const TYPE_LABEL: Record<FlowType, string> = {
  contribution: "Contribution",
  withdrawal: "Withdrawal",
  dividend: "Dividend",
  fee: "Fee",
  tax: "Tax",
  transfer: "Transfer",
};

/**
 * CashFlowsLedger — inline form to record contributions / withdrawals /
 * dividends / fees / taxes plus a recent-flows list with delete.
 *
 * Sign convention surfaced explicitly in the type label (Withdrawal
 * implies negative, Contribution implies positive) and the form auto-
 * applies the sign on submit so Jenson types magnitudes only.
 *
 * Posting a flow mutates /api/portfolio/metrics so YTD / vol / sharpe
 * recompute the next time KpiRow / RiskSnapshot refresh -- the audit's
 * "YTD = -30% with all-winning trades" symptom traces back to flows
 * the dashboard didn't know about.  This is the UI side of the B3 fix.
 */
export function CashFlowsLedger() {
  const { mutate } = useSWRConfig();
  const { data, isLoading } = useSWR<FlowsResp>(
    "/api/capital/cash-flows",
    fetcher,
    { refreshInterval: 60_000 },
  );
  const flows = data?.flows ?? [];

  const [book, setBook] = useState<Book>("firm");
  const [flowDate, setFlowDate] = useState<string>(() => todayWIB());
  const [flowType, setFlowType] = useState<FlowType>("contribution");
  const [amountInput, setAmountInput] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const typeMeta = TYPES.find((t) => t.value === flowType);
  const expectedSign = typeMeta?.sign ?? "?";

  // For contribution / dividend, magnitude is positive.  For withdrawal /
  // fee / tax, we sign-flip the magnitude on submit.  Transfer keeps the
  // user's explicit sign so they can do inter-book moves.
  function buildAmount(): number | null {
    const raw = amountInput.replace(/,/g, "").trim();
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n === 0) return null;
    if (expectedSign === "+") return Math.abs(n);
    if (expectedSign === "-") return -Math.abs(n);
    return n;
  }

  async function submit() {
    const amount_idr = buildAmount();
    if (amount_idr == null) {
      setErr("Amount must be a non-zero number.");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/capital/cash-flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        book,
        flow_date: flowDate,
        flow_type: flowType,
        amount_idr,
        notes: notes.trim() || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setErr(j?.error || "Failed to record flow.");
      return;
    }
    setAmountInput("");
    setNotes("");
    // Refresh the list AND every metric endpoint that consumes flows.
    mutate("/api/capital/cash-flows");
    mutate(
      (key) => typeof key === "string" && key.startsWith("/api/portfolio/metrics"),
    );
  }

  async function remove(id: string) {
    if (!confirm("Delete this cash flow?")) return;
    const res = await fetch(`/api/capital/cash-flows?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    mutate("/api/capital/cash-flows");
    mutate(
      (key) => typeof key === "string" && key.startsWith("/api/portfolio/metrics"),
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-[10.5px] text-muted-2 leading-relaxed">
        Record every contribution / withdrawal / dividend / fee / tax so YTD,
        vol, and Sharpe reflect investment performance instead of capital
        movements. Backfilling known flows is the single highest-impact
        data-trust action on the dashboard.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[140px_140px_180px_1fr_auto] gap-2">
        <div>
          <div className="label mb-[3px]">Date</div>
          <input
            type="date"
            value={flowDate}
            onChange={(e) => setFlowDate(e.target.value)}
            className="w-full text-[12px]"
          />
        </div>
        <div>
          <div className="label mb-[3px]">Book</div>
          <select
            value={book}
            onChange={(e) => setBook(e.target.value as Book)}
            className="w-full text-[12px]"
          >
            {BOOKS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="label mb-[3px]">Type</div>
          <select
            value={flowType}
            onChange={(e) => setFlowType(e.target.value as FlowType)}
            className="w-full text-[12px]"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.sign === "+" ? "+ " : t.sign === "-" ? "− " : "± "}
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="label mb-[3px]">
            Amount IDR{" "}
            <span className="text-muted-2 normal-case tracking-normal">
              (
              {expectedSign === "+"
                ? "magnitude, signed +"
                : expectedSign === "-"
                  ? "magnitude, signed −"
                  : "explicit sign required"}
              )
            </span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            placeholder="e.g. 5000000  or  -5000000"
            className="w-full text-[12px] mono"
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={submit}
            disabled={busy || !amountInput.trim()}
            className="btn-pill btn-pill-primary !py-[8px] !px-[20px] !text-[10.5px]"
          >
            {busy ? "Saving…" : "Record"}
          </button>
        </div>
      </div>

      <div>
        <div className="label mb-[3px]">Note (optional)</div>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Why? counterparty, reference, anything that'll matter at audit time"
          className="w-full text-[12px]"
        />
      </div>

      {err && (
        <div className="text-[11.5px] text-loss border border-loss/40 bg-loss/10 rounded px-3 py-2">
          {err}
        </div>
      )}

      <div className="overflow-x-auto pt-2 border-t border-border">
        <table className="w-full text-[11.5px] tabular-nums">
          <thead>
            <tr
              className="text-muted-2 text-[9.5px] uppercase border-b"
              style={{
                letterSpacing: "0.14em",
                borderColor: "var(--color-border-strong)",
              }}
            >
              <th className="py-1.5 px-2 text-left font-medium">Date</th>
              <th className="py-1.5 px-2 text-left font-medium">Book</th>
              <th className="py-1.5 px-2 text-left font-medium">Type</th>
              <th className="py-1.5 px-2 text-right font-medium">Amount IDR</th>
              <th className="py-1.5 px-2 text-left font-medium">Note</th>
              <th className="py-1.5 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && !data && (
              <tr>
                <td
                  colSpan={6}
                  className="py-3 text-center text-muted-2 text-[10.5px] uppercase"
                  style={{ letterSpacing: "0.12em" }}
                >
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && flows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-3 text-center text-muted-2 text-[10.5px] uppercase"
                  style={{ letterSpacing: "0.12em" }}
                >
                  No flows recorded yet
                </td>
              </tr>
            )}
            {flows.map((f) => (
              <tr
                key={f.id}
                className="border-b transition-colors hover:bg-elevated/50"
                style={{ borderColor: "var(--color-border)" }}
              >
                <td className="py-[6px] px-2 mono text-fg">
                  {fmtDate(f.flow_date, {
                    day: "numeric",
                    month: "short",
                    year: "2-digit",
                    timeZone: "Asia/Jakarta",
                  })}
                </td>
                <td className="py-[6px] px-2 mono text-muted">{BOOK_LABEL[f.book]}</td>
                <td className="py-[6px] px-2 mono text-muted">{TYPE_LABEL[f.flow_type]}</td>
                <td
                  className={clsx(
                    "py-[6px] px-2 text-right mono",
                    f.amount_idr > 0 ? "pos" : f.amount_idr < 0 ? "neg" : "",
                  )}
                >
                  {f.amount_idr >= 0 ? "+" : ""}
                  {fmtCurrency(f.amount_idr, "IDR")}
                </td>
                <td className="py-[6px] px-2 text-muted-2 truncate max-w-[260px]">
                  {f.notes || "—"}
                </td>
                <td className="py-[6px] px-2 text-right">
                  <button
                    type="button"
                    onClick={() => remove(f.id)}
                    className="text-muted-2 hover:text-loss text-[10px] uppercase tracking-[0.10em]"
                    title="Delete this flow"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
