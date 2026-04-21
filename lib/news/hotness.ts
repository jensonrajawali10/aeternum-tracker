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
  { pattern: /\b(right issue|rights issue|stock split|bonus (shares|issue)|buyback|tender offer)/i, score: 30, reason: "corp action" },
  { pattern: /\b(komisioner|direktur utama|dirut)\b/i, score: 30, reason: "IDX leadership" },

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
