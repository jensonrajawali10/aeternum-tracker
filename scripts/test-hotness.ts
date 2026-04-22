// Quick sanity check on the scoreHeadline rights-issue scoring boost.
// Run: pnpm tsx scripts/test-hotness.ts
import { scoreHeadline } from "../lib/news/hotness";

const cases: { title: string; expect: "hot" | "not" }[] = [
  { title: "PT Sumber Alfaria Trijaya (AMRT) mulls rights issue to fund expansion", expect: "hot" },
  { title: "GOTO considering rights issue, sources say", expect: "hot" },
  { title: "Rumor: BRMS plans HMETD to raise Rp 5 triliun", expect: "hot" },
  { title: "Bumi Resources Minerals announces penawaran umum terbatas for new mining projects", expect: "hot" },
  { title: "PUT II BBKP priced at Rp 150 per share", expect: "hot" },
  { title: "Indonesia banks weigh rights issue as capital rules tighten", expect: "hot" },
  { title: "TLKM completes share buyback programme", expect: "not" },
  { title: "Weekly jobs claims fall as expected", expect: "not" },
];
for (const c of cases) {
  const r = scoreHeadline(c.title);
  const actual = r.score >= 60 ? "hot" : "not";
  const status = actual === c.expect ? "PASS" : "FAIL";
  console.log(`[${status}] score=${r.score.toString().padStart(3)} reasons=[${r.reasons.join(", ")}]  ::  ${c.title}`);
}
