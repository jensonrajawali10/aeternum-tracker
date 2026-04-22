import { NextResponse, type NextRequest } from "next/server";
import { getQuote } from "@/lib/prices";
import { supabaseServer } from "@/lib/supabase/server";
import type { AssetClass } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BATCH = 50;

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { items?: { ticker: string; asset_class: AssetClass }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const items = (body.items || []).slice(0, MAX_BATCH);
  const quotes = await Promise.all(
    items.map(async (it) => {
      const q = await getQuote(it.ticker, it.asset_class);
      return { ticker: it.ticker, asset_class: it.asset_class, quote: q };
    }),
  );
  return NextResponse.json({ quotes });
}
