// Heuristic scorer: turns a news headline into a "hotness" score 0..100.
// Higher = more likely worth emailing. No ML — just curated keyword weights
// tuned for equities / crypto / macro.

import type { NewsItem } from "./feeds";

interface HotSignal {
  pattern: RegExp;
  score: number;
  reason: string;
}

// Base signals — additive, cap at 100.
const SIGNALS: HotSignal[] = [
  // Breaking / urgency markers
  { pattern: /\b(breaking|just in|urgent|flash)\b/i, score: 40, reason: "breaking" },
  { pattern: /\b(halts?|halted|suspend(ed|s)?) trading\b/i, score: 60, reason: "trading halt" },
  { pattern: /\b(crash|crashes|plummet|plunge|tumbl)/i, score: 35, reason: "crash/plunge" },
  { pattern: /\b(surge|soar|rallies|jumps|skyrocket)/i, score: 25, reason: "surge/rally" },
  { pattern: /\brecord (high|low)\b/i, score: 25, reason: "record move" },

  // M&A / corporate actions
  { pattern: /\b(acqui(re|sition|res)|takeover|buyout|merger)\b/i, score: 50, reason: "M&A" },
  { pattern: /\b(spin-?off|carve-?out|divest)/i, score: 30, reason: "corporate action" },
  { pattern: /\b(bankrupt|insolvenc|chapter 11|default)/i, score: 70, reason: "bankruptcy" },
  { pattern: /\b(delist|suspend(ed)? from trading)/i, score: 55, reason: "delisting" },

  // Ratings / analyst moves
  { pattern: /\b(upgrade[sd]?|downgrade[sd]?)\b/i, score: 20, reason: "rating change" },
  { pattern: /\bprice target\b/i, score: 15, reason: "target change" },

  // Earnings
  { pattern: /\bearnings (beat|miss|topped|fell short)/i, score: 30, reason: "earnings surprise" },
  { pattern: /\bguidance (cut|slash|lower|rais|boost|up)/i, score: 35, reason: "guidance revision" },
  { pattern: /\b(q[1-4]|quarterly) (beat|miss|results)/i, score: 20, reason: "quarterly results" },

  // Regulatory / legal
  { pattern: /\b(sec|fbi|doj|cftc|ojk) (probe|investigat|charge|sue|fine)/i, score: 55, reason: "regulatory action" },
  { pattern: /\b(fraud|lawsuit|class action|subpoena)/i, score: 45, reason: "legal issue" },
  { pattern: /\b(settles?|settlement)\b/i, score: 20, reason: "settlement" },

  // Macro / central banks
  { pattern: /\b(fed|fomc|ecb|boj|bi|pboc) (hike|cut|hold|raises?|lowers?|pauses?)/i, score: 40, reason: "central bank" },
  { pattern: /\b(cpi|ppi|nfp|payrolls|jobs report|gdp)/i, score: 25, reason: "macro data" },
  { pattern: /\brecession\b/i, score: 20, reason: "recession" },

  // Crypto / specific
  { pattern: /\b(hack|exploit|drained|stolen)/i, score: 55, reason: "hack/exploit" },
  { pattern: /\b(etf approval|etf filing|etf launch)/i, score: 40, reason: "ETF news" },
  { pattern: /\b(liquidat(ion|ed)|margin call)/i, score: 35, reason: "liquidation" },

  // Indonesia-specific
  { pattern: /\b(idx|ihsg|bei|rupiah|jkse)/i, score: 10, reason: "IDX context" },
  // Rights issue rumors — Jenson's alpha surface. Previously a bare "rights issue"
  // scored 30 (below 60 threshold) so rumors never fired. Split into:
  // - confirmed corporate action (tender/buyback/split) = 35
  // - rights issue anywhere in text = 50 (clears threshold solo)
  // - rights issue + rumor/plan/intend/disclose verbs = 75 (BREAKING bar)
  // - Bahasa variants ("rights issue", "penawaran umum terbatas", "HMETD", "PUT")
  { pattern: /\b(stock split|bonus (shares|issue)|buyback|tender offer)\b/i, score: 35, reason: "corp action" },
  { pattern: /\b(right[s]? issue|HMETD|penawaran umum terbatas|PUT\s?[IVX]+)\b/i, score: 50, reason: "rights issue" },
  { pattern: /\b(right[s]? issue|HMETD|penawaran umum terbatas)\b[\s\S]{0,80}\b(rumor|rumour|plan|mull|mulling|intend|weigh|weighs|weighing|consider|considering|prepar|explor|eye|eyes|eyeing|disclos|announce|approve|secure|completes?|complet(e|ed) the|fix(es|ed)? price|seek|seeks|seeking)/i, score: 75, reason: "rights issue rumor" },
  { pattern: /\b(rumor|rumour|whispers?)\b[\s\S]{0,60}\b(right[s]? issue|stock split|acqui|takeover|backdoor listing|injeksi)/i, score: 60, reason: "M&A/rights rumor" },
  { pattern: /\b(komisioner|direktur utama|dirut)\b/i, score: 30, reason: "IDX leadership" },

  // Index rebalance & structural catalysts — MSCI adds/removes force passive
  // flows into/out of IDX names overnight. Previously this scored ZERO, so the
  // classifier missed MSCI Indonesia announcements entirely.
  { pattern: /\bMSCI\b/i, score: 55, reason: "MSCI index event" },
  { pattern: /\b(index )?(inclusion|exclusion|addition|deletion|removal)\b.*\b(index|msci|ftse|lq45|idx30|jii|kompas100)/i, score: 65, reason: "index rebalance" },
  { pattern: /\b(lq45|lq ?45|idx30|idx ?30|jii\s?70?|kompas\s?100|idxbumn|idxhidiv|idxg30|idxsmallcap)\b/i, score: 45, reason: "IDX thematic index" },
  { pattern: /\b(quarterly review|semi-?annual review|index review|rebalanc(e|ing))\b/i, score: 40, reason: "index review" },
  { pattern: /\b(free[- ]?float|foreign ownership (limit|cap|rule)|float (adjustment|factor))\b/i, score: 35, reason: "float/foreign-ownership change" },
  { pattern: /\bftse (russell|indonesia|all[- ]world)\b/i, score: 45, reason: "FTSE index event" },
  { pattern: /\b(passive flow|etf rebalanc|benchmark (inclusion|add))\b/i, score: 40, reason: "passive flow trigger" },

  // IDX-specific structural signals (KBMI bank classification, OJK regulation)
  { pattern: /\bKBMI\s?[1-4]?\b/i, score: 40, reason: "KBMI bank tier" },
  { pattern: /\b(OJK|POJK)\b.*\b(issue[sd]?|publish|regulation|rule|probe|sanction)/i, score: 40, reason: "OJK regulatory" },
  { pattern: /\b(backdoor listing|reverse merger|injeksi|capital injection)\b/i, score: 45, reason: "structural catalyst" },
  { pattern: /\b(akuisisi|pengambilalihan|divestasi|penawaran tender)\b/i, score: 40, reason: "IDX corporate action (id)" },

  // Indonesia macro / BI / fiscal
  { pattern: /\bBI (7\s?-?Day|repo|rate)\b/i, score: 35, reason: "BI policy" },
  { pattern: /\b(USD\/IDR|IDR\/USD|rupiah)\b.*\b(record|all-time|crisis|intervention|breach|break(s|ing)? \d)/i, score: 40, reason: "IDR stress" },
  { pattern: /\b(foreign (outflow|inflow|selling|buying)|net foreign|foreign flow)\b/i, score: 30, reason: "foreign flows" },
  { pattern: /\b(sovereign (downgrade|upgrade|rating)|fitch|moodys|moody's|s&p).*\b(downgrade|upgrade|watch)/i, score: 55, reason: "sovereign rating" },

  // Dividends / capital returns (works for both USD and IDR wording)
  { pattern: /\bdividend (payout|hike|increase|cut|suspend|special|declared|announce)/i, score: 35, reason: "dividend" },
  { pattern: /\b(announces?|declares?) (a )?(special |interim |record )?dividend/i, score: 30, reason: "dividend" },

  // CEO / leadership
  { pattern: /\bceo (resign|step(s|ped) down|fired|ouster|replaced|departs?)/i, score: 50, reason: "CEO change" },

  // Profit warnings / going concern / strong results
  { pattern: /\bprofit warning\b/i, score: 45, reason: "profit warning" },
  { pattern: /\bgoing concern\b/i, score: 55, reason: "going concern" },
  { pattern: /\b(soars?|jumps?|surges?) \d+%/i, score: 15, reason: "quantified surge" },
];

const MIN_PERCENT_MOVE = /\b([1-9]\d|\d{3,})\s?%/; // 10% or more
const DOLLAR_BIG = /\$([1-9]\d{0,2}(?:\.\d+)?\s?(billion|trillion|b|t)\b)/i;
// Rp / IDR large figures (e.g. "Rp 15 trillion", "Rp 2T", "IDR 5 triliun")
const IDR_BIG = /\b(rp|idr)\s?[1-9]\d{0,2}(?:[.,]\d+)?\s?(triliun|trillion|billion|miliar|t|b)\b/i;

export interface Hotness {
  score: number;
  reasons: string[];
}

export function scoreHeadline(title: string, summary = ""): Hotness {
  const text = `${title} ${summary}`;
  let score = 0;
  const reasons: string[] = [];
  for (const sig of SIGNALS) {
    if (sig.pattern.test(text)) {
      score += sig.score;
      reasons.push(sig.reason);
    }
  }
  if (MIN_PERCENT_MOVE.test(title)) {
    score += 15;
    reasons.push("double-digit %");
  }
  if (DOLLAR_BIG.test(title)) {
    score += 10;
    reasons.push("large $ figure");
  }
  if (IDR_BIG.test(text)) {
    score += 15;
    reasons.push("large IDR figure");
  }
  if (score > 100) score = 100;
  return { score, reasons: Array.from(new Set(reasons)) };
}

export function isHot(item: NewsItem, minScore = 60): { hot: boolean; score: number; reasons: string[] } {
  const { score, reasons } = scoreHeadline(item.title, item.summary || "");
  return { hot: score >= minScore, score, reasons };
}
