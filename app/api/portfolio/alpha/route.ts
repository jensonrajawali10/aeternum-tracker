import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { rollingAlpha, computeAttribution } from "@/lib/analytics/alpha";
import type { BookFilter } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const bookFilter = (req.nextUrl.searchParams.get("book") || "all") as BookFilter;
  const window = Number(req.nextUrl.searchParams.get("window") || 30);

  const { data: navRows } = await supabase
    .from("nav_history")
    .select("snapshot_date, nav_idr")
    .eq("user_id", user.id)
    .eq("book", bookFilter === "all" ? "all" : bookFilter)
    .order("snapshot_date", { ascending: true });

  const { data: benchRows } = await supabase
    .from("benchmark_history")
    .select("snapshot_date, close, symbol")
    .in("symbol", ["^JKSE", "^GSPC"])
    .order("snapshot_date", { ascending: true });

  const portfolio = (navRows || []).map((r) => ({ date: r.snapshot_date, value: Number(r.nav_idr) }));
  const ihsg = (benchRows || [])
    .filter((r) => r.symbol === "^JKSE")
    .map((r) => ({ date: r.snapshot_date, value: Number(r.close) }));
  const spx = (benchRows || [])
    .filter((r) => r.symbol === "^GSPC")
    .map((r) => ({ date: r.snapshot_date, value: Number(r.close) }));

  const alphaIhsg = rollingAlpha(portfolio, ihsg, window);
  const alphaSpx = rollingAlpha(portfolio, spx, window);

  const year = new Date().getFullYear();
  const ytdStart = `${year}-01-01`;
  const attrIhsg = computeAttribution(portfolio, ihsg, ytdStart);
  const attrSpx = computeAttribution(portfolio, spx, ytdStart);

  return NextResponse.json({
    window,
    rolling: {
      vs_ihsg: alphaIhsg,
      vs_spx: alphaSpx,
    },
    attribution: {
      vs_ihsg: attrIhsg,
      vs_spx: attrSpx,
    },
  });
}
