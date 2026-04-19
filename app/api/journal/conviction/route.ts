import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Trade {
  conviction: string | null;
  confidence: string | null;
  rr_ratio: number | null;
  pnl_pct: number | null;
  result: string | null;
}

function bucketConviction(v: string | null): "HIGH" | "MED" | "LOW" | "UNKNOWN" {
  if (!v) return "UNKNOWN";
  const s = v.toLowerCase();
  if (/high|strong|5|conviction|10/.test(s)) return "HIGH";
  if (/low|weak|1|2|speculative/.test(s)) return "LOW";
  if (/med|moderate|3|average/.test(s)) return "MED";
  const n = Number(s.match(/\d+/)?.[0]);
  if (!isNaN(n)) {
    if (n >= 4) return "HIGH";
    if (n >= 2) return "MED";
    return "LOW";
  }
  return "UNKNOWN";
}

export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("trades")
    .select("conviction,confidence,rr_ratio,pnl_pct,result")
    .eq("user_id", user.id)
    .not("exit_price", "is", null);

  const trades = (data || []) as Trade[];

  const points = trades.map((t) => ({
    bucket: bucketConviction(t.conviction || t.confidence),
    realized_r: t.rr_ratio,
    pnl_pct: t.pnl_pct,
    result: t.result,
  }));

  const buckets = ["HIGH", "MED", "LOW"].map((k) => {
    const arr = points.filter((p) => p.bucket === k);
    const wins = arr.filter((p) => p.result === "WIN").length;
    const avgR = arr.filter((p) => p.realized_r != null).reduce((a, p) => a + (p.realized_r || 0), 0) /
      Math.max(1, arr.filter((p) => p.realized_r != null).length);
    const avgPct = arr.length ? arr.reduce((a, p) => a + (p.pnl_pct || 0), 0) / arr.length : 0;
    return {
      bucket: k,
      count: arr.length,
      win_rate_pct: arr.length ? (wins / arr.length) * 100 : 0,
      avg_realized_r: arr.filter((p) => p.realized_r != null).length ? avgR : null,
      avg_pnl_pct: avgPct,
    };
  });

  return NextResponse.json({ points, buckets });
}
