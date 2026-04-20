// Perplexity chat-completions client for earnings intelligence.
// Uses the `sonar` online models so results include fresh web context.
//
// Docs: https://docs.perplexity.ai/reference/post_chat_completions

import type { AssetClass } from "@/lib/types";

const PPLX_BASE = "https://api.perplexity.ai";
const MODEL = "sonar";

export interface EarningsSummary {
  ticker: string;
  asset_class: AssetClass;
  next_earnings_date: string | null;   // ISO yyyy-mm-dd (best-effort)
  last_report_date: string | null;
  consensus: {
    eps: number | null;
    revenue: string | null;            // keep as string — currencies vary
  };
  recent_reported: {
    eps: number | null;
    revenue: string | null;
    surprise_pct: number | null;
  } | null;
  highlights: string[];                // 3-5 short bullets from the last call
  risks: string[];                     // 2-3 short bullets
  guidance: string | null;
  sources: { title: string; url: string }[];
  generated_at: number;
}

interface PplxMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface PplxCitation {
  url: string;
  title?: string;
}

interface PplxResponse {
  choices?: { message?: { content?: string } }[];
  citations?: (string | PplxCitation)[];
  search_results?: { url?: string; title?: string }[];
}

async function pplxChat(messages: PplxMessage[], jsonSchema?: Record<string, unknown>) {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error("PERPLEXITY_API_KEY not set");

  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
    temperature: 0.1,
    // Pull explicit, recent search context.
    web_search_options: { search_context_size: "medium" },
  };
  if (jsonSchema) {
    body.response_format = { type: "json_schema", json_schema: { schema: jsonSchema } };
  }

  const res = await fetch(`${PPLX_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`pplx_${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as PplxResponse;
}

function normalizeCitations(resp: PplxResponse): { title: string; url: string }[] {
  const items: { title: string; url: string }[] = [];
  const seen = new Set<string>();
  const push = (url: string, title?: string) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    items.push({ url, title: title || url });
  };
  for (const c of resp.citations || []) {
    if (typeof c === "string") push(c);
    else push(c.url, c.title);
  }
  for (const s of resp.search_results || []) {
    if (s.url) push(s.url, s.title);
  }
  return items.slice(0, 8);
}

const EARNINGS_SCHEMA = {
  type: "object",
  required: [
    "next_earnings_date",
    "last_report_date",
    "consensus",
    "recent_reported",
    "highlights",
    "risks",
    "guidance",
  ],
  properties: {
    next_earnings_date: { type: ["string", "null"] },
    last_report_date: { type: ["string", "null"] },
    consensus: {
      type: "object",
      required: ["eps", "revenue"],
      properties: {
        eps: { type: ["number", "null"] },
        revenue: { type: ["string", "null"] },
      },
    },
    recent_reported: {
      type: ["object", "null"],
      properties: {
        eps: { type: ["number", "null"] },
        revenue: { type: ["string", "null"] },
        surprise_pct: { type: ["number", "null"] },
      },
    },
    highlights: { type: "array", items: { type: "string" }, maxItems: 6 },
    risks: { type: "array", items: { type: "string" }, maxItems: 4 },
    guidance: { type: ["string", "null"] },
  },
};

function prompt(ticker: string, assetClass: AssetClass): string {
  const venue =
    assetClass === "idx_equity" ? "Indonesia Stock Exchange (IDX)" :
    assetClass === "us_equity" ? "US equity markets" :
    "the listed venue";
  return [
    `Research the most recent and upcoming earnings release for ${ticker} on ${venue}.`,
    "",
    "Return JSON only, matching the provided schema. Use ISO yyyy-mm-dd for dates. Use null when a field is unknown.",
    "",
    "For 'highlights' and 'risks', quote concrete numbers or management statements from the most recent earnings call where possible (not generic analyst commentary).",
    "",
    "Only consider releases, transcripts, filings, or analyst coverage from the last 120 days. If there is no recent call, return empty arrays and null fields rather than guessing.",
  ].join("\n");
}

export async function getEarningsSummary(
  ticker: string,
  assetClass: AssetClass,
): Promise<EarningsSummary> {
  const resp = await pplxChat(
    [
      {
        role: "system",
        content:
          "You are an equity analyst. Answer concisely and with numeric specificity. Return only JSON that matches the schema.",
      },
      { role: "user", content: prompt(ticker, assetClass) },
    ],
    EARNINGS_SCHEMA,
  );

  const raw = resp.choices?.[0]?.message?.content || "{}";
  let parsed: Partial<EarningsSummary> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Sonar occasionally wraps JSON in ```json fences despite response_format.
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) {
      try {
        parsed = JSON.parse(fenced[1]);
      } catch {
        parsed = {};
      }
    }
  }

  return {
    ticker,
    asset_class: assetClass,
    next_earnings_date: parsed.next_earnings_date ?? null,
    last_report_date: parsed.last_report_date ?? null,
    consensus: parsed.consensus ?? { eps: null, revenue: null },
    recent_reported: parsed.recent_reported ?? null,
    highlights: parsed.highlights ?? [],
    risks: parsed.risks ?? [],
    guidance: parsed.guidance ?? null,
    sources: normalizeCitations(resp),
    generated_at: Date.now(),
  };
}

export interface EarningsCalendarRow {
  ticker: string;
  company: string;
  date: string;                 // yyyy-mm-dd
  session: "pre" | "post" | "during" | "unknown";
  eps_consensus: number | null;
  revenue_consensus: string | null;
  asset_class?: AssetClass;
}

const CALENDAR_SCHEMA = {
  type: "object",
  required: ["rows"],
  properties: {
    rows: {
      type: "array",
      maxItems: 40,
      items: {
        type: "object",
        required: ["ticker", "company", "date", "session"],
        properties: {
          ticker: { type: "string" },
          company: { type: "string" },
          date: { type: "string" },
          session: { type: "string", enum: ["pre", "post", "during", "unknown"] },
          eps_consensus: { type: ["number", "null"] },
          revenue_consensus: { type: ["string", "null"] },
        },
      },
    },
  },
};

export async function getEarningsCalendar(
  tickers: { ticker: string; asset_class: AssetClass }[],
): Promise<EarningsCalendarRow[]> {
  if (!tickers.length) return [];
  const list = tickers
    .map((t) => `${t.ticker} (${t.asset_class === "idx_equity" ? "IDX" : "US"})`)
    .join(", ");
  const resp = await pplxChat(
    [
      {
        role: "system",
        content:
          "You track upcoming earnings. Return only JSON matching the schema. Dates must be ISO yyyy-mm-dd.",
      },
      {
        role: "user",
        content: [
          "For the following tickers, list each one's NEXT scheduled earnings release (within the next 90 days).",
          "If a ticker has no confirmed upcoming release, omit it — do not guess.",
          "",
          `Tickers: ${list}`,
        ].join("\n"),
      },
    ],
    CALENDAR_SCHEMA,
  );

  const raw = resp.choices?.[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(raw) as { rows?: EarningsCalendarRow[] };
    const rows = parsed.rows || [];
    // Attach asset_class from the input so the UI can click-through correctly.
    const classByTicker = new Map<string, AssetClass>();
    for (const t of tickers) classByTicker.set(t.ticker.toUpperCase(), t.asset_class);
    for (const row of rows) {
      if (!row.asset_class) row.asset_class = classByTicker.get(row.ticker.toUpperCase());
    }
    return rows;
  } catch {
    return [];
  }
}
