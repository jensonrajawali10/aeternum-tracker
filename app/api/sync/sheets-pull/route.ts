import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import {
  fetchSheetCsv,
  parseTradingCsv,
  parseHoldingsCsv,
  tradingRowToTrade,
  holdingsRowToTrade,
} from "@/lib/sync/sheets-pull";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Poll the two Google Sheets CSV exports and upsert into `trades`.
// Auth:
//   - Vercel Cron header (x-vercel-cron: 1) → all users
//   - Bearer CRON_SECRET → all users (manual kick)
//   - Logged-in user (cookie) → that user only
//
// This deliberately only SYNCS existing trades — it does not wipe the table.
// Rows missing from the sheet stay in the DB (so Jenson doesn't lose history
// if he archives a row).  Idempotent via source_sheet_row_id upsert.

function checkCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  if (req.headers.get("x-vercel-cron") === "1") return true;
  return false;
}

export async function POST(req: NextRequest) {
  return run(req);
}

export async function GET(req: NextRequest) {
  return run(req);
}

interface SyncResult {
  user_id: string;
  holdings_synced: number;
  trading_synced: number;
  errors: string[];
}

async function run(req: NextRequest) {
  const isCron = checkCronAuth(req);

  // For interactive mode, restrict to the current user only
  let restrictUserId: string | null = null;
  if (!isCron) {
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    restrictUserId = user.id;
  }

  const admin = supabaseAdmin();
  const q = admin
    .from("user_settings")
    .select("user_id, sheet_holdings_url, sheet_trading_url")
    .or("sheet_holdings_url.not.is.null,sheet_trading_url.not.is.null");
  const { data: settings } = restrictUserId
    ? await q.eq("user_id", restrictUserId)
    : await q;

  const results: SyncResult[] = [];
  for (const s of settings || []) {
    const res = await syncOne(admin, s.user_id, s.sheet_holdings_url, s.sheet_trading_url);
    results.push(res);
  }

  return NextResponse.json({
    ok: true,
    results,
    total_synced: results.reduce((a, r) => a + r.holdings_synced + r.trading_synced, 0),
  });
}

async function syncOne(
  admin: ReturnType<typeof supabaseAdmin>,
  userId: string,
  holdingsUrl: string | null,
  tradingUrl: string | null,
): Promise<SyncResult> {
  const errors: string[] = [];
  let holdingsCount = 0;
  let tradingCount = 0;

  // ---- Holdings → investing book ----
  if (holdingsUrl) {
    try {
      const csv = await fetchSheetCsv(holdingsUrl);
      const rows = parseHoldingsCsv(csv);
      const inserts = rows
        .map((r) => holdingsRowToTrade(r, userId))
        .filter(Boolean) as ReturnType<typeof holdingsRowToTrade>[];
      if (inserts.length) {
        const { error } = await admin
          .from("trades")
          .upsert(inserts.filter(Boolean) as object[], { onConflict: "user_id,source_sheet_row_id" });
        if (error) errors.push(`holdings: ${error.message}`);
        else holdingsCount = inserts.length;
      }
    } catch (e) {
      errors.push(`holdings_fetch: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ---- Trading → idx_trading book ----
  if (tradingUrl) {
    try {
      const csv = await fetchSheetCsv(tradingUrl);
      const rows = parseTradingCsv(csv);
      const inserts = rows
        .map((r) => tradingRowToTrade(r, userId))
        .filter(Boolean) as ReturnType<typeof tradingRowToTrade>[];
      if (inserts.length) {
        const { error } = await admin
          .from("trades")
          .upsert(inserts.filter(Boolean) as object[], { onConflict: "user_id,source_sheet_row_id" });
        if (error) errors.push(`trading: ${error.message}`);
        else tradingCount = inserts.length;
      }
    } catch (e) {
      errors.push(`trading_fetch: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await admin
    .from("user_settings")
    .update({ sheet_last_sync_at: new Date().toISOString() })
    .eq("user_id", userId);

  return { user_id: userId, holdings_synced: holdingsCount, trading_synced: tradingCount, errors };
}
