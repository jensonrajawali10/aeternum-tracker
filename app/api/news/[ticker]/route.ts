import { NextResponse, type NextRequest } from "next/server";
import { getNewsForSymbol } from "@/lib/news/feeds";
import type { AssetClass } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const sp = req.nextUrl.searchParams;
  const assetClass = (sp.get("asset_class") || "idx_equity") as AssetClass;
  const limit = Math.min(50, Number(sp.get("limit") || 30));

  const items = await getNewsForSymbol(ticker, assetClass, limit);
  return NextResponse.json({ ticker, asset_class: assetClass, items });
}
