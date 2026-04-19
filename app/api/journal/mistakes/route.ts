import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Trade {
  mistakes: string | null;
  net_pnl_native: number | null;
  pnl_native: number | null;
  pnl_currency: "IDR" | "USD";
  fx_rate_to_idr: number | null;
}

function toIdr(v: number, ccy: string, fx: number | null): number {
  if (ccy === "IDR") return v;
  return v * (fx || 16500);
}

const PATTERNS: { label: string; rx: RegExp }[] = [
  { label: "Moved stop", rx: /(moved|shifted|widened)\s+stop|stop\s+(moved|wider)/i },
  { label: "No stop", rx: /(no|without|didn.?t\s+set)\s+stop|no.?sl/i },
  { label: "FOMO entry", rx: /fomo|chased|late\s+entry|chase/i },
  { label: "Oversized", rx: /over(sized?|position|leveraged)|size\s+too\s+big|too\s+big/i },
  { label: "Undersized", rx: /under(sized?|position)|too\s+small/i },
  { label: "Ignored invalidation", rx: /ignored.*(invalidation|thesis|stop)|thesis.*broken/i },
  { label: "Early exit", rx: /early\s+exit|exited\s+(too\s+)?early|cut\s+winner/i },
  { label: "Late exit", rx: /late\s+exit|held\s+too\s+long|rode\s+loser/i },
  { label: "Revenge trade", rx: /revenge/i },
  { label: "No plan", rx: /no\s+plan|unplanned|impulse|impulsive/i },
  { label: "Overtrading", rx: /overtrad|too\s+many\s+trades/i },
  { label: "Averaged down", rx: /averaged?\s+down|added\s+to\s+loser/i },
];

export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("trades")
    .select("mistakes,net_pnl_native,pnl_native,pnl_currency,fx_rate_to_idr")
    .eq("user_id", user.id)
    .not("mistakes", "is", null);

  const trades = (data || []) as Trade[];
  const agg = PATTERNS.map((p) => {
    const hits = trades.filter((t) => t.mistakes && p.rx.test(t.mistakes));
    const cost_idr = hits.reduce(
      (a, t) => a + Math.min(0, toIdr(t.net_pnl_native ?? t.pnl_native ?? 0, t.pnl_currency, t.fx_rate_to_idr)),
      0,
    );
    return { label: p.label, count: hits.length, cost_idr };
  })
    .filter((r) => r.count > 0)
    .sort((a, b) => a.cost_idr - b.cost_idr);

  return NextResponse.json({ mistakes: agg, total_trades_with_mistakes: trades.length });
}
