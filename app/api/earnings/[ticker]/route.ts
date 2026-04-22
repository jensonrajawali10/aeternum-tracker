import { NextResponse, type NextRequest } from "next/server";
import { getEarningsSummary } from "@/lib/earnings/yahoo";
import { supabaseServer } from "@/lib/supabase/server";
import type { AssetClass } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { ticker } = await params;
  const sp = req.nextUrl.searchParams;
  const assetClass = (sp.get("asset_class") || "idx_equity") as AssetClass;

  try {
    const summary = await getEarningsSummary(ticker.toUpperCase(), assetClass);
    return NextResponse.json(summary);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
