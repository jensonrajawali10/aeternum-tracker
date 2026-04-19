import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { deriveBook, normalizeAssetClass, derivePnlCurrency } from "@/lib/sync/book";
import { numeric, parseDate, parseHoldTime, parseDirection, parseResult } from "@/lib/sync/parse";
import { getFxRates } from "@/lib/sync/fx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pick(rec: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (rec[k] !== undefined && rec[k] !== null && rec[k] !== "") return rec[k];
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.SHEETS_WEBHOOK_SECRET}`;
  if (!process.env.SHEETS_WEBHOOK_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    user_id?: string;
    source_sheet_row_id?: string;
    row_index?: number;
    record?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const user_id = body.user_id;
  const source_sheet_row_id = body.source_sheet_row_id;
  const rec = body.record || {};
  if (!user_id || !source_sheet_row_id) {
    return NextResponse.json({ error: "missing_user_or_row_id" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const asset_type = String(pick(rec, "asset_type", "asset", "market", "asset_class") ?? "");
  const ticker = String(pick(rec, "ticker", "symbol") ?? "").toUpperCase().trim();
  if (!ticker) {
    return NextResponse.json({ error: "missing_ticker", row: body.row_index }, { status: 400 });
  }
  const strategy = (pick(rec, "strategy", "setup") as string | undefined) ?? null;
  const book = deriveBook(asset_type, strategy);
  const asset_class = normalizeAssetClass(asset_type);
  const direction = parseDirection(pick(rec, "direction", "side", "type"));
  const trade_date = parseDate(pick(rec, "trade_date", "entry_date", "date", "open_date"));
  const entry_price = numeric(pick(rec, "entry_price", "entry", "avg_entry", "price_in"));
  const exit_price = numeric(pick(rec, "exit_price", "exit", "price_out", "close_price"));
  const position_size = numeric(pick(rec, "position_size", "qty", "quantity", "shares", "size"));
  const stop_loss = numeric(pick(rec, "stop_loss", "stop", "sl"));
  const take_profit = numeric(pick(rec, "take_profit", "target", "tp"));
  const leverage = numeric(pick(rec, "leverage", "lev")) ?? 1;
  const hold_time_hours = parseHoldTime(pick(rec, "hold_time_hours", "hold_time", "hold"));
  const result = parseResult(pick(rec, "result", "outcome"), exit_price);
  const conviction = (pick(rec, "conviction") as string | undefined) ?? null;
  const confidence = (pick(rec, "confidence") as string | undefined) ?? null;
  const moodRaw = pick(rec, "mood");
  const mood = typeof moodRaw === "number" ? Math.max(1, Math.min(10, Math.round(moodRaw))) : (() => {
    const n = Number(String(moodRaw ?? ""));
    return isNaN(n) ? null : Math.max(1, Math.min(10, Math.round(n)));
  })();
  const mistakes = (pick(rec, "mistakes", "errors") as string | undefined) ?? null;
  const notes = (pick(rec, "notes", "comment") as string | undefined) ?? null;
  const rr_ratio = numeric(pick(rec, "rr_ratio", "rr", "risk_reward"));
  const commission_native = numeric(pick(rec, "commission_native", "commission", "fees")) ?? 0;

  const currencyRaw = String(pick(rec, "currency", "ccy", "pnl_currency") ?? "").toUpperCase().trim();
  const derivedPnlCcy = derivePnlCurrency(asset_class);
  const pnl_currency = (["IDR", "USD"].includes(currencyRaw) ? currencyRaw : derivedPnlCcy) as "IDR" | "USD";

  let pnl_native = numeric(pick(rec, "pnl_native", "pnl", "pnl_abs"));
  if (pnl_native == null && exit_price != null && entry_price != null && position_size != null) {
    const sign = direction === "LONG" ? 1 : -1;
    pnl_native = sign * (exit_price - entry_price) * position_size;
  }
  const net_pnl_native = pnl_native != null ? pnl_native - commission_native : null;

  let pnl_pct = numeric(pick(rec, "pnl_pct", "return_pct", "pct"));
  if (pnl_pct == null && pnl_native != null && entry_price && position_size) {
    pnl_pct = (pnl_native / (entry_price * position_size)) * 100;
  }

  let fx_rate_to_idr: number | null = null;
  if (pnl_currency === "IDR") {
    fx_rate_to_idr = 1;
  } else {
    const rates = await getFxRates([trade_date], pnl_currency, "IDR", supabase);
    fx_rate_to_idr = rates[trade_date] ?? null;
  }

  const row = {
    user_id,
    source_sheet_row_id,
    trade_date,
    asset_type,
    asset_class,
    ticker,
    direction,
    strategy,
    book,
    entry_price: entry_price ?? 0,
    exit_price,
    leverage,
    position_size: position_size ?? 0,
    stop_loss,
    take_profit,
    pnl_native,
    pnl_currency,
    pnl_pct,
    rr_ratio,
    result,
    hold_time_hours,
    commission_native,
    net_pnl_native,
    fx_rate_to_idr,
    mood,
    confidence,
    conviction,
    mistakes,
    notes,
    synced_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("trades")
    .upsert(row, { onConflict: "user_id,source_sheet_row_id" })
    .select("id")
    .single();

  if (error) {
    console.error("[sync] upsert failed:", error, row);
    return NextResponse.json({ error: error.message, row }, { status: 500 });
  }

  return NextResponse.json({ ok: true, trade_id: data?.id, book, asset_class });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    usage: "POST with Authorization: Bearer <SHEETS_WEBHOOK_SECRET> and JSON { user_id, source_sheet_row_id, row_index, record }",
  });
}
