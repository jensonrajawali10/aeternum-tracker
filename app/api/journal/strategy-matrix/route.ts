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
}

function toIdr(v: number, ccy: string, fx: number | null): number {
  if (ccy === "IDR") return v;
  return v * (fx || 16500);
}

export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("trades")
    .select("strategy,asset_type,result,rr_ratio,net_pnl_native,pnl_native,pnl_currency,fx_rate_to_idr,hold_time_hours,pnl_pct,book,exit_price")
    .eq("user_id", user.id)
    .not("exit_price", "is", null);

  const trades = (data || []) as Trade[];

  const buckets = new Map<string, Trade[]>();
  for (const t of trades) {
    const key = `${t.strategy || "—"}||${t.asset_type || "—"}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(t);
  }

  const rows = [...buckets.entries()].map(([key, arr]) => {
    const [strategy, asset_type] = key.split("||");
    const wins = arr.filter((t) => t.result === "WIN");
    const losses = arr.filter((t) => t.result === "LOSS");
    const win_rate_pct = arr.length ? (wins.length / arr.length) * 100 : 0;
    const avg_rr = arr.reduce((a, t) => a + (t.rr_ratio || 0), 0) / Math.max(1, arr.filter((t) => t.rr_ratio).length);
    const avgWinPct = wins.length ? wins.reduce((a, t) => a + (t.pnl_pct || 0), 0) / wins.length : 0;
    const avgLossPct = losses.length ? losses.reduce((a, t) => a + (t.pnl_pct || 0), 0) / losses.length : 0;
    const expectancy = (win_rate_pct / 100) * avgWinPct + ((100 - win_rate_pct) / 100) * avgLossPct;
    const net_pnl_idr = arr.reduce(
      (a, t) => a + toIdr(t.net_pnl_native ?? t.pnl_native ?? 0, t.pnl_currency, t.fx_rate_to_idr),
      0,
    );
    const holds = arr.filter((t) => t.hold_time_hours != null);
    const avg_hold_hours = holds.length ? holds.reduce((a, t) => a + (t.hold_time_hours || 0), 0) / holds.length : null;
    return {
      strategy,
      asset_type,
      count: arr.length,
      win_rate_pct,
      avg_rr: arr.filter((t) => t.rr_ratio).length ? avg_rr : null,
      expectancy,
      net_pnl_idr,
      avg_hold_hours,
    };
  });

  rows.sort((a, b) => b.net_pnl_idr - a.net_pnl_idr);
  return NextResponse.json({ rows });
}
