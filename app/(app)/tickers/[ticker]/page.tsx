import Link from "next/link";
import { notFound } from "next/navigation";
import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { BookBadge, AssetBadge } from "@/components/Badge";
import { DeltaNumber } from "@/components/shell/DeltaNumber";
import { supabaseServer } from "@/lib/supabase/server";
import { fmtDate, fmtCurrency, fmtPct, fmtNumber, signClass, clsx } from "@/lib/format";
import type { AssetClass, BookType } from "@/lib/types";

export const dynamic = "force-dynamic";

interface TradeRow {
  id: string;
  trade_date: string;
  direction: "LONG" | "SHORT";
  asset_class: AssetClass;
  book: BookType;
  entry_price: number | null;
  exit_price: number | null;
  position_size: number | null;
  net_pnl_native: number | null;
  pnl_currency: "IDR" | "USD" | null;
  pnl_pct: number | null;
  result: string | null;
  strategy: string | null;
  hold_time_hours: number | null;
}

interface MemoRow {
  id: string;
  decided_at: string;
  decision: string;
  why: string;
  linked_book: string | null;
  realized_outcome: string | null;
  realized_at: string | null;
}

interface CatalystRow {
  id: string;
  event_date: string;
  event_type: string;
  severity: "info" | "watch" | "breach";
  title: string;
  source_url: string | null;
  confirmed_at: string | null;
}

interface AlertRow {
  id: string;
  alert_type: string;
  threshold_value: number | null;
  active: boolean;
  notify_email: boolean;
  created_at: string;
}

interface WatchRow {
  id: string;
  asset_class: AssetClass;
  notes: string | null;
  added_at: string | null;
  conviction: string | null;
}

const EVENT_TYPE_LABEL: Record<string, string> = {
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

const SEVERITY_TONE: Record<
  CatalystRow["severity"],
  { bg: string; border: string; text: string; label: string }
> = {
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

/**
 * /tickers/[ticker] — single-symbol deep-dive page.
 *
 * Aggregates everything the cockpit knows about one symbol into one
 * server-rendered surface: trade history, decision memos, catalysts,
 * alerts, watchlist note.  This is the audit's G2 ask -- previously
 * there was no way to click a ticker and see the full picture in one
 * place.
 *
 * Live quote / day-change / market-value live on /positions and
 * /watchlist (they need client-side polling); this page is the
 * historical + forward-looking ledger.
 *
 * Not yet wired (G2 stretch, future commit):
 *   - Yahoo price chart embedded
 *   - ADV / liquidity ratio (averageDailyVolume10Day)
 *   - Position size vs target weight from books/meta
 *   - News feed inlined (currently just a /news?ticker= link)
 */
export default async function TickerDeepDivePage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: tickerRaw } = await params;
  const ticker = decodeURIComponent(tickerRaw).toUpperCase();
  if (!ticker) notFound();

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  // Five parallel queries -- Supabase batches them so the round-trip
  // stays roughly 1x DB latency rather than 5x.  RLS owner-only on
  // every table so the explicit user_id filters are belt-and-braces.
  const [tradesRes, memosRes, catalystsRes, alertsRes, watchRes] = await Promise.all([
    supabase
      .from("trades")
      .select(
        "id, trade_date, direction, asset_class, book, entry_price, exit_price, position_size, net_pnl_native, pnl_currency, pnl_pct, result, strategy, hold_time_hours",
      )
      .eq("user_id", user.id)
      .eq("ticker", ticker)
      .order("trade_date", { ascending: false }),
    supabase
      .from("decision_memos")
      .select("id, decided_at, decision, why, linked_book, realized_outcome, realized_at")
      .eq("user_id", user.id)
      .eq("linked_ticker", ticker)
      .order("decided_at", { ascending: false }),
    supabase
      .from("catalysts")
      .select("id, event_date, event_type, severity, title, source_url, confirmed_at")
      .eq("user_id", user.id)
      .eq("ticker", ticker)
      .order("event_date", { ascending: false }),
    supabase
      .from("alerts")
      .select("id, alert_type, threshold_value, active, notify_email, created_at")
      .eq("user_id", user.id)
      .eq("ticker", ticker)
      .order("created_at", { ascending: false }),
    supabase
      .from("watchlist")
      .select("id, asset_class, notes, added_at, conviction")
      .eq("user_id", user.id)
      .eq("ticker", ticker)
      .maybeSingle(),
  ]);

  const trades = (tradesRes.data || []) as TradeRow[];
  const memos = (memosRes.data || []) as MemoRow[];
  const catalysts = (catalystsRes.data || []) as CatalystRow[];
  const alerts = (alertsRes.data || []) as AlertRow[];
  const watch = (watchRes.data || null) as WatchRow | null;

  // Derive a quick stats card from trades: realized P&L total in IDR
  // (collapsing currencies via fx_rate_to_idr would be more correct but
  // the field is on the row already), win-rate, last trade date, total
  // trade count.  Keeps the header useful even before live-quote wires.
  const closedTrades = trades.filter((t) => t.exit_price != null);
  const realizedPnlNative = closedTrades.reduce(
    (s, t) => s + (t.net_pnl_native ?? 0),
    0,
  );
  const wins = closedTrades.filter((t) => (t.net_pnl_native ?? 0) > 0).length;
  const winPct = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : null;
  const realizedCurrency: "IDR" | "USD" =
    closedTrades[0]?.pnl_currency ?? (trades[0]?.pnl_currency ?? "IDR");
  const lastTradeDate = trades[0]?.trade_date ?? null;
  const upcomingCatalysts = catalysts.filter(
    (c) => c.event_date >= new Date().toISOString().slice(0, 10),
  );

  const assetClass = watch?.asset_class ?? trades[0]?.asset_class ?? null;
  const book = trades[0]?.book ?? null;

  return (
    <>
      <TopHeader
        stepLabel="Firm · Ticker"
        title={ticker}
        subtitle={
          assetClass
            ? `${assetClass.replace("_", " ")}${book ? ` · ${book.replace("_", " ")}` : ""}`
            : "No history on file yet"
        }
      >
        <Link
          href={`/memos?ticker=${encodeURIComponent(ticker)}`}
          className="border border-border text-muted hover:text-fg px-3 py-[6px] rounded text-[10.5px] uppercase tracking-[0.12em]"
        >
          Memos →
        </Link>
        <Link
          href={`/news?ticker=${encodeURIComponent(ticker)}`}
          className="border border-border text-muted hover:text-fg px-3 py-[6px] rounded text-[10.5px] uppercase tracking-[0.12em]"
        >
          News →
        </Link>
      </TopHeader>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatTile
          label="Trades"
          value={
            <span className="mono text-fg">{trades.length}</span>
          }
          hint={
            closedTrades.length > 0
              ? `${closedTrades.length} closed · ${trades.length - closedTrades.length} open`
              : trades.length > 0
                ? "all open"
                : "none on file"
          }
        />
        <StatTile
          label="Win rate"
          value={
            winPct != null ? (
              <span className={clsx("mono", winPct >= 50 ? "text-up" : "text-down")}>
                {fmtPct(winPct, 0)}
              </span>
            ) : (
              <span className="mono text-muted-2">—</span>
            )
          }
          hint={closedTrades.length > 0 ? `${wins}/${closedTrades.length} W` : "—"}
        />
        <StatTile
          label="Realized P&L"
          value={
            closedTrades.length > 0 ? (
              <DeltaNumber
                value={realizedPnlNative}
                text={fmtCurrency(realizedPnlNative, realizedCurrency)}
              />
            ) : (
              <span className="mono text-muted-2">—</span>
            )
          }
          hint={`net · ${realizedCurrency}`}
        />
        <StatTile
          label="Catalysts"
          value={<span className="mono text-fg">{catalysts.length}</span>}
          hint={
            upcomingCatalysts.length > 0
              ? `${upcomingCatalysts.length} upcoming`
              : catalysts.length > 0
                ? "all past"
                : "none on file"
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
        <div className="space-y-4">
          <Panel
            title={`Trades (${trades.length})`}
            subtitle="Most recent first · linked to /journal for full context"
            actions={
              <Link
                href={`/journal?ticker=${encodeURIComponent(ticker)}`}
                className="text-muted-2 hover:text-fg text-[10px] uppercase tracking-[0.12em]"
              >
                Journal →
              </Link>
            }
          >
            {trades.length === 0 ? (
              <EmptyHint text="No trades on this ticker yet." />
            ) : (
              <div className="overflow-x-auto">
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
                      <th className="py-1.5 px-2 text-left font-medium">Dir</th>
                      <th className="py-1.5 px-2 text-left font-medium">Strategy</th>
                      <th className="py-1.5 px-2 text-right font-medium">Entry</th>
                      <th className="py-1.5 px-2 text-right font-medium">Exit</th>
                      <th className="py-1.5 px-2 text-right font-medium">Size</th>
                      <th className="py-1.5 px-2 text-right font-medium">Net P&amp;L</th>
                      <th className="py-1.5 px-2 text-right font-medium">%</th>
                      <th className="py-1.5 px-2 text-left font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b transition-colors hover:bg-elevated/50"
                        style={{ borderColor: "var(--color-border)" }}
                      >
                        <td className="py-[6px] px-2 mono text-fg">
                          {fmtDate(t.trade_date, {
                            day: "numeric",
                            month: "short",
                            year: "2-digit",
                          })}
                        </td>
                        <td className="py-[6px] px-2 mono text-muted">{t.direction}</td>
                        <td className="py-[6px] px-2 mono text-muted truncate max-w-[140px]">
                          {t.strategy || "—"}
                        </td>
                        <td className="py-[6px] px-2 mono text-right">
                          {t.entry_price != null
                            ? fmtNumber(t.entry_price, t.pnl_currency === "USD" ? 2 : 0)
                            : "—"}
                        </td>
                        <td className="py-[6px] px-2 mono text-right">
                          {t.exit_price != null
                            ? fmtNumber(t.exit_price, t.pnl_currency === "USD" ? 2 : 0)
                            : "—"}
                        </td>
                        <td className="py-[6px] px-2 mono text-right">
                          {t.position_size != null && t.position_size > 0
                            ? fmtNumber(t.position_size, 0)
                            : "—"}
                        </td>
                        <td className="py-[6px] px-2 text-right">
                          {t.net_pnl_native != null ? (
                            <DeltaNumber
                              value={t.net_pnl_native}
                              text={fmtCurrency(t.net_pnl_native, t.pnl_currency ?? "IDR")}
                              className="justify-end"
                            />
                          ) : (
                            <span className="mono text-muted-2">—</span>
                          )}
                        </td>
                        <td
                          className={`py-[6px] px-2 text-right mono ${signClass(t.pnl_pct)}`}
                        >
                          {t.pnl_pct != null ? fmtPct(t.pnl_pct, 2, true) : "—"}
                        </td>
                        <td className="py-[6px] px-2 text-[10px] uppercase tracking-[0.10em] text-muted-2">
                          {t.result || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title={`Decision memos (${memos.length})`}
            subtitle="Pre-trade thesis · expected outcome · invalidation"
            actions={
              <Link
                href={`/memos?ticker=${encodeURIComponent(ticker)}`}
                className="text-muted-2 hover:text-fg text-[10px] uppercase tracking-[0.12em]"
              >
                + new memo →
              </Link>
            }
          >
            {memos.length === 0 ? (
              <EmptyHint
                text={
                  <>
                    No memos linked to {ticker} yet.{" "}
                    <Link
                      href="/memos"
                      className="text-amber hover:underline"
                    >
                      Record one
                    </Link>{" "}
                    so post-mortems have ground truth.
                  </>
                }
              />
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                {memos.map((m) => (
                  <li key={m.id} className="py-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/memos/${m.id}`}
                        className="text-[12.5px] font-medium text-fg hover:text-amber"
                      >
                        {m.decision}
                      </Link>
                      {m.linked_book && (
                        <BookBadge book={m.linked_book as BookType} />
                      )}
                      <span
                        className="ml-auto mono text-[10px] uppercase tracking-[0.10em]"
                        style={{
                          color: m.realized_outcome
                            ? "var(--color-up)"
                            : "var(--color-muted-2)",
                        }}
                      >
                        {m.realized_outcome ? "outcome recorded" : "open"}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted line-clamp-2">{m.why}</div>
                    <div className="mt-1 text-[10px] mono text-muted-2 uppercase tracking-[0.10em]">
                      decided{" "}
                      {fmtDate(m.decided_at, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel
            title={`Catalysts (${catalysts.length})`}
            subtitle="Structural events · drives 7-day pre-alerts"
            actions={
              <Link
                href={`/catalysts`}
                className="text-muted-2 hover:text-fg text-[10px] uppercase tracking-[0.12em]"
              >
                Calendar →
              </Link>
            }
          >
            {catalysts.length === 0 ? (
              <EmptyHint
                text={
                  <>
                    No catalysts on file. Record KBMI / rights / RUPS / dividend
                    ex on{" "}
                    <Link href="/catalysts" className="text-amber hover:underline">
                      /catalysts
                    </Link>
                    .
                  </>
                }
              />
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                {catalysts.map((c) => {
                  const tone = SEVERITY_TONE[c.severity];
                  return (
                    <li key={c.id} className="py-2 flex items-start gap-2.5">
                      <div className="text-[10px] mono text-muted-2 uppercase tracking-[0.08em] pt-[2px] w-[60px] shrink-0">
                        {fmtDate(c.event_date, {
                          day: "numeric",
                          month: "short",
                          year: "2-digit",
                        })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11.5px] text-fg leading-snug">
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
                        </div>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <span
                            className="inline-flex items-center px-[6px] py-[1px] rounded-[3px] mono uppercase border"
                            style={{
                              fontSize: 9,
                              letterSpacing: "0.10em",
                              background: tone.bg,
                              borderColor: tone.border,
                              color: tone.text,
                            }}
                          >
                            {tone.label}
                          </span>
                          <span className="mono text-[9.5px] uppercase tracking-[0.10em] text-muted-2">
                            {EVENT_TYPE_LABEL[c.event_type] ?? c.event_type}
                          </span>
                          {c.confirmed_at && (
                            <span className="text-[9.5px] mono text-up uppercase tracking-[0.10em]">
                              recorded
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel
            title={`Alerts (${alerts.length})`}
            subtitle="Price / P&L thresholds"
            actions={
              <Link
                href="/alerts"
                className="text-muted-2 hover:text-fg text-[10px] uppercase tracking-[0.12em]"
              >
                Manage →
              </Link>
            }
          >
            {alerts.length === 0 ? (
              <EmptyHint
                text={
                  <>
                    No alerts.{" "}
                    <Link href="/alerts" className="text-amber hover:underline">
                      Set one
                    </Link>{" "}
                    to fire on price / P&L threshold breach.
                  </>
                }
              />
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                {alerts.map((a) => (
                  <li key={a.id} className="py-2 flex items-center justify-between gap-2">
                    <span className="mono text-[11px] uppercase text-muted">
                      {a.alert_type}
                    </span>
                    <span className="mono text-[11px] text-fg">
                      {a.threshold_value != null ? fmtNumber(a.threshold_value, 2) : "—"}
                    </span>
                    <span
                      className="text-[9.5px] mono uppercase tracking-[0.10em]"
                      style={{
                        color: a.active ? "var(--color-up)" : "var(--color-muted-2)",
                      }}
                    >
                      {a.active ? "active" : "inactive"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Watchlist" subtitle="Conviction · note · tags">
            {!watch ? (
              <EmptyHint
                text={
                  <>
                    {ticker} is not on your watchlist.{" "}
                    <Link href="/watchlist" className="text-amber hover:underline">
                      Add it
                    </Link>
                    .
                  </>
                }
              />
            ) : (
              <div className="space-y-2 text-[11.5px]">
                <div className="flex items-center gap-2 flex-wrap">
                  {watch.asset_class && <AssetBadge cls={watch.asset_class} />}
                  {watch.conviction && (
                    <span className="mono uppercase text-[9.5px] tracking-[0.10em] text-amber">
                      conviction · {watch.conviction}
                    </span>
                  )}
                  {watch.added_at && (
                    <span className="mono text-[9.5px] uppercase tracking-[0.10em] text-muted-2 ml-auto">
                      added{" "}
                      {fmtDate(watch.added_at, {
                        day: "numeric",
                        month: "short",
                        year: "2-digit",
                      })}
                    </span>
                  )}
                </div>
                {watch.notes && (
                  <p className="text-fg leading-relaxed whitespace-pre-wrap">{watch.notes}</p>
                )}
              </div>
            )}
          </Panel>

          <Panel title="Last refreshed" padding>
            <div className="text-[10.5px] text-muted-2 leading-relaxed">
              Server-rendered at request time. For live quote / day-change /
              market-value see <Link href={`/positions`} className="text-amber hover:underline">/positions</Link>{" "}
              or <Link href={`/watchlist`} className="text-amber hover:underline">/watchlist</Link>.
              Last trade on file: <span className="mono text-fg">
              {lastTradeDate
                ? fmtDate(lastTradeDate, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
              </span>.
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="bg-panel border border-border rounded-[10px] px-4 py-3">
      <div className="label text-muted-2">{label}</div>
      <div className="mt-[4px] text-[20px] font-medium leading-tight tracking-[-0.01em]">
        {value}
      </div>
      <div className="mt-[3px] text-[11px] mono text-muted-2">{hint}</div>
    </div>
  );
}

function EmptyHint({ text }: { text: React.ReactNode }) {
  return (
    <div
      className="py-3 text-center text-[11px] leading-relaxed"
      style={{ color: "var(--color-muted-2)" }}
    >
      {text}
    </div>
  );
}
