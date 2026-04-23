"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Save Trading + Holdings CSV URLs into user_settings.  Called from the
 * Settings panel "Save" button.  Cookie-auth only — user can only write their
 * own row.
 */
export async function saveSheetSources(form: FormData): Promise<{ ok: boolean; error?: string }> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const trading = (form.get("trading_url")?.toString() || "").trim();
  const holdings = (form.get("holdings_url")?.toString() || "").trim();

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("user_settings")
    .upsert(
      {
        user_id: user.id,
        sheet_trading_url: trading || null,
        sheet_holdings_url: holdings || null,
      },
      { onConflict: "user_id" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Trigger the sheets-pull endpoint on behalf of the logged-in user.  Uses the
 * same cookie session so /api/sync/sheets-pull restricts the sync to this user
 * only — no cron secret needed.
 */
export async function triggerSheetsPull(): Promise<{
  ok: boolean;
  error?: string;
  holdings_synced?: number;
  trading_synced?: number;
}> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  // Build absolute URL — server actions run server-side, we need to re-hit our
  // own HTTP endpoint to reuse its logic.  Read host from incoming request.
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  const url = `${proto}://${host}/api/sync/sheets-pull`;

  // Forward the user's cookies so the endpoint sees them as authenticated.
  const cookieHeader = (await cookies()).getAll().map((c) => `${c.name}=${c.value}`).join("; ");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: cookieHeader },
      body: "{}",
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error || `http ${res.status}` };
    }
    const r = json.results?.[0] || {};
    revalidatePath("/settings");
    return {
      ok: true,
      holdings_synced: r.holdings_synced ?? 0,
      trading_synced: r.trading_synced ?? 0,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
