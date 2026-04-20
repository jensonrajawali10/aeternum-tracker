import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getQuote } from "@/lib/prices";
import { sendEmail, alertEmailHtml } from "@/lib/email/resend";
import type { AlertType, AssetClass } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface AlertRow {
  id: string;
  user_id: string;
  ticker: string | null;
  alert_type: AlertType;
  threshold: number;
  notify_email: boolean;
  notify_inapp: boolean;
  active: boolean;
  last_triggered_at: string | null;
}

interface PositionRow {
  user_id: string;
  ticker: string;
  asset_class: AssetClass;
  position_size: number;
  avg_entry_price: number;
  fx_rate_to_idr: number | null;
}

interface NavRow {
  user_id: string;
  nav_idr: number;
  unrealized_pnl_idr: number;
}

// Re-trigger guard: don't spam the same alert more than once per 6h.
const RETRIGGER_MIN_MS = 6 * 60 * 60 * 1000;

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const now = Date.now();
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";

  const { data: alerts } = await supabase
    .from("alerts")
    .select("*")
    .eq("active", true);
  if (!alerts?.length) return NextResponse.json({ checked: 0, fired: 0 });

  const priceAlerts = alerts.filter(
    (a) => a.alert_type === "price_above" || a.alert_type === "price_below",
  ) as AlertRow[];
  const pnlAlerts = alerts.filter(
    (a) => a.alert_type === "pnl_pct" || a.alert_type === "pnl_abs",
  ) as AlertRow[];

  const priceByUserTicker = new Map<string, { price: number; assetClass: AssetClass }>();
  const userNav = new Map<string, { nav: number; pnl: number }>();

  // --- P&L alerts need user NAV ---
  const pnlUserIds = [...new Set(pnlAlerts.map((a) => a.user_id))];
  if (pnlUserIds.length) {
    const { data: navs } = await supabase
      .from("v_open_positions")
      .select("user_id, ticker, asset_class, position_size, avg_entry_price, fx_rate_to_idr")
      .in("user_id", pnlUserIds);
    const positionsByUser = new Map<string, PositionRow[]>();
    for (const p of (navs as PositionRow[]) || []) {
      if (!positionsByUser.has(p.user_id)) positionsByUser.set(p.user_id, []);
      positionsByUser.get(p.user_id)!.push(p);
    }
    for (const [uid, positions] of positionsByUser) {
      let nav = 0;
      let pnl = 0;
      await Promise.all(
        positions.map(async (p) => {
          const q = await getQuote(p.ticker, p.asset_class).catch(() => null);
          if (!q) return;
          const fx = p.fx_rate_to_idr ?? 1;
          const mv = q.price * p.position_size * fx;
          const cost = p.avg_entry_price * p.position_size * fx;
          nav += mv;
          pnl += mv - cost;
          priceByUserTicker.set(`${uid}:${p.ticker}`, {
            price: q.price,
            assetClass: p.asset_class,
          });
        }),
      );
      userNav.set(uid, { nav, pnl });
    }
  }

  // --- Price alerts: one getQuote per (ticker, asset_class) (use watchlist lookup) ---
  interface PriceTarget {
    alert: AlertRow;
    assetClass: AssetClass;
  }
  const priceTargets: PriceTarget[] = [];
  for (const a of priceAlerts) {
    if (!a.ticker) continue;
    // Resolve asset class via watchlist/positions for this user.
    const { data: wl } = await supabase
      .from("watchlist")
      .select("asset_class")
      .eq("user_id", a.user_id)
      .eq("ticker", a.ticker)
      .maybeSingle();
    let assetClass = wl?.asset_class as AssetClass | undefined;
    if (!assetClass) {
      const { data: pos } = await supabase
        .from("v_open_positions")
        .select("asset_class")
        .eq("user_id", a.user_id)
        .eq("ticker", a.ticker)
        .maybeSingle();
      assetClass = (pos?.asset_class as AssetClass | undefined) || "idx_equity";
    }
    priceTargets.push({ alert: a, assetClass });
  }

  let fired = 0;
  let emailed = 0;

  for (const { alert: a, assetClass } of priceTargets) {
    if (a.last_triggered_at && now - new Date(a.last_triggered_at).getTime() < RETRIGGER_MIN_MS) {
      continue;
    }
    const cacheKey = `${a.user_id}:${a.ticker}`;
    let price = priceByUserTicker.get(cacheKey)?.price;
    if (price == null) {
      const q = await getQuote(a.ticker!, assetClass).catch(() => null);
      if (!q) continue;
      price = q.price;
      priceByUserTicker.set(cacheKey, { price, assetClass });
    }

    const hit =
      (a.alert_type === "price_above" && price >= a.threshold) ||
      (a.alert_type === "price_below" && price <= a.threshold);
    if (!hit) continue;

    fired++;
    const msg =
      a.alert_type === "price_above"
        ? `${a.ticker} crossed above ${a.threshold}.`
        : `${a.ticker} dropped below ${a.threshold}.`;

    await recordFire(supabase, a, price, msg);

    if (a.notify_email) {
      const { email } = await resolveUserEmail(a.user_id);
      if (email) {
        const { ok } = await sendEmail({
          to: email,
          subject: `Aeternum — ${a.ticker} ${a.alert_type === "price_above" ? "≥" : "≤"} ${a.threshold}`,
          html: alertEmailHtml({
            ticker: a.ticker!,
            message: msg,
            current_value: String(price),
            threshold: String(a.threshold),
            app_url: appUrl,
          }),
        });
        if (ok) emailed++;
        // Update the history row we just inserted (latest for this alert).
        const { data: latestFire } = await supabase
          .from("alert_history")
          .select("id")
          .eq("alert_id", a.id)
          .order("triggered_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestFire?.id) {
          await supabase
            .from("alert_history")
            .update({ notified_email: ok })
            .eq("id", latestFire.id);
        }
      }
    }
  }

  for (const a of pnlAlerts) {
    if (a.last_triggered_at && now - new Date(a.last_triggered_at).getTime() < RETRIGGER_MIN_MS) {
      continue;
    }
    const nav = userNav.get(a.user_id);
    if (!nav) continue;
    const value = a.alert_type === "pnl_abs" ? nav.pnl : nav.nav > 0 ? (nav.pnl / nav.nav) * 100 : 0;
    const hit = value >= a.threshold;
    if (!hit) continue;

    fired++;
    const msg =
      a.alert_type === "pnl_pct"
        ? `Portfolio unrealized P&L reached ${value.toFixed(2)}% (threshold ${a.threshold}%).`
        : `Portfolio unrealized P&L reached IDR ${value.toFixed(0)} (threshold ${a.threshold}).`;
    await recordFire(supabase, a, value, msg);

    if (a.notify_email) {
      const { email } = await resolveUserEmail(a.user_id);
      if (email) {
        const { ok } = await sendEmail({
          to: email,
          subject: `Aeternum — Portfolio P&L threshold`,
          html: alertEmailHtml({
            ticker: "Portfolio",
            message: msg,
            current_value: value.toFixed(2),
            threshold: String(a.threshold),
            app_url: appUrl,
          }),
        });
        if (ok) emailed++;
      }
    }
  }

  return NextResponse.json({
    checked: alerts.length,
    fired,
    emailed,
  });
}

async function recordFire(
  supabase: ReturnType<typeof supabaseAdmin>,
  a: AlertRow,
  value: number,
  msg: string,
) {
  await supabase.from("alert_history").insert({
    alert_id: a.id,
    user_id: a.user_id,
    trigger_value: value,
    message: msg,
    notified_email: false,
  });
  await supabase
    .from("alerts")
    .update({ last_triggered_at: new Date().toISOString() })
    .eq("id", a.id);
}

async function resolveUserEmail(userId: string): Promise<{ email: string | null }> {
  const supabase = supabaseAdmin();
  const { data } = await supabase.auth.admin.getUserById(userId);
  return { email: data?.user?.email || null };
}
