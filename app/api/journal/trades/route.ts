import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const book = sp.get("book");
  const result = sp.get("result");
  const limit = Math.min(1000, Number(sp.get("limit") || 500));

  let q = supabase.from("trades").select("*").eq("user_id", user.id).order("trade_date", { ascending: false }).limit(limit);
  if (book && book !== "all") q = q.eq("book", book);
  if (result && result !== "ALL") q = q.eq("result", result);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trades: data || [] });
}
