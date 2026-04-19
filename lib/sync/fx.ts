import type { SupabaseClient } from "@supabase/supabase-js";

export async function getFxRates(
  dates: string[],
  from: string,
  to: string,
  supabase: SupabaseClient,
): Promise<Record<string, number>> {
  const uniqueDates = [...new Set(dates)].filter(Boolean);
  if (!uniqueDates.length) return {};

  const { data: existing } = await supabase
    .from("fx_snapshots")
    .select("snapshot_date, rate")
    .eq("base_currency", from)
    .eq("quote_currency", to)
    .in("snapshot_date", uniqueDates);

  const rates: Record<string, number> = {};
  existing?.forEach((r: { snapshot_date: string; rate: number }) => {
    rates[r.snapshot_date] = Number(r.rate);
  });

  const missing = uniqueDates.filter((d) => !(d in rates));
  for (const d of missing) {
    try {
      const resp = await fetch(`https://api.exchangerate.host/${d}?base=${from}&symbols=${to}`);
      const j = (await resp.json()) as { rates?: Record<string, number> };
      if (j?.rates?.[to]) {
        rates[d] = j.rates[to];
        await supabase.from("fx_snapshots").upsert({
          snapshot_date: d,
          base_currency: from,
          quote_currency: to,
          rate: j.rates[to],
        });
      }
    } catch (e) {
      console.error(`[fx] failed for ${d}:`, e);
    }
  }

  if (Object.keys(rates).length) {
    const sorted = Object.entries(rates).sort(([a], [b]) => a.localeCompare(b));
    const stillMissing = uniqueDates.filter((d) => !(d in rates));
    for (const md of stillMissing) {
      const prev = sorted.filter(([d]) => d < md).pop();
      if (prev) rates[md] = prev[1];
    }
  }

  return rates;
}

export async function getLatestFxRate(
  from: string,
  to: string,
  supabase: SupabaseClient,
): Promise<number | null> {
  const today = new Date().toISOString().slice(0, 10);
  const rates = await getFxRates([today], from, to, supabase);
  if (rates[today]) return rates[today];

  const { data } = await supabase
    .from("fx_snapshots")
    .select("rate")
    .eq("base_currency", from)
    .eq("quote_currency", to)
    .order("snapshot_date", { ascending: false })
    .limit(1);
  return data?.[0]?.rate ? Number(data[0].rate) : null;
}
