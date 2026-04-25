import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINKED_BOOKS = ["investing", "idx_trading", "crypto_trading", "firm"] as const;

const PostSchema = z.object({
  decided_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "decided_at must be YYYY-MM-DD"),
  decision: z.string().trim().min(1, "decision is required"),
  why: z.string().trim().min(1, "why is required"),
  expected_outcome: z.string().trim().min(1, "expected_outcome is required"),
  invalidation: z.string().trim().min(1, "invalidation is required"),
  linked_ticker: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v ?? null)),
  linked_book: z.enum(LINKED_BOOKS).optional().nullable(),
});

const MEMO_COLUMNS =
  "id, user_id, decided_at, decision, why, expected_outcome, invalidation, linked_ticker, linked_book, realized_outcome, realized_at, created_at, updated_at";

/**
 * Decision memos — pre-commitment journal entries Jenson writes before
 * sizing into a position.  Captures the thesis (why), the expected
 * outcome, and the invalidation criteria so the post-mortem
 * (realized_outcome) can be honest later.  Owner-only via RLS.
 */
export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("decision_memos")
    .select(MEMO_COLUMNS)
    .eq("user_id", user.id)
    .order("decided_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memos: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = PostSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first?.path?.join(".") || "body";
    return NextResponse.json(
      { error: `invalid_${field}: ${first?.message ?? "validation failed"}`, issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const {
    decided_at,
    decision,
    why,
    expected_outcome,
    invalidation,
    linked_ticker,
    linked_book,
  } = parsed.data;

  const { data, error } = await supabase
    .from("decision_memos")
    .insert({
      user_id: user.id,
      decided_at,
      decision: decision.trim(),
      why: why.trim(),
      expected_outcome: expected_outcome.trim(),
      invalidation: invalidation.trim(),
      linked_ticker: linked_ticker ?? null,
      linked_book: linked_book ?? null,
    })
    .select(MEMO_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memo: data }, { status: 201 });
}
