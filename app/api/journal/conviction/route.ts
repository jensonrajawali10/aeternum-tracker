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
  const s = v.toLowerCase().trim();
  // Order matters: test most specific / "negative" signals first so that a
  // string like "low conviction" isn't captured by a loose HIGH pattern.
  // Also: "conviction" is just a column header word, not a signal — excluded.
  if (/\b(low|weak|speculative|thin)\b/.test(s)) return "LOW";
  if (/\b(med(ium)?|moderate|average|base[- ]?case)\b/.test(s)) return "MED";
  if (/\b(high|strong|very strong|conviction-?high|top[- ]?conviction)\b/.test(s)) return "HIGH";
  // Numeric fallback (1-10 scale). Do this last so it doesn't collide with
  // word tests above.
  const n = Number(s.match(/\d+/)?.[0]);
  if (!isNaN(n)) {
    if (n >= 7) return "HIGH";
    if (n >= 4) return "MED";
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
