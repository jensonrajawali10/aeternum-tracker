export function buildAppsScript(params: {
  userId: string;
  webhookUrl: string;
  webhookSecret: string;
}): string {
  return `// AETERNUM TRACKER — Trade Journal Sync
// Paste into Extensions → Apps Script. Save. Run setupDailySync once to grant permissions.
// Then any edit to a row will sync within 15s.

const WEBHOOK_URL    = ${JSON.stringify(params.webhookUrl)};
const WEBHOOK_SECRET = ${JSON.stringify(params.webhookSecret)};
const USER_ID        = ${JSON.stringify(params.userId)};
const SHEET_NAME     = "Trades"; // rename if your tab has a different name

function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sh = e.range.getSheet();
    if (sh.getName() !== SHEET_NAME) return;
    const row = e.range.getRow();
    if (row < 2) return; // header
    syncRow_(sh, row);
  } catch (err) {
    console.error(err);
  }
}

function syncAllTrades() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sh) throw new Error("Sheet '" + SHEET_NAME + "' not found");
  const last = sh.getLastRow();
  for (let r = 2; r <= last; r++) {
    syncRow_(sh, r);
    Utilities.sleep(100);
  }
}

function setupDailySync() {
  // remove existing triggers
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  // re-add onEdit installable trigger (required for external calls from onEdit)
  ScriptApp.newTrigger("onEdit")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  // daily full resync as safety net
  ScriptApp.newTrigger("syncAllTrades")
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();
  syncAllTrades();
}

function syncRow_(sh, rowIdx) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normalizeHeader_);
  const row = sh.getRange(rowIdx, 1, 1, sh.getLastColumn()).getValues()[0];
  const rec = {};
  headers.forEach((h, i) => { if (h) rec[h] = row[i]; });

  // Skip empty rows
  if (!rec.ticker && !rec.symbol && !rec.asset_type) return;

  const payload = {
    user_id: USER_ID,
    source_sheet_row_id: (rec.trade_id || rec.id || "row_" + rowIdx).toString(),
    row_index: rowIdx,
    record: rec
  };

  const resp = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + WEBHOOK_SECRET },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = resp.getResponseCode();
  if (code >= 400) console.error("Sync failed row " + rowIdx + ": " + code + " " + resp.getContentText());
}

function normalizeHeader_(h) {
  return String(h || "").toLowerCase().trim().replace(/\\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}
`;
}
