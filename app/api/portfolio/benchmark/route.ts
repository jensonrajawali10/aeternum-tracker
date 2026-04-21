import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { rebaseToHundred } from "@/lib/analytics/returns";
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

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const range = (req.nextUrl.searchParams.get("range") || "YTD") as Range;
  const bookFilter = (req.nextUrl.searchParams.get("book") || "all") as BookFilter;
  const start = rangeStart(range);

  const { data: navRows } = await supabase
    .from("nav_history")
    .select("snapshot_date, nav_idr")
    .eq("user_id", user.id)
    .eq("book", bookFilter === "all" ? "all" : bookFilter)
    .gte("snapshot_date", start)
    .order("snapshot_date", { ascending: true });

  const { data: benchRows } = await supabase
    .from("benchmark_history")
    .select("snapshot_date, close, symbol")
    .in("symbol", ["^JKSE", "^GSPC"])
    .gte("snapshot_date", start)
    .order("snapshot_date", { ascending: true });

  const ihsgMap = new Map<string, number>();
  const spxMap = new Map<string, number>();
  (benchRows || []).forEach((r) => {
    if (r.symbol === "^JKSE") ihsgMap.set(r.snapshot_date, Number(r.close));
    else if (r.symbol === "^GSPC") spxMap.set(r.snapshot_date, Number(r.close));
  });

  // If the user has NAV history, use those dates. If not, fall back to the
  // union of benchmark dates so the chart at least shows IHSG and S&P.
  let dates: string[];
  let navSeries: number[];
  let navEmpty = false;
  if ((navRows || []).length > 0) {
    dates = (navRows || []).map((r) => r.snapshot_date);
    navSeries = (navRows || []).map((r) => Number(r.nav_idr));
  } else {
    navEmpty = true;
    const all = new Set<string>();
    for (const d of ihsgMap.keys()) all.add(d);
    for (const d of spxMap.keys()) all.add(d);
    dates = Array.from(all).sort();
    navSeries = [];
  }

  const ihsgSeries = dates.map((d) => ihsgMap.get(d) ?? NaN);
  const spxSeries = dates.map((d) => spxMap.get(d) ?? NaN);

  return NextResponse.json({
    range,
    dates,
    nav: rebaseToHundred(navSeries),
    ihsg: rebaseToHundred(fillNaN(ihsgSeries)),
    spx: rebaseToHundred(fillNaN(spxSeries)),
    nav_empty: navEmpty,
  });
}

function fillNaN(series: number[]): number[] {
  const out = [...series];
  let last = out.find((v) => !isNaN(v)) ?? 0;
  for (let i = 0; i < out.length; i++) {
    if (isNaN(out[i])) out[i] = last;
    else last = out[i];
  }
  return out;
}
