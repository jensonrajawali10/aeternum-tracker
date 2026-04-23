// Pull-mode sync for the two Google Sheets that drive Aeternum's books.
//
// Previous architecture (sync/sheets/route.ts) required Jenson to paste an
// Apps Script block into his sheet so edits POST to our webhook.  New
// architecture: we pull via `/export?format=csv` on a cron, parse the CSV,
// upsert into Supabase.  Zero Apps Script needed — Jenson just edits.
//
// Trading sheet (23 cols) → trades with book='idx_trading'
//   DATE | SECTOR | TICKER | STRATEGY | ENTRY PRICE | EXIT PRICE | LEVERAGE |
//   LOTS | STOP LOSS | TAKE PROFIT | Rp P&L | % P&L | R:R RATIO | RESULT |
//   HOLD TIME | COMMISSION (Rp) | NET P&L (Rp) | CUM. P&L (Rp) | MOOD (1-10) |
//   CONFIDENCE | CONVICTION | MISTAKES | NOTES
//
// Holdings sheet (24 cols) → trades with book='investing' (open positions only)
//   PURCHASE DATE | SECTOR | TICKER | THESIS | ENTRY PRICE | LOTS |
//   COST BASIS (Rp) | STOP LOSS | TARGET PRICE | CURRENT PRICE |
//   PRICE DIFF (Rp) | CURRENT VALUE (Rp) | UNREALIZED P&L (Rp) | UNREALIZED % |
//   DAYS HELD | EST. COMMISSION (Rp) | NET IF SOLD (Rp) | STATUS |
//   CONVICTION | DIV YIELD % | TO TARGET % | CATALYST | NOTES

import type { AssetClass, BookType } from "@/lib/types";

/** Parse a numeric cell that might contain commas, "Rp", "%", or blanks. */
export function parseNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const s = String(v).replace(/[,Rp$\s%x]/gi, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Date-format hint: Trading sheet is M/D/YYYY, Holdings sheet is DD/MM/YYYY. */
export type DateFormat = "MDY" | "DMY";

/** Parse a date cell. Supports ISO (YYYY-MM-DD), MDY (4/21/2026), and DMY
 * (21/04/2026).  Caller passes the expected format for the sheet. */
export function parseSheetDate(v: unknown, fmt: DateFormat = "MDY"): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const [, a, b, yyyy] = m;
    // DMY: first=day, second=month.  MDY: first=month, second=day.
    // Auto-detect override: if one of the two numbers is > 12 it must be the
    // day; flip format if the explicit hint disagrees.  Protects against
    // sheet-format drift if Jenson changes locale later.
    const na = Number(a);
    const nb = Number(b);
    let day: string;
    let mon: string;
    if (na > 12 && nb <= 12) {
      day = a;
      mon = b;
    } else if (nb > 12 && na <= 12) {
      mon = a;
      day = b;
    } else if (fmt === "DMY") {
      day = a;
      mon = b;
    } else {
      mon = a;
      day = b;
    }
    return `${yyyy}-${mon.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** "3 days" / "2h" / "5 days 4h" → approximate hours. */
export function parseHoldTimeToHours(v: unknown): number | null {
  if (!v) return null;
  const s = String(v).toLowerCase().trim();
  if (!s) return null;
  let total = 0;
  const days = s.match(/(\d+(?:\.\d+)?)\s*d/);
  if (days) total += parseFloat(days[1]) * 24;
  const hours = s.match(/(\d+(?:\.\d+)?)\s*h/);
  if (hours) total += parseFloat(hours[1]);
  const mins = s.match(/(\d+(?:\.\d+)?)\s*m(?!o)/);
  if (mins) total += parseFloat(mins[1]) / 60;
  return total > 0 ? total : null;
}

/** Minimal CSV parser that handles quoted fields with commas inside.
 * Replaces pulling a full dependency.  Handles CRLF and quoted newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Fetch a public Google Sheet as CSV, following the 307 redirect. */
export async function fetchSheetCsv(url: string): Promise<string> {
  const r = await fetch(url, { redirect: "follow", cache: "no-store" });
  if (!r.ok) throw new Error(`sheet_fetch_${r.status}`);
  return r.text();
}

export interface TradingRow {
  row_index: number;
  trade_date: string | null;
  sector: string | null;
  ticker: string;
  strategy: string | null;
  entry_price: number | null;
  exit_price: number | null;
  leverage: number | null;
  lots: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  pnl_idr: number | null;        // raw "Rp P&L"
  pnl_pct: number | null;
  rr_ratio: number | null;
  result: "WIN" | "LOSS" | "BE" | null;
  hold_time_hours: number | null;
  commission_idr: number | null;
  net_pnl_idr: number | null;
  mood: number | null;
  confidence: string | null;
  conviction: string | null;
  mistakes: string | null;
  notes: string | null;
}

export interface HoldingsRow {
  row_index: number;
  purchase_date: string | null;
  sector: string | null;
  ticker: string;
  thesis: string | null;
  entry_price: number | null;
  lots: number | null;
  cost_basis_idr: number | null;
  stop_loss: number | null;
  target_price: number | null;
  current_price: number | null;
  unrealized_pnl_idr: number | null;
  unrealized_pct: number | null;
  days_held: number | null;
  est_commission_idr: number | null;
  net_if_sold_idr: number | null;
  status: string | null;
  conviction: string | null;
  div_yield_pct: number | null;
  to_target_pct: number | null;
  catalyst: string | null;
  notes: string | null;
}

/** Row has a usable ticker and at least one meaningful numeric — drops blank
 * spacer rows without filtering rows that are in-flight / partially filled. */
function isLiveRow(ticker: string, ...anyOf: (number | null)[]): boolean {
  if (!ticker || ticker.length < 1 || ticker.length > 10) return false;
  // Require at least one non-null numeric AND reject pure-number tickers
  // (those are artefacts of trailing CSV columns).
  if (!/^[A-Z][A-Z0-9.]*$/.test(ticker)) return false;
  return anyOf.some((v) => v != null);
}

/** Find the header row inside a CSV that has preamble lines before it.
 * Returns -1 if not found. */
function findHeaderRow(rows: string[][], mustContain: string[]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cells = (rows[i] || []).map((c) => String(c || "").toUpperCase().trim());
    if (mustContain.every((t) => cells.some((c) => c.includes(t)))) return i;
  }
  return -1;
}

function parseResult(v: unknown): "WIN" | "LOSS" | "BE" | null {
  if (!v) return null;
  const s = String(v).toUpperCase().trim();
  if (s.startsWith("WIN")) return "WIN";
  if (s.startsWith("LOSS") || s === "LOSE") return "LOSS";
  if (s === "BE" || s === "BREAK EVEN" || s === "BREAKEVEN") return "BE";
  return null;
}

export function parseTradingCsv(csvText: string): TradingRow[] {
  const rows = parseCsv(csvText);
  // Skip preamble — find the row containing DATE + TICKER (header row).
  const headerIdx = findHeaderRow(rows, ["DATE", "TICKER"]);
  if (headerIdx < 0 || rows.length < headerIdx + 2) return [];
  const out: TradingRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 3) continue;
    const ticker = String(r[2] || "").trim().toUpperCase();
    const entry = parseNum(r[4]);
    const lots = parseNum(r[7]);
    if (!isLiveRow(ticker, entry, lots, parseNum(r[5]))) continue;
    out.push({
      row_index: i,
      trade_date: parseSheetDate(r[0], "MDY"),
      sector: String(r[1] || "").trim() || null,
      ticker,
      strategy: String(r[3] || "").trim() || null,
      entry_price: entry,
      exit_price: parseNum(r[5]),
      leverage: parseNum(r[6]),
      lots,
      stop_loss: parseNum(r[8]),
      take_profit: parseNum(r[9]),
      pnl_idr: parseNum(r[10]),
      pnl_pct: parseNum(r[11]),
      rr_ratio: parseNum(r[12]),
      result: parseResult(r[13]),
      hold_time_hours: parseHoldTimeToHours(r[14]),
      commission_idr: parseNum(r[15]),
      net_pnl_idr: parseNum(r[16]),
      // r[17] = CUM P&L — we compute our own, skip
      mood: parseNum(r[18]),
      confidence: String(r[19] || "").trim() || null,
      conviction: String(r[20] || "").trim() || null,
      mistakes: String(r[21] || "").trim() || null,
      notes: String(r[22] || "").trim() || null,
    });
  }
  return out;
}

export function parseHoldingsCsv(csvText: string): HoldingsRow[] {
  const rows = parseCsv(csvText);
  const headerIdx = findHeaderRow(rows, ["PURCHASE DATE", "TICKER"]);
  if (headerIdx < 0 || rows.length < headerIdx + 2) return [];
  const out: HoldingsRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 3) continue;
    const ticker = String(r[2] || "").trim().toUpperCase();
    const entry = parseNum(r[4]);
    const current = parseNum(r[9]);
    if (!isLiveRow(ticker, entry, current, parseNum(r[5]))) continue;
    out.push({
      row_index: i,
      purchase_date: parseSheetDate(r[0], "DMY"),
      sector: String(r[1] || "").trim() || null,
      ticker,
      thesis: String(r[3] || "").trim() || null,
      entry_price: entry,
      lots: parseNum(r[5]),
      cost_basis_idr: parseNum(r[6]),
      stop_loss: parseNum(r[7]),
      target_price: parseNum(r[8]),
      current_price: current,
      unrealized_pnl_idr: parseNum(r[12]),
      unrealized_pct: parseNum(r[13]),
      days_held: parseNum(r[14]),
      est_commission_idr: parseNum(r[15]),
      net_if_sold_idr: parseNum(r[16]),
      status: String(r[17] || "").trim() || null,
      conviction: String(r[18] || "").trim() || null,
      div_yield_pct: parseNum(r[19]),
      to_target_pct: parseNum(r[20]),
      catalyst: String(r[21] || "").trim() || null,
      notes: String(r[22] || "").trim() || null,
    });
  }
  return out;
}

/** IDX tickers in Jenson's sheets are 3–5 caps, no suffix.  Infer asset class
 * from length + format — this matches how `deriveBook` already treats them. */
export function inferIdxAssetClass(ticker: string): AssetClass {
  // Anything 3–5 uppercase alpha is IDX equity.  Future: detect bonds / REITs.
  if (/^[A-Z]{3,5}$/.test(ticker)) return "idx_equity";
  return "idx_equity";
}

export interface TradeInsertRow {
  user_id: string;
  source_sheet_row_id: string;
  trade_date: string;
  asset_type: string;
  asset_class: AssetClass;
  ticker: string;
  direction: "LONG" | "SHORT";
  strategy: string | null;
  book: BookType;
  entry_price: number;
  exit_price: number | null;
  leverage: number;
  position_size: number;
  stop_loss: number | null;
  take_profit: number | null;
  pnl_native: number | null;
  pnl_currency: "IDR" | "USD";
  pnl_pct: number | null;
  rr_ratio: number | null;
  result: "WIN" | "LOSS" | "BE" | null;
  hold_time_hours: number | null;
  commission_native: number;
  net_pnl_native: number | null;
  fx_rate_to_idr: number;
  mood: number | null;
  confidence: string | null;
  conviction: string | null;
  mistakes: string | null;
  notes: string | null;
  synced_at: string;
}

/** IDX "lots" → shares (1 lot = 100 shares).  Jenson's sheet always uses lots. */
export const IDX_LOT_SIZE = 100;

/** Convert a trading-sheet row into the canonical `trades` insert shape. */
export function tradingRowToTrade(r: TradingRow, userId: string): TradeInsertRow | null {
  if (!r.trade_date || r.entry_price == null || r.lots == null) return null;
  const shares = r.lots * IDX_LOT_SIZE;
  return {
    user_id: userId,
    source_sheet_row_id: `trading:${r.row_index}:${r.ticker}:${r.trade_date}`,
    trade_date: r.trade_date,
    asset_type: "idx_equity",
    asset_class: inferIdxAssetClass(r.ticker),
    ticker: r.ticker,
    direction: "LONG",   // Sheet doesn't mark shorts; add column if needed
    strategy: r.strategy,
    book: "idx_trading",
    entry_price: r.entry_price,
    exit_price: r.exit_price,
    leverage: r.leverage ?? 1,
    position_size: shares,
    stop_loss: r.stop_loss,
    take_profit: r.take_profit,
    pnl_native: r.pnl_idr,
    pnl_currency: "IDR",
    pnl_pct: r.pnl_pct,
    rr_ratio: r.rr_ratio,
    result: r.result,
    hold_time_hours: r.hold_time_hours,
    commission_native: r.commission_idr ?? 0,
    net_pnl_native: r.net_pnl_idr,
    fx_rate_to_idr: 1,
    mood: r.mood,
    confidence: r.confidence,
    conviction: r.conviction,
    mistakes: r.mistakes,
    notes: r.notes,
    synced_at: new Date().toISOString(),
  };
}

/** Holdings sheet → trades with book='investing' and NO exit_price (open).
 *
 * Lots is optional in Jenson's sheet — if missing, infer shares from cost
 * basis / entry price.  If BOTH lots AND cost_basis are missing, the row
 * is a tracking/watchlist entry with no capital committed; skip it so the
 * NAV formula doesn't receive a spurious zero-qty position. */
export function holdingsRowToTrade(r: HoldingsRow, userId: string): TradeInsertRow | null {
  if (!r.purchase_date || r.entry_price == null) return null;
  let shares: number | null = null;
  if (r.lots != null && r.lots > 0) {
    shares = r.lots * IDX_LOT_SIZE;
  } else if (r.cost_basis_idr != null && r.cost_basis_idr > 0 && r.entry_price > 0) {
    // Derive shares from cost basis: shares ≈ cost_basis / entry_price.
    // Rounded to nearest lot to avoid fractional-share ghosts.
    const rawShares = r.cost_basis_idr / r.entry_price;
    shares = Math.round(rawShares / IDX_LOT_SIZE) * IDX_LOT_SIZE;
  }
  if (shares == null || shares <= 0) return null;
  // daysHeld approximation in hours; if not available leave null (frontend
  // derives from trade_date anyway for open positions)
  const holdHours = r.days_held != null ? r.days_held * 24 : null;
  return {
    user_id: userId,
    source_sheet_row_id: `holdings:${r.row_index}:${r.ticker}:${r.purchase_date}`,
    trade_date: r.purchase_date,
    asset_type: "idx_equity",
    asset_class: inferIdxAssetClass(r.ticker),
    ticker: r.ticker,
    direction: "LONG",
    strategy: r.thesis,   // reuse `strategy` column for thesis/notes
    book: "investing",
    entry_price: r.entry_price,
    exit_price: null,     // Holdings are OPEN — NAV formula marks these to market
    leverage: 1,
    position_size: shares,
    stop_loss: r.stop_loss,
    take_profit: r.target_price,
    pnl_native: r.unrealized_pnl_idr,
    pnl_currency: "IDR",
    pnl_pct: r.unrealized_pct,
    rr_ratio: null,
    result: null,
    hold_time_hours: holdHours,
    commission_native: r.est_commission_idr ?? 0,
    net_pnl_native: r.net_if_sold_idr,
    fx_rate_to_idr: 1,
    mood: null,
    confidence: null,
    conviction: r.conviction,
    mistakes: null,
    notes: [r.catalyst, r.notes].filter(Boolean).join(" · ") || null,
    synced_at: new Date().toISOString(),
  };
}
