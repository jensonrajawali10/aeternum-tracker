import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();
  const { data } = await admin
    .from("user_settings")
    .select("hot_news_email, hot_news_min_score, hot_news_last_run_at, cc_emails")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: recent } = await admin
    .from("news_alert_sent")
    .select("news_id, title, url, source, ticker, score, reasons, sent_at, email_ok")
    .eq("user_id", user.id)
    .order("sent_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    hot_news_email: data?.hot_news_email ?? true,
    hot_news_min_score: data?.hot_news_min_score ?? 60,
    hot_news_last_run_at: data?.hot_news_last_run_at ?? null,
    cc_emails: (data?.cc_emails as string[] | null) ?? [],
    recent: recent || [],
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeEmails(list: unknown): string[] | null {
  if (!Array.isArray(list)) return null;
  const cleaned = list
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && EMAIL_RE.test(s));
  // de-dup, cap at 20
  return Array.from(new Set(cleaned)).slice(0, 20);
}

export async function PATCH(req: NextRequest) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (typeof body.hot_news_email === "boolean") update.hot_news_email = body.hot_news_email;
  if (typeof body.hot_news_min_score === "number") {
    update.hot_news_min_score = Math.max(20, Math.min(100, Math.round(body.hot_news_min_score)));
  }
  if ("cc_emails" in body) {
    const clean = sanitizeEmails(body.cc_emails);
    if (clean === null) {
      return NextResponse.json({ error: "cc_emails must be an array of valid email strings" }, { status: 400 });
    }
    update.cc_emails = clean;
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ ok: true });

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("user_settings")
    .upsert({ user_id: user.id, ...update }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
