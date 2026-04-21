import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { BookFilter } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Range = "1M" | "3M" | "YTD" | "1Y" | "ALL";

function rangeStart(range: Range): string {
  const now = new Date();
  const y = now.getFullYear();
  if (range === "YTD") return `${y}-01-01`;
  const d = new Date(now);
  if (range === "1M") d.setMonth(d.getMonth() - 1);
  else if (range === "3M") d.setMonth(d.getMonth() - 3);
  else if (range === "1Y") d.setFullYear(d.getFullYear() - 1);
  else d.setFullYear(d.getFullYear() - 5);
  return d.toISOString().slice(0, 10);
}

/**
 * Rebase a possibly-sparse series to 100 on its first non-null/non-NaN/non-zero value.
 * Null, NaN, and 0 stay null (Chart.js skips them; 0 is treated as a missing sentinel
 * because a rebased 0 would anchor a division-by-zero and produce misleading infinities).
 */
function rebaseSparse(series: (number | null)[]): (number | null)[] {
  let base: number | null = null;
  for (const v of series) {
    if (v != null && isFinite(v) && v !== 0) {
      base = v;
      break;
    }
  }
  if (base == null) return series.map(() => null);
  return series.map((v) =>
    v == null || !isFinite(v) || v === 0 ? null : (v / base!) * 100,
  );
}

/**
 * Forward-fill a series of (number | null) so the line is continuous.
 * Used for IHSG / S&P where we want a dense curve across weekends & gaps.
 * Zero is treated as "no data" — a stale 0 mid-series would otherwise poison
 * the forward-fill and flatline subsequent rebased points.
 */
function forwardFill(series: (number | null)[]): (number | null)[] {
  const out = [...series];
  let last: number | null = null;
  for (let i = 0; i < out.length; i++) {
    const v = out[i];
    if (v != null && isFinite(v) && v !== 0) {
      last = v;
    } else if (last != null) {
      out[i] = last;
    }
    // else: leading null region — keep null so rebase skips it
  }
  return out;
}

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const range = (req.nextUrl.searchParams.get("range") || "YTD") as Range;
  const bookFilter = (req.nextUrl.searchParams.get("book") || "all") as BookFilter;
  const start = rangeStart(range);

  const [{ data: navRows }, { data: benchRows }] = await Promise.all([
    supabase
      .from("nav_history")
      .select("snapshot_date, nav_idr")
      .eq("user_id", user.id)
      .eq("book", bookFilter === "all" ? "all" : bookFilter)
      .gte("snapshot_date", start)
      .order("snapshot_date", { ascending: true }),
    supabase
      .from("benchmark_history")
      .select("snapshot_date, close, symbol")
      .in("symbol", ["^JKSE", "^GSPC"])
      .gte("snapshot_date", start)
      .order("snapshot_date", { ascending: true }),
  ]);

  // Benchmark data is dense — use it as the date spine
  const ihsgMap = new Map<string, number>();
  const spxMap = new Map<string, number>();
  const dateSet = new Set<string>();
  (benchRows || []).forEach((r) => {
    dateSet.add(r.snapshot_date);
    if (r.symbol === "^JKSE") ihsgMap.set(r.snapshot_date, Number(r.close));
    else if (r.symbol === "^GSPC") spxMap.set(r.snapshot_date, Number(r.close));
  });

  // Also include any NAV-only dates (shouldn't happen often but keeps alignment honest)
  const navMap = new Map<string, number>();
  (navRows || []).forEach((r) => {
    navMap.set(r.snapshot_date, Number(r.nav_idr));
    dateSet.add(r.snapshot_date);
  });

  const dates = Array.from(dateSet).sort();

  const ihsgRaw: (number | null)[] = dates.map((d) => ihsgMap.get(d) ?? null);
  const spxRaw: (number | null)[] = dates.map((d) => spxMap.get(d) ?? null);
  const navRaw: (number | null)[] = dates.map((d) => navMap.get(d) ?? null);

  const navEmpty = (navRows || []).length === 0;

  return NextResponse.json({
    range,
    dates,
    nav: rebaseSparse(navRaw),
    ihsg: rebaseSparse(forwardFill(ihsgRaw)),
    spx: rebaseSparse(forwardFill(spxRaw)),
    nav_empty: navEmpty,
  });
}
