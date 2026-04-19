import { NextResponse, type NextRequest } from "next/server";
import { getQuote } from "@/lib/prices";
import type { AssetClass } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { items?: { ticker: string; asset_class: AssetClass }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const items = body.items || [];
  const quotes = await Promise.all(
    items.map(async (it) => {
      const q = await getQuote(it.ticker, it.asset_class);
      return { ticker: it.ticker, asset_class: it.asset_class, quote: q };
    }),
  );
  return NextResponse.json({ quotes });
}
