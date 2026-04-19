import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Trade {
  strategy: string | null;
  result: "WIN" | "LOSS" | "BE" | "OPEN" | null;
  hold_time_hours: number | null;
}

export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("trades")
    .select("strategy,result,hold_time_hours")
    .eq("user_id", user.id)
    .not("hold_time_hours", "is", null)
    .not("exit_price", "is", null);

  const trades = (data || []) as Trade[];

  const buckets = [
    { label: "< 1h", min: 0, max: 1 },
    { label: "1-4h", min: 1, max: 4 },
    { label: "4-24h", min: 4, max: 24 },
    { label: "1-3d", min: 24, max: 72 },
    { label: "3-7d", min: 72, max: 168 },
    { label: "1-4w", min: 168, max: 672 },
    { label: "> 1mo", min: 672, max: Infinity },
  ];

  const rows = buckets.map((b) => {
    const inB = trades.filter((t) => (t.hold_time_hours || 0) >= b.min && (t.hold_time_hours || 0) < b.max);
    const wins = inB.filter((t) => t.result === "WIN").length;
    return {
      bucket: b.label,
      count: inB.length,
      wins,
      win_rate_pct: inB.length ? (wins / inB.length) * 100 : 0,
    };
  });

  return NextResponse.json({ rows });
}
