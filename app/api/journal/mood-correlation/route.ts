import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Trade {
  mood: number | null;
  net_pnl_native: number | null;
  pnl_native: number | null;
  pnl_currency: "IDR" | "USD";
  fx_rate_to_idr: number | null;
  pnl_pct: number | null;
  result: string | null;
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
    .select("mood,net_pnl_native,pnl_native,pnl_currency,fx_rate_to_idr,pnl_pct,result")
    .eq("user_id", user.id)
    .not("exit_price", "is", null)
    .not("mood", "is", null);

  const trades = (data || []) as Trade[];

  const points = trades.map((t) => ({
    mood: t.mood,
    pnl_idr: toIdr(t.net_pnl_native ?? t.pnl_native ?? 0, t.pnl_currency, t.fx_rate_to_idr),
    pnl_pct: t.pnl_pct,
    result: t.result,
  }));

  const buckets: Record<string, { range: string; count: number; wins: number; net_pnl_idr: number; avg_pct: number }> = {};
  const bucketDef = [
    { key: "1-3", range: "1-3 (Poor)", min: 1, max: 3 },
    { key: "4-6", range: "4-6 (Neutral)", min: 4, max: 6 },
    { key: "7-10", range: "7-10 (Good)", min: 7, max: 10 },
  ];
  for (const b of bucketDef) {
    const inB = trades.filter((t) => (t.mood ?? 0) >= b.min && (t.mood ?? 0) <= b.max);
    buckets[b.key] = {
      range: b.range,
      count: inB.length,
      wins: inB.filter((t) => t.result === "WIN").length,
      net_pnl_idr: inB.reduce(
        (a, t) => a + toIdr(t.net_pnl_native ?? t.pnl_native ?? 0, t.pnl_currency, t.fx_rate_to_idr),
        0,
      ),
      avg_pct: inB.length ? inB.reduce((a, t) => a + (t.pnl_pct || 0), 0) / inB.length : 0,
    };
  }
  const summary = Object.values(buckets).map((b) => ({
    ...b,
    win_rate_pct: b.count ? (b.wins / b.count) * 100 : 0,
  }));

  return NextResponse.json({ points, buckets: summary });
}
