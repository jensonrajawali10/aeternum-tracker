import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getClearinghouseState,
  getSpotClearinghouseState,
  getAllMids,
  getSpotMeta,
} from "@/lib/crypto/hyperliquid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STABLES = new Set(["USDC", "USDT", "USDE", "DAI", "FDUSD", "USDB"]);

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

  const [perp, spot, mids, spotMeta] = await Promise.all([
    getClearinghouseState(address).catch(() => null),
    getSpotClearinghouseState(address).catch(() => null),
    getAllMids().catch(() => ({} as Record<string, string>)),
    getSpotMeta().catch(() => null),
  ]);

  // Build spot balances with live USD value.
  const priceByCoin: Record<string, number> = {};
  if (spotMeta) {
    // Map spot pair names (e.g. "PURR/USDC") → base token name → mid price
    for (const u of spotMeta.universe) {
      const mid = mids[u.name];
      if (!mid) continue;
      const baseIdx = u.tokens[0];
      const base = spotMeta.tokens.find((t) => t.index === baseIdx);
      if (base) priceByCoin[base.name.toUpperCase()] = parseFloat(mid);
    }
  }

  let spotValueUsd = 0;
  const spotEnriched: { coin: string; total: number; hold: number; entryNtl: number; usdValue: number }[] = [];
  if (spot?.balances) {
    for (const b of spot.balances) {
      const total = parseFloat(b.total);
      if (total === 0) continue;
      const coin = b.coin.toUpperCase();
      let px = 0;
      if (STABLES.has(coin)) px = 1;
      else if (priceByCoin[coin]) px = priceByCoin[coin];
      else px = parseFloat(b.entryNtl) / (total || 1);
      const usdValue = total * px;
      spotValueUsd += usdValue;
      spotEnriched.push({
        coin,
        total,
        hold: parseFloat(b.hold),
        entryNtl: parseFloat(b.entryNtl),
        usdValue,
      });
    }
  }

  const perpAccountValue = perp ? parseFloat(perp.marginSummary.accountValue) : 0;
  const combinedAccountValue = perpAccountValue + spotValueUsd;

  return NextResponse.json({
    address,
    perp,
    spot: spot ? { balances: spotEnriched } : null,
    spot_value_usd: spotValueUsd,
    combined_account_value_usd: combinedAccountValue,
    at: new Date().toISOString(),
  });
}
