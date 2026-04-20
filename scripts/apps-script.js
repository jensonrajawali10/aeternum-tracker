// ============================================================
// AETERNUM TRACKER — Google Sheets Sync (Custom for Trade Log)
// Paste this into Extensions → Apps Script, delete Untitled.gs
// ============================================================

const WEBHOOK_URL    = "https://aeternum-tracker-neon.vercel.app/api/sync/sheets";
const WEBHOOK_SECRET = "605ba376e4e43d792930d64f283cae72903009b717a6dfbf977a6c7c38621cea";
const USER_ID        = "0f8ec0fd-b5c3-41c4-b110-1258d3601d47";

// Your journal config
const SHEET_NAME      = "Trade Log";
const HEADER_ROW      = 4;   // header row number (1-indexed)
const DATA_START_ROW  = 5;   // first data row (1-indexed)

// ============================================================

function setupDailySync() {
  // remove existing triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === "syncAllTrades" || t.getHandlerFunction() === "onEditTrigger") {
      ScriptApp.deleteTrigger(t);
    }
  });
  // daily backfill at 23:00
  ScriptApp.newTrigger("syncAllTrades")
    .timeBased()
    .atHour(23)
    .everyDays(1)
    .create();
  // on-edit live sync
  ScriptApp.newTrigger("onEditTrigger")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  console.log("Triggers installed: daily syncAllTrades + onEdit live sync");
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
  console.log("Sync complete — ok: " + ok + ", skipped: " + skip + ", errors: " + err);
}

function syncRow_(rowIdx) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sh) throw new Error("Sheet '" + SHEET_NAME + "' not found");

  const lastCol = sh.getLastColumn();
  const headers = sh.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0].map(String);
  const row     = sh.getRange(rowIdx, 1, 1, lastCol).getValues()[0];

  // Build column index map by matching header text (case-insensitive, trimmed)
  const idx = {};
  headers.forEach((h, i) => { idx[h.toString().toLowerCase().trim()] = i; });

  function v(name) {
    const i = idx[name.toLowerCase().trim()];
    return i === undefined ? undefined : row[i];
  }

  const ticker = String(v("TICKER") || "").toUpperCase().trim();
  if (!ticker) return "skip";

  // Normalize numeric values, stripping $ signs and commas
  function num(x) {
    if (x === "" || x === null || x === undefined) return null;
    if (typeof x === "number") return x;
    const s = String(x).replace(/[$,]/g, "").replace(/[a-zA-Z\s]/g, "").trim();
    const n = Number(s);
    return isNaN(n) ? null : n;
  }

  // Extract mood number from "MOOD (1-10)" column (expects 1-10 number)
  const moodRaw = v("MOOD (1-10)");
  const mood = typeof moodRaw === "number" ? moodRaw : (moodRaw === "" ? null : Number(moodRaw));

  // Build record — keys match the webhook's expected aliases
  const record = {
    date:          v("DATE") instanceof Date ? v("DATE").toISOString().slice(0,10) : String(v("DATE") || ""),
    asset_type:    String(v("ASSET TYPE") || ""),
    ticker:        ticker,
    direction:     String(v("DIRECTION") || ""),
    strategy:      String(v("STRATEGY") || ""),
    entry_price:   num(v("ENTRY PRICE")),
    exit_price:    num(v("EXIT PRICE")),
    leverage:      num(v("LEVERAGE")),
    position_size: num(v("POSITION SIZE")),
    stop_loss:     num(v("STOP LOSS")),
    take_profit:   num(v("TAKE PROFIT")),
    pnl_native:    num(v("$ P&L")),
    pnl_pct:       num(v("% P&L")),
    rr_ratio:      num(v("R:R RATIO")),
    result:        String(v("RESULT") || ""),
    hold_time:     v("HOLD TIME") == null ? null : String(v("HOLD TIME")),
    commission:    num(v("COMMISSION ($)")),
    mood:          isNaN(mood) || mood == null ? null : Math.max(1, Math.min(10, Math.round(mood))),
    confidence:    String(v("CONFIDENCE") || ""),
    conviction:    String(v("CONVICTION") || ""),
    mistakes:      String(v("MISTAKES") || ""),
    notes:         String(v("NOTES") || ""),
    currency:      "USD",  // journal is all USD
  };

  const payload = {
    user_id:             USER_ID,
    source_sheet_row_id: "row_" + rowIdx,
    row_index:           rowIdx,
    record:              record,
  };

  const resp = UrlFetchApp.fetch(WEBHOOK_URL, {
    method:          "post",
    contentType:     "application/json",
    headers:         { Authorization: "Bearer " + WEBHOOK_SECRET },
    payload:         JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  if (code >= 400) {
    console.error("Row " + rowIdx + " (" + ticker + ") FAIL [" + code + "]: " + resp.getContentText());
    return "err";
  }
  console.log("Row " + rowIdx + " (" + ticker + ") OK");
  return "ok";
}
