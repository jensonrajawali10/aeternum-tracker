import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getTvNewsForSymbols, getTvNewsFeed } from "@/lib/news/tradingview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Aggregate feed: merges news for the user's open positions + watchlist,
// falling back to a category feed when they have no symbols yet.
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const category = (sp.get("category") || "markets") as
    | "markets"
    | "stock"
    | "crypto"
    | "economy";

  const [{ data: positions }, { data: watchlist }] = await Promise.all([
    supabase
      .from("v_open_positions")
      .select("ticker, asset_class")
      .eq("user_id", user.id),
    supabase
      .from("watchlist")
      .select("ticker, asset_class")
      .eq("user_id", user.id),
  ]);

  const pairs: { ticker: string; asset_class: string }[] = [];
  const seen = new Set<string>();
  for (const row of [...(positions || []), ...(watchlist || [])]) {
    const key = `${row.asset_class}:${row.ticker}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ ticker: row.ticker, asset_class: row.asset_class });
  }

  if (!pairs.length) {
    const items = await getTvNewsFeed(category, 40);
    return NextResponse.json({ items, fallback: "category" });
  }

  const items = await getTvNewsForSymbols(pairs.slice(0, 24), 5);
  return NextResponse.json({ items, symbols: pairs.length });
}
