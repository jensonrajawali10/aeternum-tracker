import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getUserFills,
  getUserFillsByTime,
  fillToTrade,
  normalizeAddress,
  type HlFill,
} from "@/lib/crypto/hyperliquid";

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
  let lastSyncTid: number | null = null;
  let lastSyncAt: string | null = null;
  if (addressInput) {
    address = normalizeAddress(addressInput);
    if (!address) return NextResponse.json({ error: "invalid_address" }, { status: 400 });
    await admin
      .from("user_settings")
      .upsert(
        { user_id: user.id, hyperliquid_address: address, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    // Re-fetch to get any pre-existing cursor (user may have had a prior sync)
    const { data: after } = await admin
      .from("user_settings")
      .select("hyperliquid_last_sync_tid, hyperliquid_last_sync_at")
      .eq("user_id", user.id)
      .maybeSingle();
    lastSyncTid = after?.hyperliquid_last_sync_tid ?? null;
    lastSyncAt = after?.hyperliquid_last_sync_at ?? null;
  } else {
    const { data } = await admin
      .from("user_settings")
      .select("hyperliquid_address, hyperliquid_last_sync_tid, hyperliquid_last_sync_at")
      .eq("user_id", user.id)
      .maybeSingle();
    address = data?.hyperliquid_address ?? null;
    lastSyncTid = data?.hyperliquid_last_sync_tid ?? null;
    lastSyncAt = data?.hyperliquid_last_sync_at ?? null;
  }
  if (!address) return NextResponse.json({ error: "no_address" }, { status: 400 });

  // HL `userFills` returns only the 2,000 most recent fills. Active traders blow
  // through that cap fast, so older history silently drops. Use `userFillsByTime`
  // paginated backwards from the last known fill to cover the full range.
  const fills = await fetchFillsSince(address, lastSyncAt).catch((e) => {
    throw new Error(`hl_fetch_failed: ${e.message}`);
  });
  // Cursor-based filter: only rows newer than last_sync_tid (belt-and-braces).
  const newFills = lastSyncTid != null ? fills.filter((f) => f.tid > lastSyncTid!) : fills;

  if (!newFills.length) {
    await admin
      .from("user_settings")
      .update({ hyperliquid_last_sync_at: new Date().toISOString() })
      .eq("user_id", user.id);
    return NextResponse.json({ ok: true, synced: 0, address, scanned: fills.length });
  }

  const rows = newFills.map((f) => fillToTrade(f, user.id));
  const { error } = await admin
    .from("trades")
    .upsert(rows, { onConflict: "user_id,source_sheet_row_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const maxTid = newFills.reduce((m, f) => (f.tid > m ? f.tid : m), lastSyncTid ?? 0);
  await admin
    .from("user_settings")
    .update({
      hyperliquid_last_sync_tid: maxTid,
      hyperliquid_last_sync_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  return NextResponse.json({
    ok: true,
    synced: rows.length,
    scanned: fills.length,
    address,
    last_tid: maxTid,
  });
}

// Fetch fills from `sinceIso` forward. For a fresh sync (no cursor), pull the
// most recent 2000 via `userFills` (HL's default window) — still more than enough
// for first-time sync. For incremental sync, use `userFillsByTime` from last sync
// minus 6h buffer to catch any just-filled orders.
async function fetchFillsSince(address: string, sinceIso: string | null): Promise<HlFill[]> {
  if (!sinceIso) {
    return getUserFills(address);
  }
  const sinceMs = Date.parse(sinceIso);
  if (!Number.isFinite(sinceMs)) return getUserFills(address);
  const buffer = 6 * 60 * 60 * 1000; // 6h overlap window; upsert on tid dedupes
  const startMs = Math.max(sinceMs - buffer, 0);
  return getUserFillsByTime(address, startMs);
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
