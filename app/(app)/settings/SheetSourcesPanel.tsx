"use client";

import { useState, useTransition } from "react";
import { saveSheetSources, triggerSheetsPull } from "./sheet-sources-actions";

interface Props {
  initialTradingUrl: string;
  initialHoldingsUrl: string;
  lastSyncAt: string | null;
}

/**
 * New sheets-pull UI.  The previous Apps Script push model is gone — we just
 * poll the two CSV-export URLs every 10 min via pg_cron.  All the user has to
 * do here is paste the two URLs and keep the sheets link-shareable.
 *
 * URL format accepted:
 *   - /edit?gid=...   (we rewrite → /export?format=csv&gid=...)
 *   - /export?format=csv&gid=...   (used as-is)
 *   - published /pub?output=csv    (used as-is)
 */
export function SheetSourcesPanel({ initialTradingUrl, initialHoldingsUrl, lastSyncAt }: Props) {
  const [trading, setTrading] = useState(initialTradingUrl);
  const [holdings, setHoldings] = useState(initialHoldingsUrl);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [syncMsg, setSyncMsg] = useState<string>("");
  const [, startTransition] = useTransition();

  async function handleSave() {
    setSaveState("saving");
    const fd = new FormData();
    fd.append("trading_url", normalizeUrl(trading));
    fd.append("holdings_url", normalizeUrl(holdings));
    const res = await saveSheetSources(fd);
    setSaveState(res.ok ? "saved" : "error");
    setTimeout(() => setSaveState("idle"), 2500);
  }

  async function handleSyncNow() {
    setSyncState("syncing");
    setSyncMsg("");
    try {
      const res = await triggerSheetsPull();
      if (!res.ok) {
        setSyncState("error");
        setSyncMsg(res.error || "sync failed");
      } else {
        setSyncState("done");
        setSyncMsg(
          `synced ${res.holdings_synced ?? 0} holdings + ${res.trading_synced ?? 0} trading`,
        );
        // ask SWR to re-fetch positions right away
        startTransition(() => {
          // no-op marker for future router.refresh() if needed
        });
      }
      setTimeout(() => setSyncState("idle"), 4000);
    } catch (e) {
      setSyncState("error");
      setSyncMsg(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-[11.5px] text-muted leading-relaxed">
        Paste the shareable Google Sheets URL for each book. Aeternum pulls CSV exports every
        10 min via Supabase cron — no Apps Script, no webhooks.{" "}
        <span className="text-fg/80">Make sure each sheet is set to &quot;Anyone with the link can view&quot;.</span>
      </div>

      <label className="block">
        <div className="text-[11px] text-muted-2 uppercase tracking-[0.08em] mb-1">
          Trading book (IDX trades)
        </div>
        <input
          type="url"
          value={trading}
          onChange={(e) => setTrading(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..."
          className="w-full bg-panel-2 border border-border rounded px-3 py-2 text-[12px] font-mono focus:outline-none focus:border-accent/60"
        />
      </label>

      <label className="block">
        <div className="text-[11px] text-muted-2 uppercase tracking-[0.08em] mb-1">
          Holdings book (long-term positions)
        </div>
        <input
          type="url"
          value={holdings}
          onChange={(e) => setHoldings(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..."
          className="w-full bg-panel-2 border border-border rounded px-3 py-2 text-[12px] font-mono focus:outline-none focus:border-accent/60"
        />
      </label>

      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="text-[11px] text-muted">
          {lastSyncAt ? (
            <>Last sync: <span className="text-fg">{new Date(lastSyncAt).toLocaleString()}</span></>
          ) : (
            <>Never synced</>
          )}
        </div>
        <div className="flex items-center gap-2">
          {syncMsg && (
            <span
              className={`text-[11px] ${
                syncState === "error" ? "text-red-400" : "text-green-400"
              }`}
            >
              {syncMsg}
            </span>
          )}
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={syncState === "syncing"}
            className="bg-panel-2 border border-border hover:border-accent/60 text-fg px-3 py-[6px] rounded text-[11px] font-medium disabled:opacity-50"
          >
            {syncState === "syncing" ? "Syncing…" : "Sync now"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveState === "saving"}
            className="bg-accent text-bg px-3 py-[6px] rounded text-[11px] font-semibold tracking-wider uppercase disabled:opacity-60"
          >
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      <details className="text-[11px] text-muted pt-2">
        <summary className="cursor-pointer hover:text-fg">What shape does the parser expect?</summary>
        <div className="mt-2 space-y-2 pl-3 border-l border-border">
          <div>
            <strong className="text-fg">Trading:</strong> columns{" "}
            <code className="text-accent/80">DATE, SECTOR, TICKER, STRATEGY, ENTRY PRICE, EXIT PRICE, LEVERAGE, LOTS, STOP LOSS, TAKE PROFIT, Rp P&amp;L, % P&amp;L, R:R RATIO, RESULT, HOLD TIME, COMMISSION, NET P&amp;L, CUM P&amp;L, MOOD, CONFIDENCE, CONVICTION, MISTAKES, NOTES</code>. Dates are M/D/YYYY. 1 lot = 100 shares.
          </div>
          <div>
            <strong className="text-fg">Holdings:</strong> columns{" "}
            <code className="text-accent/80">PURCHASE DATE, SECTOR, TICKER, THESIS, ENTRY PRICE, LOTS, COST BASIS (Rp), STOP LOSS, TARGET PRICE, CURRENT PRICE, …</code>. Dates are DD/MM/YYYY. A row must have <strong>either LOTS or COST BASIS</strong> filled for it to sync.
          </div>
        </div>
      </details>
    </div>
  );
}

// Accept an /edit URL and rewrite it to /export?format=csv.  Leave /export and
// /pub URLs alone.  This is defensive — users will paste whatever's in their
// browser bar.
function normalizeUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return "";
  if (url.includes("/export?format=csv") || url.includes("/pub?output=csv")) return url;
  const m = url.match(/^(https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+)\/edit(?:.*?gid=(\d+))?/);
  if (!m) return url; // unknown shape — let server round-trip it
  const base = m[1];
  const gid = m[2] || "0";
  return `${base}/export?format=csv&gid=${gid}`;
}
