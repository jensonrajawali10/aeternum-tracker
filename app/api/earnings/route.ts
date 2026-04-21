import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getEarningsCalendar } from "@/lib/earnings/yahoo";
import type { AssetClass } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const scope = sp.get("scope") || "all"; // all | positions | watchlist

  const [{ data: positions }, { data: watchlist }] = await Promise.all([
    scope === "watchlist"
      ? Promise.resolve({ data: [] })
      : supabase
          .from("v_open_positions")
          .select("ticker, asset_class")
          .eq("user_id", user.id),
    scope === "positions"
      ? Promise.resolve({ data: [] })
      : supabase
          .from("watchlist")
          .select("ticker, asset_class")
          .eq("user_id", user.id),
  ]);

  const seen = new Set<string>();
  const pairs: { ticker: string; asset_class: AssetClass }[] = [];
  for (const row of [...((positions as { ticker: string; asset_class: AssetClass }[]) || []),
                     ...((watchlist as { ticker: string; asset_class: AssetClass }[]) || [])]) {
    if (row.asset_class !== "idx_equity" && row.asset_class !== "us_equity") continue;
    const key = `${row.asset_class}:${row.ticker}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ ticker: row.ticker, asset_class: row.asset_class });
  }

  if (!pairs.length) return NextResponse.json({ rows: [] });

  try {
    const rows = await getEarningsCalendar(pairs.slice(0, 20));
    return NextResponse.json({ rows, source: "yahoo" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ rows: [], error: msg }, { status: 200 });
  }
}
