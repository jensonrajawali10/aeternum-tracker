import { NextResponse, type NextRequest } from "next/server";
import { getLiveFxRate } from "@/lib/prices/fx";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const from = (req.nextUrl.searchParams.get("from") || "USD").toUpperCase();
  const to = (req.nextUrl.searchParams.get("to") || "IDR").toUpperCase();
  const q = await getLiveFxRate(from, to);
  if (!q) return NextResponse.json({ error: "fx_unavailable" }, { status: 503 });
  return NextResponse.json({
    pair: q.pair,
    rate: q.rate,
    prev_close: q.prev_close,
    day_change_pct: q.day_change_pct,
    at: q.at,
  });
}
