// LLM-based news filter.
//
// Classifies headlines as market_moving / sector / noise, adds a short
// "why this matters", and adjusts urgency.
//
// Providers (tried in order, first key wins):
//   1. GROQ_API_KEY    → Llama 3.3 70B on Groq (free tier, ~400 tok/s)
//   2. GEMINI_API_KEY  → Gemini 1.5 Flash via Google AI Studio (free tier)
//   3. PERPLEXITY_API_KEY → sonar (fallback if user already has it wired)
//
// With none set, returns items unchanged and downstream heuristic takes over.
// Verdicts cached per news.id in memory for the function lifetime.

import type { NewsItem } from "./feeds";

const CACHE = new Map<string, AgentVerdict>();
const MAX_CACHE = 2000;

export interface AgentVerdict {
  id: string;
  label: "market_moving" | "sector" | "noise";
  urgency: 0 | 1 | 2 | 3;
  why: string;
}

function cachePut(id: string, v: AgentVerdict) {
  if (CACHE.size > MAX_CACHE) {
    const first = CACHE.keys().next().value;
    if (first) CACHE.delete(first);
  }
  CACHE.set(id, v);
}

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
            temperature: 0,
            max_tokens: 1200,
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(`groq_${res.status}: ${await res.text().catch(() => "")}`);
        const data = await res.json();
        return data?.choices?.[0]?.message?.content || "";
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
            generationConfig: { temperature: 0, maxOutputTokens: 1200 },
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(`gemini_${res.status}: ${await res.text().catch(() => "")}`);
        const data = await res.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
            temperature: 0,
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(`pplx_${res.status}: ${await res.text().catch(() => "")}`);
        const data = await res.json();
        return data?.choices?.[0]?.message?.content || "";
      },
    };
  }
  return null;
}

export function agentEnabled(): boolean {
  return pickProvider() !== null;
}

export interface PortfolioContext {
  tickers: string[]; // e.g. ["ADRO", "BBRI", "NVDA", "BTC"]
  asset_classes?: string[]; // e.g. ["idx_equity","us_equity","crypto"]
}

function contextBlock(ctx?: PortfolioContext): string {
  if (!ctx || !ctx.tickers.length) return "";
  const tick = ctx.tickers.slice(0, 30).join(", ");
  const cls = ctx.asset_classes?.length ? ` · classes: ${ctx.asset_classes.join(", ")}` : "";
  return `\nPortfolio holdings: ${tick}${cls}\n`;
}

export async function agentClassify(
  items: NewsItem[],
  max = 20,
  ctx?: PortfolioContext,
): Promise<NewsItem[]> {
  const provider = pickProvider();
  if (!provider) return items;

  const slice = items.slice(0, max);
  const uncached = slice.filter((i) => !CACHE.has(i.id));
  if (uncached.length === 0) return applyVerdicts(items);

  const lines = uncached.map((i, idx) => `${idx + 1}. [${i.source}] ${i.title}`).join("\n");
  const systemMsg = `You are a sell-side analyst filter for an IDX-first concentrated fund. News is inherently cross-sensitive — judge each headline by its transmission path into the portfolio, not just surface topic. Reason about correlations, then output ONLY pipe-delimited lines. No preamble, no code fences.

Transmission paths you must track:
- Oil/OPEC/WTI/Brent → coal proxies (ADRO/PTBA/ITMG), energy names, inflation, rupiah, EM FX
- Fed/FOMC/US CPI/Treasury yields → USD, crypto risk-on/off, bonds, IDR, BI policy path, tech multiples
- DXY/US dollar → gold, silver, EM equities broadly, Indonesian rupiah, commodity exporters
- China PBOC/property/stimulus/Xi → iron ore, nickel, copper, coal, IDX materials (MDKA/INCO/ANTM/TINS)
- Geopolitics (Middle East, Russia, Taiwan) → oil shock, defense, safe havens, risk-off flows
- Single-name IDX: earnings, dividend, M&A, rights issue, regulatory, POJK, OJK, KBMI
- VIX/credit spreads → risk regime, beta-heavy names
- Nvidia/AI semis → global tech beta, Asia tech supply chain
- Bitcoin/ETH/ETF flows → crypto names, risk appetite
- Rupiah/IDR/BI rate → every IDX name via cost of capital + foreign flows

Urgency scale:
- 3 = breaking: rate decision, CPI print, major geopolitical shock, IDX name M&A/ratings/regulatory action, crypto ETF approval, oil >5% move
- 2 = material: single-name earnings beat/miss of tracked ticker, oil/gold directional move, Fed speaker with new hawkish/dovish tilt, China stimulus signal
- 1 = contextual: background macro, analyst upgrades, sector commentary relevant via correlation
- 0 = noise: celebrity, sports, clickbait, opinion columns, stale recaps, non-market-moving filler`;

  const userMsg = `${contextBlock(ctx)}For each numbered headline, output a single line in this exact format:
INDEX|LABEL|URGENCY|WHY
- INDEX: the number from the list
- LABEL: market_moving | sector | noise
- URGENCY: 0..3 per the scale above
- WHY: <=14 words, plain English — name the transmission path (e.g. "oil up → coal proxies ADRO/PTBA via thermal pricing"). Use "noise" if label=noise.

Headlines:
${lines}`;

  let text = "";
  try {
    text = await provider.call(systemMsg, userMsg);
  } catch (e) {
    console.error("[agent-filter]", provider.name, "failed:", e);
    return items;
  }

  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(\d+)\s*\|\s*(market_moving|sector|noise)\s*\|\s*([0-3])\s*\|\s*(.+)$/i);
    if (!m) continue;
    const idx = parseInt(m[1], 10) - 1;
    const target = uncached[idx];
    if (!target) continue;
    const verdict: AgentVerdict = {
      id: target.id,
      label: m[2].toLowerCase() as AgentVerdict["label"],
      urgency: Math.max(0, Math.min(3, parseInt(m[3], 10))) as AgentVerdict["urgency"],
      why: m[4].trim().slice(0, 160),
    };
    cachePut(target.id, verdict);
  }

  return applyVerdicts(items);
}

function applyVerdicts(items: NewsItem[]): NewsItem[] {
  return items.map((i) => {
    const v = CACHE.get(i.id);
    if (!v) return i;
    return {
      ...i,
      urgency: v.urgency,
      reasons: [v.why, ...(i.reasons || [])].slice(0, 5),
      score: Math.max(i.score ?? 0, v.urgency * 25),
    };
  });
}

// Used by the hot-news cron: returns only items the agent flagged urgency>=2,
// or (when no LLM key) items scoring >= minScore from the heuristic.
export async function agentShortlist(
  items: NewsItem[],
  minHeuristic = 60,
  agentMinUrgency = 2,
  ctx?: PortfolioContext,
): Promise<NewsItem[]> {
  if (!agentEnabled()) return items.filter((i) => (i.score ?? 0) >= minHeuristic);

  // Pre-filter by heuristic to save tokens; agent only sees candidates.
  const candidates = items.filter((i) => (i.score ?? 0) >= Math.max(20, minHeuristic - 30));
  const reviewed = await agentClassify(candidates, 30, ctx);
  return reviewed.filter((i) => {
    const v = CACHE.get(i.id);
    if (v) return v.urgency >= agentMinUrgency && v.label !== "noise";
    return (i.score ?? 0) >= minHeuristic;
  });
}
