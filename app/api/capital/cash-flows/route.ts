import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOOKS = ["investing", "idx_trading", "crypto_trading", "firm"] as const;
const FLOW_TYPES = [
  "contribution",
  "withdrawal",
  "dividend",
  "fee",
  "tax",
  "transfer",
] as const;

const PostSchema = z.object({
  book: z.enum(BOOKS),
  flow_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "flow_date must be YYYY-MM-DD"),
  flow_type: z.enum(FLOW_TYPES),
  // Sign-convention: positive = inflow (contribution/dividend), negative
  // = outflow (withdrawal/fee/tax).  We accept either sign and only sanity-
  // check that the magnitude is non-zero — a "0 IDR" cash flow is always
  // a data-entry mistake.
  amount_idr: z
    .number()
    .refine((v) => Number.isFinite(v) && v !== 0, {
      message: "amount_idr must be non-zero and finite",
    }),
  notes: z.string().trim().min(1).optional().nullable(),
});

const COLUMNS =
  "id, user_id, book, flow_date, flow_type, amount_idr, notes, created_at, updated_at";

/**
 * Cash-flows ledger — contributions, withdrawals, dividends, fees, taxes
 * tagged per-book.  Drives the TWR (time-weighted return) calc so YTD/MTD
 * numbers reflect investment performance, not capital movements.
 *
 * GET    -> list all flows for the user, optional book filter
 * POST   -> insert a new flow; returns the persisted row
 * DELETE -> ?id=<uuid>; deletes a single flow owned by the user
 *
 * Owner-only via RLS; the route adds an extra explicit user_id filter
 * on writes for defence in depth (RLS would block it anyway).
 */
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const book = req.nextUrl.searchParams.get("book");
  let q = supabase
    .from("cash_flows")
    .select(COLUMNS)
    .eq("user_id", user.id)
    .order("flow_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (book && (BOOKS as readonly string[]).includes(book)) {
    q = q.eq("book", book);
  }
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ flows: data || [] });
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
      {
        error: `invalid_${field}: ${first?.message ?? "validation failed"}`,
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const { book, flow_date, flow_type, amount_idr, notes } = parsed.data;
  const { data, error } = await supabase
    .from("cash_flows")
    .insert({
      user_id: user.id,
      book,
      flow_date,
      flow_type,
      amount_idr,
      notes: notes ?? null,
    })
    .select(COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ flow: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const { error } = await supabase
    .from("cash_flows")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
