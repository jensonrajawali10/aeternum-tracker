import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINKED_BOOKS = ["investing", "idx_trading", "crypto_trading", "firm"] as const;

const PatchSchema = z
  .object({
    decided_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "decided_at must be YYYY-MM-DD")
      .optional(),
    decision: z.string().trim().min(1, "decision must not be empty").optional(),
    why: z.string().trim().min(1, "why must not be empty").optional(),
    expected_outcome: z
      .string()
      .trim()
      .min(1, "expected_outcome must not be empty")
      .optional(),
    invalidation: z.string().trim().min(1, "invalidation must not be empty").optional(),
    linked_ticker: z.string().trim().optional().nullable(),
    linked_book: z.enum(LINKED_BOOKS).optional().nullable(),
    realized_outcome: z.string().trim().optional().nullable(),
    realized_at: z
      .string()
      .datetime({ offset: true })
      .optional()
      .nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "no_fields_to_update" });

const MEMO_COLUMNS =
  "id, user_id, decided_at, decision, why, expected_outcome, invalidation, linked_ticker, linked_book, realized_outcome, realized_at, created_at, updated_at";

type MemoUpdate = {
  decided_at?: string;
  decision?: string;
  why?: string;
  expected_outcome?: string;
  invalidation?: string;
  linked_ticker?: string | null;
  linked_book?: (typeof LINKED_BOOKS)[number] | null;
  realized_outcome?: string | null;
  realized_at?: string | null;
};

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("decision_memos")
    .select(MEMO_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ memo: data });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first?.path?.join(".") || "body";
    return NextResponse.json(
      { error: `invalid_${field}: ${first?.message ?? "validation failed"}`, issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Build the patch from only the fields the caller actually sent — partial
  // updates must not blank out columns that weren't touched.
  const body = parsed.data;
  const update: MemoUpdate = {};
  if (body.decided_at !== undefined) update.decided_at = body.decided_at;
  if (body.decision !== undefined) update.decision = body.decision.trim();
  if (body.why !== undefined) update.why = body.why.trim();
  if (body.expected_outcome !== undefined)
    update.expected_outcome = body.expected_outcome.trim();
  if (body.invalidation !== undefined) update.invalidation = body.invalidation.trim();
  if (body.linked_ticker !== undefined) {
    const v = body.linked_ticker;
    update.linked_ticker = v == null || v === "" ? null : v;
  }
  if (body.linked_book !== undefined) update.linked_book = body.linked_book ?? null;

  // Special case: setting realized_outcome to a non-empty value also stamps
  // realized_at = now() unless the caller supplied one explicitly. Clearing
  // realized_outcome (null/empty) clears realized_at too unless overridden.
  if (body.realized_outcome !== undefined) {
    const ro = body.realized_outcome;
    if (ro == null || ro === "") {
      update.realized_outcome = null;
      if (body.realized_at === undefined) update.realized_at = null;
    } else {
      update.realized_outcome = ro;
      if (body.realized_at === undefined) update.realized_at = new Date().toISOString();
    }
  }
  if (body.realized_at !== undefined) update.realized_at = body.realized_at;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no_fields_to_update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("decision_memos")
    .update(update)
    .eq("id", id)
    .select(MEMO_COLUMNS)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ memo: data });
}
