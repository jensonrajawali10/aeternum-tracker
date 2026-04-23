import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { BOOKS as BOOK_META } from "@/lib/books/meta";
import type { BookType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DriftStatus = "on_target" | "drifting" | "rebalance";

interface AllocationRow {
  slug: string;           // url slug (investing / idx-trading / crypto-trading)
  book: BookType;         // db enum (investing / idx_trading / crypto_trading)
  title: string;
  pm: string;
  target_pct: number;
  actual_nav_idr: number;
  actual_pct: number;
  drift_pp: number;       // percentage points off target (actual - target)
  status: DriftStatus;
}

interface AllocationResp {
  firm_nav_idr: number;
  firm_nav_usd: number;
  usd_idr: number;
  rows: AllocationRow[];
  tolerance_pp: number;   // band within which we call it on-target
  rebalance_pp: number;   // threshold beyond which we call it rebalance
  last_rebalance_at: string | null;
}

/**
 * Firm-level capital allocation snapshot — target % (from books/meta)
 * vs. actual % (from latest nav_history per book).  Drift per arm plus
 * a three-colour status:
 *
 *   on_target   |drift| <= 2pp
 *   drifting    2pp < |drift| <= 5pp   (amber)
 *   rebalance   |drift| >  5pp         (red)
 *
 * Uses the most recent nav_history row per book rather than recomputing
 * from positions so it stays consistent with the cockpit charts. The
 * daily-snapshot cron writes those rows nightly.
 */
export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const TOLERANCE_PP = 2;
  const REBALANCE_PP = 5;

  // Pull the last row per (user, book) from nav_history for the three live books + firm total
  const books: BookType[] = ["investing", "idx_trading", "crypto_trading"];
  const all: BookType[] = [...books, "other"];

  // Cheap approach: fetch last 30 days across the user, pick max-date per book in-memory.
  // nav_history has PK (user_id, book, snapshot_date) so this is a few dozen rows.
  const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const { data: navRows, error } = await supabase
    .from("nav_history")
    .select("book, snapshot_date, nav_idr")
    .eq("user_id", user.id)
    .in("book", [...all, "all"])
    .gte("snapshot_date", start)
    .order("snapshot_date", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const latestByBook = new Map<string, number>();
  for (const r of navRows || []) {
    const key = r.book as string;
    if (!latestByBook.has(key)) latestByBook.set(key, Number(r.nav_idr));
  }

  // FX — pull newest USD/IDR from fx_snapshots if available, fallback to sensible default
  const { data: fxRows } = await supabase
    .from("fx_snapshots")
    .select("rate_to_idr, snapshot_date")
    .eq("from_currency", "USD")
    .order("snapshot_date", { ascending: false })
    .limit(1);
  const usdIdr = fxRows?.[0]?.rate_to_idr ? Number(fxRows[0].rate_to_idr) : 16500;

  // Firm NAV: prefer the "all"-book snapshot if the cron writes one, else sum the three live books
  const firmFromAll = latestByBook.get("all");
  const firmFromSum = books.reduce((a, b) => a + (latestByBook.get(b) ?? 0), 0);
  const firmNav = firmFromAll && firmFromAll > 0 ? firmFromAll : firmFromSum;

  function statusFor(driftAbs: number): DriftStatus {
    if (driftAbs <= TOLERANCE_PP) return "on_target";
    if (driftAbs <= REBALANCE_PP) return "drifting";
    return "rebalance";
  }

  const rows: AllocationRow[] = Object.values(BOOK_META).map((meta) => {
    const actual_nav_idr = latestByBook.get(meta.book) ?? 0;
    const actual_pct = firmNav > 0 ? (actual_nav_idr / firmNav) * 100 : 0;
    const drift_pp = actual_pct - meta.risk_budget_pct;
    return {
      slug: meta.slug,
      book: meta.book,
      title: meta.title,
      pm: meta.pm,
      target_pct: meta.risk_budget_pct,
      actual_nav_idr,
      actual_pct,
      drift_pp,
      status: statusFor(Math.abs(drift_pp)),
    };
  });

  // Last rebalance — most recent dated entry in capital_rebalance_log.
  const { data: lastReb } = await supabase
    .from("capital_rebalance_log")
    .select("decided_at")
    .eq("user_id", user.id)
    .order("decided_at", { ascending: false })
    .limit(1);
  const last_rebalance_at: string | null = lastReb?.[0]?.decided_at ?? null;

  const resp: AllocationResp = {
    firm_nav_idr: firmNav,
    firm_nav_usd: firmNav / usdIdr,
    usd_idr: usdIdr,
    rows,
    tolerance_pp: TOLERANCE_PP,
    rebalance_pp: REBALANCE_PP,
    last_rebalance_at,
  };
  return NextResponse.json(resp);
}
