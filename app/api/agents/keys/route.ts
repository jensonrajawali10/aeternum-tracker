import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateAgentKey, hashAgentKey } from "@/lib/agents/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("agent_keys")
    .select("id, agent_slug, key_prefix, created_at, last_used_at, revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { agent_slug?: string } | null;
  if (!body?.agent_slug) {
    return NextResponse.json({ error: "missing_agent_slug" }, { status: 400 });
  }

  const { plain, prefix } = generateAgentKey();
  const hash = await hashAgentKey(plain);

  const admin = supabaseAdmin();
  // Revoke any existing key for this slug first (one live key per slug).
  await admin
    .from("agent_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("agent_slug", body.agent_slug)
    .is("revoked_at", null);

  const { data, error } = await admin
    .from("agent_keys")
    .insert({
      user_id: user.id,
      agent_slug: body.agent_slug,
      key_hash: hash,
      key_prefix: prefix,
    })
    .select("id, agent_slug, key_prefix, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ key: data, plaintext: plain });
}

export async function DELETE(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const { error } = await supabase
    .from("agent_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
