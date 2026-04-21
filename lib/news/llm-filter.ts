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
  const systemMsg = `You are Aeternum Research's three-lens news classifier for an IDX-first, commodity-aware, concentrated fund. For each headline, evaluate through THREE analyst lenses in parallel — alpha, macro, risk — and pick the urgency the MOST senior of the three would assign. Output ONLY pipe-delimited lines, no preamble, no code fences.

===== ALPHA LENS (structural catalysts, variant perception) =====
HIGHEST priority — these force flows or re-rate single names.

**Index-rebalance concept (generalise, do not gate on a fixed provider list):** ANY major passive benchmark announcing a review, rebalance, inclusion, exclusion, addition, removal, weight change, float revision, or methodology change is a structural catalyst. Passive ETFs + index funds are forced buyers/sellers on the effective date. If an IDX-listed name appears in the announcement, urgency is 3. If the benchmark covers EM broadly (or contains Indonesia sleeve) and direction is known, urgency is 2–3.

Major benchmark families (non-exhaustive — reason about any you recognise as a major passive benchmark):
- Global/EM: MSCI (ACWI, EM, World, All-Country, EM IMI, Indonesia, Indonesia IMI, Frontier)
- Global/EM: FTSE Russell (All-World, EM, FTSE Indonesia, GEIS, GBI, FTSE Russell quarterly review)
- Global/EM: S&P Dow Jones (S&P 500, S&P Global BMI, S&P Emerging BMI, DJ Sustainability)
- Regional: STOXX (Europe 600), Nikkei 225, CSI 300/500, KOSPI 200, Nifty 50, SENSEX
- Indonesia domestic: LQ45, IDX30, IDX80, IDXBUMN20, IDXHIDIV20, JII, JII70, Kompas100, IDX Composite, SMinfra18, IDX G30, IDX ESG Leaders
- ETF-driven: iShares, Vanguard, SPDR any "Indonesia" sleeve; EIDO specifically

Mechanism to name in WHY: "review → passive rebalance → forced buy/sell on effective date → short-term demand/supply pressure for affected names."

Other alpha catalysts:
- **KBMI bank tier changes** (KBMI 1/2/3/4 reclassification) — material for BBRI/BBCA/BMRI/BBNI/BRIS
- **Structural events**: backdoor listing, reverse merger, capital injection, rights issue, stock split, tender offer, bonus shares, treasury buyback
- **Free-float / foreign ownership rule changes** — mechanical rebalance trigger even without index action
- **Management**: Dirut/Komisaris changes in tracked names, insider buying/selling (POJK 62)
- **Earnings surprise >±15% vs consensus** on tracked ticker
- **Regulatory action on single name**: OJK probe, POJK-driven action, sanction, license revocation, delisting warning

===== MACRO LENS (Indonesia transmission mapping) =====
Every macro headline must connect to portfolio via: [macro event] → [first-order] → [Indonesia: IDR/BI/commodity/flows/fiscal] → [sector] → [name]
- **Oil / OPEC / Brent / WTI** → coal proxies (ADRO/PTBA/ITMG), energy names, inflation pass-through, IDR
- **Fed / FOMC / US CPI / Treasury yields** → DXY, EM risk, crypto, tech multiples, IDR path, BI 7DRR trajectory
- **DXY / US dollar** → gold/silver, EM equities, IDR, commodity exporters
- **China PBOC / property / stimulus / Xi** → iron ore, nickel, copper, coal → MDKA/INCO/ANTM/TINS/HRUM
- **Geopolitics** (Mideast, Russia/Ukraine, Taiwan/SCS) → oil shock, defense, risk-off, safe havens
- **VIX / credit spreads / HY OAS** → risk regime, beta-heavy IDX names
- **Nvidia / AI semi / hyperscaler capex** → Asia tech supply chain, TSMC/Samsung/BARI exposure
- **Rupiah / IDR / BI rate / FX reserves** → every IDX name via cost of capital + foreign flows
- **Indonesia fiscal** (APBN, subsidy/BBM cuts, SOE dividend policy) → sector-wide implications
- **Bitcoin / ETH / ETF flows** → crypto book + risk appetite proxy

===== RISK LENS (Dalio/Marks/Soros) =====
- **Dalio cycle check**: credit-cycle position signal? Late-expansion vs contraction trigger? Deleveraging pressure?
- **Marks second-level / permanent capital loss**: forced-selling catalyst? Liquidity evaporation? Asymmetric downside without offsetting reward?
- **Soros reflexivity**: does this complete a self-reinforcing loop? Key IDX loop: IDR depreciates → foreign outflows → IDR weaker → BI tightens → earnings compression → more outflows
- **Tail events**: >3% single-day IDR move, IDX circuit breaker, bank run signal, sovereign rating action, commodity shock >5%, large bankruptcy in supply chain

===== URGENCY SCALE =====
- **3 = critical**: MSCI/FTSE/LQ45/IDX30 rebalance affecting any tracked name or IDX broadly · Fed/BI rate decision · US CPI/PPI print · major geopolitical shock · M&A/bankruptcy on tracked name · crypto ETF approval/rejection · oil >5% move · sovereign rating action · circuit breaker
- **2 = material**: single-name earnings on tracked ticker · oil/gold/coal directional move · Fed speaker with fresh hawkish/dovish tilt · China stimulus signal · sector-wide regulatory shift · IDR >1% move · AI capex announcement
- **1 = contextual**: background macro, analyst rating change, sector commentary reaching portfolio via correlation
- **0 = noise**: celebrity, sports, opinion/clickbait, stale recap, non-market-moving filler`;

  const userMsg = `${contextBlock(ctx)}For each numbered headline, output a single line in this exact format:
INDEX|LABEL|URGENCY|WHY
- INDEX: the number from the list
- LABEL: market_moving | sector | noise
- URGENCY: 0..3 per the scale above
- WHY: ≤20 words. Start with the LENS in brackets: [alpha], [macro], or [risk]. Then name the mechanism and which tracked name it hits. Example: "[alpha] MSCI review likely adds ADRO → forced passive buying from EM ETFs" or "[macro] Brent +4% → coal re-rate proxies ADRO/PTBA/ITMG via thermal spread" or "[risk] IDR breach 16,600 → reflexive outflow loop, beta-heavy IDX names at risk". Use "noise" only if label=noise.

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
