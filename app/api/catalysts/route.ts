import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_TYPES = [
  "kbmi_change",
  "rights_issue",
  "backdoor_listing",
  "compliance",
  "rups",
  "dividend_ex",
  "earnings",
  "regulatory",
  "macro",
  "other",
] as const;

const SEVERITIES = ["info", "watch", "breach"] as const;
const BOOKS = ["investing", "idx_trading", "crypto_trading", "firm"] as const;

const PostSchema = z.object({
  ticker: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .optional()
    .nullable()
    .transform((v) => (v == null || v === "" ? null : v.toUpperCase())),
  event_type: z.enum(EVENT_TYPES),
  event_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "event_date must be YYYY-MM-DD"),
  severity: z.enum(SEVERITIES).default("watch"),
  title: z.string().trim().min(1, "title is required").max(240),
  notes: z.string().trim().min(1).optional().nullable(),
  source_url: z.string().trim().url().optional().nullable(),
  linked_book: z.enum(BOOKS).optional().nullable(),
});

const PatchSchema = z
  .object({
    ticker: z
      .string()
      .trim()
      .max(20)
      .optional()
      .nullable()
      .transform((v) => (v == null ? v : v === "" ? null : v.toUpperCase())),
    event_type: z.enum(EVENT_TYPES).optional(),
    event_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    severity: z.enum(SEVERITIES).optional(),
    title: z.string().trim().min(1).max(240).optional(),
    notes: z.string().trim().optional().nullable(),
    source_url: z.string().trim().url().optional().nullable(),
    linked_book: z.enum(BOOKS).optional().nullable(),
    confirmed_at: z.string().datetime({ offset: true }).optional().nullable(),
    outcome_notes: z.string().trim().optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "no_fields_to_update" });

const COLUMNS =
  "id, user_id, ticker, event_type, event_date, severity, title, notes, source_url, linked_book, alert_sent_at, confirmed_at, outcome_notes, created_at, updated_at";

/**
 * Catalysts ledger — IDX-first structural events that drive position
 * decisions.  GET supports filters on ticker, severity, event_type,
 * window (?from=YYYY-MM-DD&to=YYYY-MM-DD), and an upcoming-only flag.
 */
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  let q = supabase
    .from("catalysts")
    .select(COLUMNS)
    .eq("user_id", user.id)
    .order("event_date", { ascending: true })
    .order("created_at", { ascending: true });

  const ticker = sp.get("ticker");
  if (ticker) q = q.eq("ticker", ticker.toUpperCase());

  const sev = sp.get("severity");
  if (sev && (SEVERITIES as readonly string[]).includes(sev)) q = q.eq("severity", sev);

  const evType = sp.get("event_type");
  if (evType && (EVENT_TYPES as readonly string[]).includes(evType)) {
    q = q.eq("event_type", evType);
  }

  const from = sp.get("from");
  if (from) q = q.gte("event_date", from);
  const to = sp.get("to");
  if (to) q = q.lte("event_date", to);

  if (sp.get("upcoming") === "1") {
    const today = new Date().toISOString().slice(0, 10);
    q = q.gte("event_date", today);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ catalysts: data || [] });
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

  const {
    ticker,
    event_type,
    event_date,
    severity,
    title,
    notes,
    source_url,
    linked_book,
  } = parsed.data;

  const { data, error } = await supabase
    .from("catalysts")
    .insert({
      user_id: user.id,
      ticker: ticker ?? null,
      event_type,
      event_date,
      severity,
      title,
      notes: notes ?? null,
      source_url: source_url ?? null,
      linked_book: linked_book ?? null,
    })
    .select(COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ catalyst: data }, { status: 201 });
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
    .from("catalysts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = { ...parsed.data };
  // null-coalesce string fields the schema doesn't auto-shape
  for (const k of ["notes", "source_url", "outcome_notes"]) {
    if (update[k] === "") update[k] = null;
  }

  const { data, error } = await supabase
    .from("catalysts")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ catalyst: data });
}
