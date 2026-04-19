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
  const severity = sp.get("severity");
  const ack = sp.get("acknowledged");
  const slug = sp.get("agent_slug");
  const limit = Math.min(200, Number(sp.get("limit") || 50));

  let q = supabase
    .from("agent_signals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (severity) q = q.eq("severity", severity);
  if (ack === "true" || ack === "false") q = q.eq("acknowledged", ack === "true");
  if (slug) q = q.eq("agent_slug", slug);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count: unack } = await supabase
    .from("agent_signals")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("acknowledged", false);

  return NextResponse.json({ signals: data || [], unacknowledged: unack || 0 });
}

export async function PATCH(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    id?: string;
    acknowledged?: boolean;
  } | null;
  if (!body?.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const { error } = await supabase
    .from("agent_signals")
    .update({ acknowledged: body.acknowledged ?? true })
    .eq("id", body.id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
