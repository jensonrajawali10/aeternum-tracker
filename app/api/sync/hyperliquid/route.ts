import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUserFills, fillToTrade, normalizeAddress } from "@/lib/crypto/hyperliquid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const addressInput = typeof body.address === "string" ? body.address : null;

  const admin = supabaseAdmin();

  let address: string | null = null;
  if (addressInput) {
    address = normalizeAddress(addressInput);
    if (!address) return NextResponse.json({ error: "invalid_address" }, { status: 400 });
    await admin
      .from("user_settings")
      .upsert(
        { user_id: user.id, hyperliquid_address: address, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
  } else {
    const { data } = await admin
      .from("user_settings")
      .select("hyperliquid_address")
      .eq("user_id", user.id)
      .maybeSingle();
    address = data?.hyperliquid_address ?? null;
  }
  if (!address) return NextResponse.json({ error: "no_address" }, { status: 400 });

  const fills = await getUserFills(address).catch((e) => {
    throw new Error(`hl_fetch_failed: ${e.message}`);
  });

  if (!fills.length) {
    await admin
      .from("user_settings")
      .update({ hyperliquid_last_sync_at: new Date().toISOString() })
      .eq("user_id", user.id);
    return NextResponse.json({ ok: true, synced: 0, address });
  }

  const rows = fills.map((f) => fillToTrade(f, user.id));
  const { error } = await admin
    .from("trades")
    .upsert(rows, { onConflict: "user_id,source_sheet_row_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const maxTid = fills.reduce((m, f) => (f.tid > m ? f.tid : m), 0);
  await admin
    .from("user_settings")
    .update({
      hyperliquid_last_sync_tid: maxTid,
      hyperliquid_last_sync_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true, synced: rows.length, address, last_tid: maxTid });
}

export async function GET() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();
  const { data } = await admin
    .from("user_settings")
    .select("hyperliquid_address, hyperliquid_last_sync_at, hyperliquid_last_sync_tid")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    address: data?.hyperliquid_address ?? null,
    last_sync_at: data?.hyperliquid_last_sync_at ?? null,
    last_sync_tid: data?.hyperliquid_last_sync_tid ?? null,
  });
}
