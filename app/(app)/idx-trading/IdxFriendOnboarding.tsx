"use client";

import { useMemo, useState } from "react";

const TEMPLATE = `// ============================================================
// AETERNUM TRACKER — IDX TRADING (FRIEND'S SHEET)
// Paste into Extensions → Apps Script on the IDX trading sheet
// ============================================================
// All rows are written as book=idx_trading into Jenson's DB.
// ============================================================

const WEBHOOK_URL    = "__WEBHOOK_URL__";
const WEBHOOK_SECRET = "__WEBHOOK_SECRET__";
const USER_ID        = "__USER_ID__";

const SHEET_NAME     = "Trade Log";
const HEADER_ROW     = 4;
const DATA_START_ROW = 5;

function setupDailySync() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === "syncAllTrades" || t.getHandlerFunction() === "onEditTrigger") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("syncAllTrades").timeBased().atHour(23).everyDays(1).create();
  ScriptApp.newTrigger("onEditTrigger").forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  console.log("Triggers installed");
}

function onEditTrigger(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (sh.getName() !== SHEET_NAME) return;
  const row = e.range.getRow();
  if (row < DATA_START_ROW) return;
  syncRow_(row);
}

function syncAllTrades() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sh) throw new Error("Sheet '" + SHEET_NAME + "' not found");
  const lastRow = sh.getLastRow();
  if (lastRow < DATA_START_ROW) { console.log("No data rows."); return; }
  let ok = 0, err = 0, skip = 0;
  for (let r = DATA_START_ROW; r <= lastRow; r++) {
    const res = syncRow_(r);
    if (res === "ok") ok++;
    else if (res === "skip") skip++;
    else err++;
  }
  console.log("Sync — ok: " + ok + ", skipped: " + skip + ", errors: " + err);
}

function syncRow_(rowIdx) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sh) throw new Error("Sheet not found");
  const lastCol = sh.getLastColumn();
  const headers = sh.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0].map(String);
  const row = sh.getRange(rowIdx, 1, 1, lastCol).getValues()[0];
  const idx = {};
  headers.forEach((h, i) => { idx[h.toString().toLowerCase().trim()] = i; });
  const v = (n) => { const i = idx[n.toLowerCase().trim()]; return i === undefined ? undefined : row[i]; };

  const ticker = String(v("TICKER") || "").toUpperCase().trim();
  if (!ticker) return "skip";

  const num = (x) => {
    if (x === "" || x == null) return null;
    if (typeof x === "number") return x;
    const s = String(x).replace(/[$,]/g, "").replace(/[a-zA-Z\\s]/g, "").trim();
    const n = Number(s);
    return isNaN(n) ? null : n;
  };
  const moodRaw = v("MOOD (1-10)");
  const mood = typeof moodRaw === "number" ? moodRaw : (moodRaw === "" ? null : Number(moodRaw));

  const record = {
    date:          v("DATE") instanceof Date ? v("DATE").toISOString().slice(0,10) : String(v("DATE") || ""),
    asset_type:    "IDX Equity",
    ticker:        ticker,
    direction:     String(v("DIRECTION") || ""),
    strategy:      String(v("STRATEGY") || ""),
    entry_price:   num(v("ENTRY PRICE")),
    exit_price:    num(v("EXIT PRICE")),
    leverage:      num(v("LEVERAGE")),
    position_size: num(v("POSITION SIZE")),
    stop_loss:     num(v("STOP LOSS")),
    take_profit:   num(v("TAKE PROFIT")),
    pnl_native:    num(v("$ P&L")) || num(v("Rp P&L")) || num(v("PNL")),
    pnl_pct:       num(v("% P&L")),
    rr_ratio:      num(v("R:R RATIO")),
    result:        String(v("RESULT") || ""),
    hold_time:     v("HOLD TIME") == null ? null : String(v("HOLD TIME")),
    commission:    num(v("COMMISSION")),
    mood:          isNaN(mood) || mood == null ? null : Math.max(1, Math.min(10, Math.round(mood))),
    confidence:    String(v("CONFIDENCE") || ""),
    conviction:    String(v("CONVICTION") || ""),
    mistakes:      String(v("MISTAKES") || ""),
    notes:         String(v("NOTES") || ""),
    currency:      "IDR",
  };

  const payload = {
    user_id:             USER_ID,
    source_sheet_row_id: "idxfriend_row_" + rowIdx,
    row_index:           rowIdx,
    record:              record,
  };

  const resp = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post", contentType: "application/json",
    headers: { Authorization: "Bearer " + WEBHOOK_SECRET },
    payload: JSON.stringify(payload), muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  if (code >= 400) { console.error("Row " + rowIdx + " (" + ticker + ") FAIL [" + code + "]: " + resp.getContentText()); return "err"; }
  console.log("Row " + rowIdx + " (" + ticker + ") OK");
  return "ok";
}
`;

export function IdxFriendOnboarding({
  userId,
  webhookUrl,
  webhookSecret,
}: {
  userId: string;
  webhookUrl: string;
  webhookSecret: string;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Full script — always used for clipboard writes (the friend needs the real
  // secret in the code block they paste).
  const filled = useMemo(
    () =>
      TEMPLATE.replace("__WEBHOOK_URL__", webhookUrl)
        .replace("__WEBHOOK_SECRET__", webhookSecret)
        .replace("__USER_ID__", userId),
    [webhookUrl, webhookSecret, userId],
  );

  // Preview variant — masks the secret unless explicitly revealed so Jenson
  // doesn't expose the webhook token on screen during a demo / screen share.
  const maskedSecret = webhookSecret
    ? `${webhookSecret.slice(0, 4)}${"•".repeat(Math.max(0, webhookSecret.length - 8))}${webhookSecret.slice(-4)}`
    : "";
  const preview = useMemo(
    () =>
      TEMPLATE.replace("__WEBHOOK_URL__", webhookUrl)
        .replace("__WEBHOOK_SECRET__", revealed ? webhookSecret : maskedSecret)
        .replace("__USER_ID__", userId),
    [webhookUrl, webhookSecret, userId, revealed, maskedSecret],
  );

  async function copy() {
    await navigator.clipboard.writeText(filled);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <ol className="text-[11.5px] text-muted leading-relaxed list-decimal list-inside space-y-1">
        <li>Send this code to your IDX trader.</li>
        <li>They open their Google Sheet → Extensions → Apps Script → paste → Save.</li>
        <li>Run <span className="font-mono text-accent">setupDailySync</span> once (grants permissions).</li>
        <li>Run <span className="font-mono text-accent">syncAllTrades</span> to backfill.</li>
        <li>Every edit after that syncs live into this page.</li>
      </ol>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={copy}
          className="px-3 py-1.5 rounded-[4px] bg-accent text-bg text-[11px] font-semibold tracking-wide hover:bg-accent-dim transition-colors"
        >
          {copied ? "Copied ✓" : "Copy Apps Script"}
        </button>
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="px-2.5 py-1.5 rounded-[4px] bg-panel-2 border border-border text-[11px] font-medium hover:border-accent/60 transition-colors"
        >
          {revealed ? "Hide secret" : "Reveal secret"}
        </button>
        <span className="text-[10.5px] text-muted-2">
          {filled.length} chars · pre-filled with your webhook · {revealed ? "secret visible" : "secret masked in preview"}
        </span>
      </div>
      <pre className="mt-2 text-[10.5px] leading-relaxed bg-panel-2 border border-border rounded-[4px] p-3 max-h-[400px] overflow-auto font-mono">
        {preview}
      </pre>
    </div>
  );
}
