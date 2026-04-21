import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPortfolio } from "@/lib/crypto/hyperliquid";
import { getUsdIdr } from "@/lib/prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One-shot backfill: pulls each user's Hyperliquid `portfolio` history
 * (accountValueHistory from the `allTime` window) and writes one nav_history
 * row per day for the `crypto_trading` book. Safe to re-run — upsert on
 * (user_id, snapshot_date, book).
 *
 * Also refreshes the `all` book's rows on those same dates by summing
 * non-crypto sheet NAV (if any historical data exists) plus HL account value.
 * For users without pre-existing `all` rows on a given date, we simply seed
 * with HL alone — better than a zero.
 *
 * Protected by CRON_SECRET via Bearer header.
 */

function checkAuth(req: NextRequest): boolean {
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

async function run(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = supabaseAdmin();
  const { data: settingsRows } = await supabase
    .from("user_settings")
    .select("user_id, hyperliquid_address")
    .not("hyperliquid_address", "is", null);
  const users = (settingsRows || []).filter((r) => r.hyperliquid_address) as {
    user_id: string;
    hyperliquid_address: string;
  }[];
  if (!users.length) return NextResponse.json({ ok: true, users: 0, rows: 0 });

  // Current USD/IDR — HL values are USD, we store nav_history in IDR.
  // For historical accuracy we could pull fx_snapshots per date; for now we
  // use today's FX which is close enough for chart rebasing (the chart
  // rebases-to-100 anyway, so a constant FX factor doesn't distort shape).
  const usdIdr = (await getUsdIdr()) ?? 16500;

  let totalRows = 0;
  const perUser: { user_id: string; rows: number; firstDate?: string; lastDate?: string }[] = [];

  for (const { user_id, hyperliquid_address } of users) {
    try {
      const portfolio = await getPortfolio(hyperliquid_address);
      const allTime = portfolio.find(([win]) => win === "allTime");
      if (!allTime) {
        perUser.push({ user_id, rows: 0 });
        continue;
      }
      const history = allTime[1].accountValueHistory;

      // Collapse to one row per calendar date (last value wins).
      const byDate = new Map<string, number>();
      for (const [ms, valStr] of history) {
        const val = parseFloat(valStr);
        if (!isFinite(val)) continue;
        const d = new Date(ms).toISOString().slice(0, 10);
        byDate.set(d, val);
      }

      const dates = [...byDate.keys()].sort();
      if (!dates.length) {
        perUser.push({ user_id, rows: 0 });
        continue;
      }

      // Pull existing non-crypto `all` rows for this user so we can rebuild the
      // `all` line including HL on each date (without double-counting crypto).
      const { data: existingAll } = await supabase
        .from("nav_history")
        .select("snapshot_date, nav_idr, realized_pnl_idr, unrealized_pnl_idr")
        .eq("user_id", user_id)
        .in("book", ["investing", "idx_trading", "other"]);
      const nonCryptoNavByDate = new Map<string, number>();
      for (const r of existingAll || []) {
        const d = r.snapshot_date as string;
        nonCryptoNavByDate.set(d, (nonCryptoNavByDate.get(d) || 0) + Number(r.nav_idr || 0));
      }

      // Upsert crypto_trading rows
      const cryptoRows = dates.map((d) => ({
        user_id,
        snapshot_date: d,
        book: "crypto_trading" as const,
        nav_idr: byDate.get(d)! * usdIdr,
        realized_pnl_idr: 0,
        unrealized_pnl_idr: 0,
        gross_exposure_pct: 100,
        net_exposure_pct: 100,
      }));

      // Rebuild `all` rows for every date we have HL data
      const allRows = dates.map((d) => ({
        user_id,
        snapshot_date: d,
        book: "all" as const,
        nav_idr: (byDate.get(d)! * usdIdr) + (nonCryptoNavByDate.get(d) || 0),
        realized_pnl_idr: 0,
        unrealized_pnl_idr: 0,
        gross_exposure_pct: 100,
        net_exposure_pct: 100,
      }));

      // Upsert in chunks of 500 to stay within row limits
      for (const chunk of chunks([...cryptoRows, ...allRows], 500)) {
        await supabase
          .from("nav_history")
          .upsert(chunk, { onConflict: "user_id,snapshot_date,book" });
      }

      totalRows += cryptoRows.length + allRows.length;
      perUser.push({
        user_id,
        rows: cryptoRows.length + allRows.length,
        firstDate: dates[0],
        lastDate: dates[dates.length - 1],
      });
    } catch (e) {
      perUser.push({ user_id, rows: 0 });
      console.error(`[backfill-crypto-nav] user ${user_id} failed:`, e);
    }
  }

  return NextResponse.json({ ok: true, users: users.length, rows: totalRows, perUser });
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
