import { NextResponse, type NextRequest } from "next/server";
import { getQuote } from "@/lib/prices";
import { supabaseServer } from "@/lib/supabase/server";
import type { AssetClass } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  // Auth-gate even though this proxies public market data — prevents drive-by
  // DoS against our Yahoo/CoinGecko upstream quota.
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { ticker } = await params;
  const assetClass = (req.nextUrl.searchParams.get("asset_class") || "idx_equity") as AssetClass;
  const q = await getQuote(decodeURIComponent(ticker), assetClass);
  if (!q) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(q);
}
