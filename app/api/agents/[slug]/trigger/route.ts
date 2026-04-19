import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manual trigger stub — agents actually run in Claude Code locally.
// This records the invocation so the UI can show "last run" state.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase.from("agent_signals").insert({
    user_id: user.id,
    agent_slug: slug,
    signal_type: "manual_trigger",
    severity: "info",
    title: `Manually triggered ${slug}`,
    body: "Run the corresponding skill in Claude Code locally — this is a bookmark entry.",
    acknowledged: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
