import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { BookType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Trade {
  strategy: string | null;
  asset_type: string | null;
  result: "WIN" | "LOSS" | "BE" | "OPEN" | null;
  rr_ratio: number | null;
  net_pnl_native: number | null;
  pnl_native: number | null;
  pnl_currency: "IDR" | "USD";
  fx_rate_to_idr: number | null;
  hold_time_hours: number | null;
  pnl_pct: number | null;
  book: BookType;
  exit_price: number | null;
  entry_price: number | null;
  position_size: number | null;
}

function toIdr(v: number, ccy: string, fx: number | null): number {
  if (ccy === "IDR") return v;
  return v * (fx || 16500);
}

// Canonical display names for asset_type — trades coming in from the sheet
// have mixed casing (e.g. "IDX Equity" vs "idx_equity") which the old
// matrix split into separate rows, inflating the row count and showing
// duplicates to Jenson. Normalize for bucketing, pretty-print for display.
const ASSET_TYPE_CANON: Record<string, string> = {
  "idx equity": "IDX Equity",
  "us equity": "US Equity",
  "crypto": "Crypto",
  "crypto spot": "Crypto Spot",
  "crypto perp": "Crypto Perp",
  "bond": "Bond",
  "etf": "ETF",
  "option": "Option",
};

function normalizeKey(s: string | null): string {
  if (s == null) return "";
  return s.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
}

function prettyAssetType(raw: string | null): string {
  const norm = normalizeKey(raw);
  if (!norm) return "—";
  return ASSET_TYPE_CANON[norm] ?? (raw || "—");
}

function prettyStrategy(raw: string | null): string {
  if (raw == null || !raw.trim()) return "—";
  // Strategy is freeform; keep original casing but trim
  return raw.trim();
}

export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("trades")
    .select(
      "strategy,asset_type,result,rr_ratio,net_pnl_native,pnl_native,pnl_currency,fx_rate_to_idr,hold_time_hours,pnl_pct,book,exit_price,entry_price,position_size",
    )
    .eq("user_id", user.id)
    .not("exit_price", "is", null);

  // Ghost-row filter: a "real" closed trade has a non-zero entry and size.
  // Early sync runs occasionally wrote placeholder rows (Entry=0, Size=0)
  // that corrupted win-rate / expectancy aggregates.
  const trades = ((data || []) as Trade[]).filter(
    (t) => (t.entry_price ?? 0) > 0 && (t.position_size ?? 0) > 0,
  );

  const buckets = new Map<string, { display: { strategy: string; asset_type: string }; arr: Trade[] }>();
  for (const t of trades) {
    const normStrat = normalizeKey(t.strategy);
    const normAsset = normalizeKey(t.asset_type);
    const key = `${normStrat}||${normAsset}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        display: {
          strategy: prettyStrategy(t.strategy),
          asset_type: prettyAssetType(t.asset_type),
        },
        arr: [],
      });
    }
    buckets.get(key)!.arr.push(t);
  }

  const rows = [...buckets.values()].map(({ display, arr }) => {
    const wins = arr.filter((t) => t.result === "WIN");
    const losses = arr.filter((t) => t.result === "LOSS");
    const win_rate_pct = arr.length ? (wins.length / arr.length) * 100 : 0;

    const rrArr = arr.filter((t) => t.rr_ratio != null && isFinite(t.rr_ratio));
    const avg_rr = rrArr.length
      ? rrArr.reduce((a, t) => a + (t.rr_ratio || 0), 0) / rrArr.length
      : null;

    // Expectancy — only meaningful when we have realized %-pnl on both sides.
    // Old code defaulted pnl_pct to 0 when null, which made expectancy = 0
    // even with 100% win rate (all the pnl_pct fields were null, so
    // avg_win and avg_loss both came out as 0).
    const winsWithPct = wins.filter((t) => t.pnl_pct != null && isFinite(t.pnl_pct));
    const lossesWithPct = losses.filter((t) => t.pnl_pct != null && isFinite(t.pnl_pct));
    const avgWinPct = winsWithPct.length
      ? winsWithPct.reduce((a, t) => a + (t.pnl_pct || 0), 0) / winsWithPct.length
      : null;
    const avgLossPct = lossesWithPct.length
      ? lossesWithPct.reduce((a, t) => a + (t.pnl_pct || 0), 0) / lossesWithPct.length
      : null;

    // When a bucket has only wins (or only losses), use the known side and
    // treat the missing side as 0 — that's the honest expectancy you'd
    // realize if the pattern held. Only show null when neither side has
    // any pnl_pct data at all.
    let expectancy: number | null = null;
    if (avgWinPct != null || avgLossPct != null) {
      const w = avgWinPct ?? 0;
      const l = avgLossPct ?? 0;
      expectancy = (win_rate_pct / 100) * w + ((100 - win_rate_pct) / 100) * l;
    }

    const net_pnl_idr = arr.reduce(
      (a, t) =>
        a + toIdr(t.net_pnl_native ?? t.pnl_native ?? 0, t.pnl_currency, t.fx_rate_to_idr),
      0,
    );
    const holds = arr.filter((t) => t.hold_time_hours != null);
    const avg_hold_hours = holds.length
      ? holds.reduce((a, t) => a + (t.hold_time_hours || 0), 0) / holds.length
      : null;

    return {
      strategy: display.strategy,
      asset_type: display.asset_type,
      count: arr.length,
      win_rate_pct,
      avg_rr,
      expectancy,
      net_pnl_idr,
      avg_hold_hours,
    };
  });

  rows.sort((a, b) => b.net_pnl_idr - a.net_pnl_idr);
  return NextResponse.json({ rows });
}
