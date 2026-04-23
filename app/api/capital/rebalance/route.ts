import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOOKS = ["investing", "idx_trading", "crypto_trading"] as const;

const PostSchema = z.object({
  rationale: z.string().trim().min(3).max(2000),
  deltas: z.record(z.enum(BOOKS), z.number().finite()),
  target_snapshot: z
    .record(
      z.enum(BOOKS),
      z.object({
        target_pct: z.number(),
        actual_pct: z.number(),
        drift_pp: z.number(),
      }),
    )
    .optional(),
  applied: z.boolean().optional().default(false),
});

/**
 * Capital rebalance audit log — append-only record of dated decisions
 * Jenson takes against the firm mandate.  `deltas` stores signed IDR
 * amounts per arm (positive = add capital, negative = pull capital).
 * `target_snapshot` records the drift context at decision time so the
 * entry is legible later without stitching it back against nav_history.
 */
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || "10")));
  const { data, error } = await supabase
    .from("capital_rebalance_log")
    .select("id, decided_at, rationale, deltas, target_snapshot, applied, applied_at, created_at")
    .eq("user_id", user.id)
    .order("decided_at", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rebalances: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = PostSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { rationale, deltas, target_snapshot, applied } = parsed.data;

  const { data, error } = await supabase
    .from("capital_rebalance_log")
    .insert({
      user_id: user.id,
      rationale,
      deltas,
      target_snapshot: target_snapshot ?? null,
      applied,
      applied_at: applied ? new Date().toISOString() : null,
    })
    .select("id, decided_at, rationale, deltas, target_snapshot, applied")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rebalance: data });
}
