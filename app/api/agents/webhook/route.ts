import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyAgentKey } from "@/lib/agents/keys";
import { sendEmail, signalEmailHtml } from "@/lib/email/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface KeyRow {
  id: string;
  user_id: string;
  agent_slug: string;
  key_hash: string;
  key_prefix: string;
  revoked_at: string | null;
}

interface Payload {
  severity?: "info" | "warning" | "critical";
  title?: string;
  headline?: string;     // accept both — agents tend to use one or the other
  body?: string;
  signal_type?: string;
  ticker?: string;
  metadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || !token.startsWith("ae_")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const prefix = token.slice(0, 10);

  const supabase = supabaseAdmin();
  const { data: candidates } = await supabase
    .from("agent_keys")
    .select("*")
    .eq("key_prefix", prefix)
    .is("revoked_at", null);

  let matched: KeyRow | null = null;
  for (const row of (candidates as KeyRow[]) || []) {
    if (await verifyAgentKey(token, row.key_hash)) {
      matched = row;
      break;
    }
  }
  if (!matched) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Payload | null;
  const title = body?.title || body?.headline;
  if (!title) {
    return NextResponse.json({ error: "missing_title" }, { status: 400 });
  }

  const severity = body?.severity || "info";
  const signalType = body?.signal_type || "note";
  const { data: signal, error } = await supabase
    .from("agent_signals")
    .insert({
      user_id: matched.user_id,
      agent_slug: matched.agent_slug,
      signal_type: signalType,
      severity,
      title,
      body: body?.body || null,
      ticker: body?.ticker || null,
      metadata: body?.metadata || body?.payload || null,
      acknowledged: false,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("agent_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", matched.id);

  if (severity === "critical") {
    const [{ data: userData }, { data: settings }] = await Promise.all([
      supabase.auth.admin.getUserById(matched.user_id),
      supabase
        .from("user_settings")
        .select("cc_emails")
        .eq("user_id", matched.user_id)
        .maybeSingle(),
    ]);
    const email = userData?.user?.email;
    const cc = ((settings?.cc_emails as string[] | null | undefined) || []).filter(Boolean);
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
    if (email) {
      await sendEmail({
        to: email,
        cc,
        subject: `Aeternum — [${severity.toUpperCase()}] ${title}`,
        html: signalEmailHtml({
          agent_slug: matched.agent_slug,
          severity,
          headline: title,
          body: body?.body || "",
          app_url: appUrl,
        }),
      });
    }
  }

  return NextResponse.json({ ok: true, signal_id: signal?.id });
}
