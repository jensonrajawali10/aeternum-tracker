import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { AlertType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: alerts } = await supabase
    .from("alerts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const { data: history } = await supabase
    .from("alert_history")
    .select("id, alert_id, trigger_value, message, triggered_at, notified_email, alerts!inner(ticker, alert_type)")
    .eq("user_id", user.id)
    .order("triggered_at", { ascending: false })
    .limit(20);
  const flatHistory = (history || []).map((h) => {
    const alert = (h as unknown as { alerts: { ticker: string | null; alert_type: string } }).alerts;
    return {
      id: h.id,
      alert_id: h.alert_id,
      ticker: alert?.ticker ?? null,
      value: h.trigger_value,
      message: h.message,
      triggered_at: h.triggered_at,
      notified_email: h.notified_email,
    };
  });
  return NextResponse.json({ alerts: alerts || [], history: flatHistory });
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    ticker?: string;
    alert_type?: AlertType;
    threshold?: number;
    notify_email?: boolean;
    notify_inapp?: boolean;
  } | null;
  if (!body?.alert_type || body.threshold == null)
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  const { data, error } = await supabase
    .from("alerts")
    .insert({
      user_id: user.id,
      ticker: body.ticker?.toUpperCase() ?? null,
      alert_type: body.alert_type,
      threshold: body.threshold,
      notify_email: body.notify_email ?? true,
      notify_inapp: body.notify_inapp ?? true,
      active: true,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alert: data });
}

export async function PATCH(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { id?: string; active?: boolean } | null;
  if (!body?.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const { error } = await supabase
    .from("alerts")
    .update({ active: body.active })
    .eq("id", body.id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const { error } = await supabase.from("alerts").delete().eq("user_id", user.id).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
