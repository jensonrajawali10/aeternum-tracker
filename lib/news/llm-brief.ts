// Session-recap narrative brief generator.
//
// Takes a small context blob (benchmark deltas + 5-8 top news headlines for the
// session window) and asks the LLM for a 3-4 sentence brief describing WHAT
// HAPPENED — the way a senior analyst would recap at day-end.
//
// Re-uses the provider chain from llm-filter.ts (Groq → Gemini → Perplexity).

type Provider = {
  name: string;
  call: (system: string, user: string) => Promise<string>;
};

function pickProvider(): Provider | null {
  if (process.env.GROQ_API_KEY) {
    return {
      name: "groq",
      call: async (system, user) => {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            temperature: 0.2,
            max_tokens: 400,
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(`groq_${res.status}: ${await res.text().catch(() => "")}`);
        const data = await res.json();
        return (data?.choices?.[0]?.message?.content || "").trim();
      },
    };
  }
  if (process.env.GEMINI_API_KEY) {
    return {
      name: "gemini",
      call: async (system, user) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(`gemini_${res.status}: ${await res.text().catch(() => "")}`);
        const data = await res.json();
        return (data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
      },
    };
  }
  if (process.env.PERPLEXITY_API_KEY) {
    return {
      name: "perplexity",
      call: async (system, user) => {
        const res = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "sonar",
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            temperature: 0.2,
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(`pplx_${res.status}: ${await res.text().catch(() => "")}`);
        const data = await res.json();
        return (data?.choices?.[0]?.message?.content || "").trim();
      },
    };
  }
  return null;
}

export interface SessionBriefInput {
  session_label: string; // "IDX Close" | "US Close"
  benchmarks: { name: string; close: number | null; day_pct: number | null; ccy: string }[];
  headlines: { title: string; source: string; ticker?: string | null; score: number }[];
}

/**
 * Returns a 3-4 sentence brief of the session. No markdown, plain prose.
 * Falls back to a deterministic one-liner if no LLM provider is configured.
 */
export async function sessionBrief(input: SessionBriefInput): Promise<string> {
  const provider = pickProvider();

  // Deterministic fallback: summarise benchmarks mechanically.
  const benchSummary = input.benchmarks
    .filter((b) => b.day_pct !== null && Number.isFinite(b.day_pct))
    .map((b) => {
      const sign = (b.day_pct as number) >= 0 ? "+" : "";
      return `${b.name} ${sign}${(b.day_pct as number).toFixed(2)}%`;
    })
    .join(", ");
  const fallback =
    `${input.session_label} snapshot: ${benchSummary || "benchmarks flat"}. ` +
    `${input.headlines.length} headlines cleared the hot-news filter this session.`;

  if (!provider) return fallback;

  const benchLines = input.benchmarks
    .map(
      (b) =>
        `${b.name}: ${b.close !== null ? b.close.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "n/a"} (${b.day_pct !== null && Number.isFinite(b.day_pct) ? (b.day_pct >= 0 ? "+" : "") + b.day_pct.toFixed(2) + "%" : "n/a"})`,
    )
    .join("\n");
  const headLines = input.headlines
    .slice(0, 10)
    .map((h, i) => `${i + 1}. [${h.source}]${h.ticker ? ` ${h.ticker}:` : ""} ${h.title}`)
    .join("\n");

  const system = `You are Aeternum Research's end-of-session briefer. You write a tight 3-4 sentence recap for the CIO of an IDX-first, commodity-aware, concentrated fund. Focus on WHAT HAPPENED and WHY IT MATTERS for IDX names + crypto + US mega-caps the fund tracks. Do NOT list individual headlines — synthesise. Never use markdown, bullets, or headers. Plain prose only. Never invent numbers not given. If benchmarks are flat and headlines are light, say so honestly. Always end with one implication or next-thing-to-watch.`;

  const user = `Session: ${input.session_label}

Benchmarks today:
${benchLines}

Top headlines flagged in the last 14h (already noise-filtered):
${headLines || "(none cleared the hot-news filter this session)"}

Write the brief in 3-4 sentences, plain prose.`;

  try {
    const text = await provider.call(system, user);
    // Strip any accidental markdown fences, collapse whitespace.
    const cleaned = text
      .replace(/```[a-z]*\n?/gi, "")
      .replace(/```/g, "")
      .replace(/^\s*[-*]\s*/gm, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length < 20) return fallback;
    return cleaned.slice(0, 900);
  } catch (e) {
    console.error("[llm-brief]", provider.name, "failed:", e);
    return fallback;
  }
}
