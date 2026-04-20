import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { AssetClass, BookType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase
    .from("holdings")
    .select("*")
    .eq("user_id", user.id)
    .order("ticker", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    ticker?: string;
    asset_class?: AssetClass;
    book?: BookType;
    quantity?: number;
    avg_cost?: number;
    cost_currency?: string;
    notes?: string;
    opened_at?: string;
  } | null;
  if (!body?.ticker || !body?.asset_class || body.quantity == null || body.avg_cost == null) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("holdings")
    .upsert(
      {
        user_id: user.id,
        ticker: body.ticker.toUpperCase().trim(),
        asset_class: body.asset_class,
        book: body.book ?? "investing",
        quantity: body.quantity,
        avg_cost: body.avg_cost,
        cost_currency: (body.cost_currency ?? "USD").toUpperCase(),
        notes: body.notes ?? null,
        opened_at: body.opened_at ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,ticker,book" },
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const { error } = await supabase.from("holdings").delete().eq("user_id", user.id).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
