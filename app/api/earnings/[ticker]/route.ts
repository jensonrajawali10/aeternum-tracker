import { NextResponse, type NextRequest } from "next/server";
import { getEarningsSummary } from "@/lib/earnings/perplexity";
import type { AssetClass } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const sp = req.nextUrl.searchParams;
  const assetClass = (sp.get("asset_class") || "idx_equity") as AssetClass;

  if (!process.env.PERPLEXITY_API_KEY) {
    return NextResponse.json({ error: "PERPLEXITY_API_KEY not configured" }, { status: 503 });
  }
  try {
    const summary = await getEarningsSummary(ticker.toUpperCase(), assetClass);
    return NextResponse.json(summary);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
