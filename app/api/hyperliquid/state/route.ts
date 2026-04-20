import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClearinghouseState, getSpotClearinghouseState } from "@/lib/crypto/hyperliquid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();
  const { data } = await admin
    .from("user_settings")
    .select("hyperliquid_address")
    .eq("user_id", user.id)
    .maybeSingle();

  const address = data?.hyperliquid_address;
  if (!address) return NextResponse.json({ error: "no_address" }, { status: 400 });

  const [perp, spot] = await Promise.all([
    getClearinghouseState(address).catch(() => null),
    getSpotClearinghouseState(address).catch(() => null),
  ]);

  return NextResponse.json({ address, perp, spot, at: new Date().toISOString() });
}
