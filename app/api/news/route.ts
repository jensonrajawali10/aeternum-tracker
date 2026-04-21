import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getNewsForSymbols, getNewsFeed, type NewsCategory, type NewsItem } from "@/lib/news/feeds";
import { agentClassify, agentEnabled } from "@/lib/news/llm-filter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CATEGORIES: NewsCategory[] = ["markets", "stock", "crypto", "economy", "macro", "idx"];

function dedupe(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const it of items) {
    const key = it.id || it.url;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const reqCat = sp.get("category") || "all";
  const rawMode = reqCat === "all" ? "all" : CATEGORIES.includes(reqCat as NewsCategory) ? reqCat : "markets";
  const noAgent = sp.get("agent") === "0";
  const useAgent = !noAgent && agentEnabled();

  // "All" = merged coverage: per-position + macro + IDX + US market + crypto.
  // Agent filters down to what actually matters.
  if (rawMode === "all") {
    const [{ data: positions }, { data: watchlist }] = await Promise.all([
      supabase.from("v_open_positions").select("ticker, asset_class").eq("user_id", user.id),
      supabase.from("watchlist").select("ticker, asset_class").eq("user_id", user.id),
    ]);
    const pairs: { ticker: string; asset_class: string }[] = [];
    const seenT = new Set<string>();
    for (const row of [...(positions || []), ...(watchlist || [])]) {
      const key = `${row.asset_class}:${row.ticker}`;
      if (seenT.has(key)) continue;
      seenT.add(key);
      pairs.push({ ticker: row.ticker, asset_class: row.asset_class });
    }

    const ctx = {
      tickers: pairs.map((p) => p.ticker),
      asset_classes: Array.from(new Set(pairs.map((p) => p.asset_class))),
    };

    const [symbolNews, macro, idx, markets, crypto] = await Promise.all([
      pairs.length ? getNewsForSymbols(pairs.slice(0, 20), 4) : Promise.resolve([] as NewsItem[]),
      getNewsFeed("macro", 25).catch(() => []),
      getNewsFeed("idx", 20).catch(() => []),
      getNewsFeed("markets", 15).catch(() => []),
      getNewsFeed("crypto", 15).catch(() => []),
    ]);

    const merged = dedupe([...symbolNews, ...macro, ...idx, ...markets, ...crypto]);
    // Classify up to 40 items with the agent, pre-sort by recency for budget reasons.
    merged.sort((a, b) => b.published - a.published);
    const classified = useAgent ? await agentClassify(merged.slice(0, 40), 40, ctx) : merged;
    const rest = merged.slice(40);
    const all = [...classified, ...rest];
    // Rank: urgency DESC, then score DESC, then recency DESC.
    all.sort((a, b) => {
      const du = (b.urgency ?? 0) - (a.urgency ?? 0);
      if (du !== 0) return du;
      const ds = (b.score ?? 0) - (a.score ?? 0);
      if (ds !== 0) return ds;
      return b.published - a.published;
    });

    return NextResponse.json({
      items: all.slice(0, 80),
      category: "all",
      agent: useAgent,
      symbols: pairs.length,
    });
  }

  const category: NewsCategory = rawMode as NewsCategory;
  const topicOnly = category === "macro" || category === "idx" || category === "economy";

  // Always build portfolio context so the agent can reason about correlations
  // (oil → coal, Fed → crypto/EM, China → metals, etc.) against actual holdings.
  const [{ data: ctxPositions }, { data: ctxWatchlist }] = await Promise.all([
    supabase.from("v_open_positions").select("ticker, asset_class").eq("user_id", user.id),
    supabase.from("watchlist").select("ticker, asset_class").eq("user_id", user.id),
  ]);
  const ctxPairs: { ticker: string; asset_class: string }[] = [];
  const ctxSeen = new Set<string>();
  for (const row of [...(ctxPositions || []), ...(ctxWatchlist || [])]) {
    const key = `${row.asset_class}:${row.ticker}`;
    if (ctxSeen.has(key)) continue;
    ctxSeen.add(key);
    ctxPairs.push({ ticker: row.ticker, asset_class: row.asset_class });
  }
  const ctx = {
    tickers: ctxPairs.map((p) => p.ticker),
    asset_classes: Array.from(new Set(ctxPairs.map((p) => p.asset_class))),
  };

  if (topicOnly) {
    const items = await getNewsFeed(category, 40);
    const enriched = useAgent ? await agentClassify(items, 25, ctx) : items;
    return NextResponse.json({ items: enriched, fallback: "category", agent: useAgent, category });
  }

  if (!ctxPairs.length) {
    const items = await getNewsFeed(category, 40);
    const enriched = useAgent ? await agentClassify(items, 25, ctx) : items;
    return NextResponse.json({ items: enriched, fallback: "category", agent: useAgent, category });
  }

  const items = await getNewsForSymbols(ctxPairs.slice(0, 24), 5);
  if (items.length === 0) {
    const fallback = await getNewsFeed(category, 40);
    const enriched = useAgent ? await agentClassify(fallback, 25, ctx) : fallback;
    return NextResponse.json({ items: enriched, fallback: "category", symbols: ctxPairs.length, agent: useAgent, category });
  }
  const enriched = useAgent ? await agentClassify(items, 25, ctx) : items;
  return NextResponse.json({ items: enriched, symbols: ctxPairs.length, agent: useAgent, category });
}
