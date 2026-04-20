import type { SupabaseClient } from "@supabase/supabase-js";
import { yf } from "@/lib/prices/yahoo-client";

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

  if (missing.length) {
    const minDate = missing.reduce((a, b) => (a < b ? a : b));
    const maxDate = missing.reduce((a, b) => (a > b ? a : b));
    try {
      const sym = `${from.toUpperCase()}${to.toUpperCase()}=X`;
      const hist = await yf.historical(sym, {
        period1: minDate,
        period2: new Date(new Date(maxDate).getTime() + 86400_000),
        interval: "1d",
      });
      const toUpsert: { snapshot_date: string; base_currency: string; quote_currency: string; rate: number }[] = [];
      hist.forEach((h) => {
        if (h.close == null) return;
        const d = h.date.toISOString().slice(0, 10);
        rates[d] = Number(h.close);
        toUpsert.push({ snapshot_date: d, base_currency: from, quote_currency: to, rate: Number(h.close) });
      });
      if (toUpsert.length) {
        await supabase.from("fx_snapshots").upsert(toUpsert);
      }
    } catch (e) {
      console.error(`[fx] yahoo historical failed for ${from}/${to}, trying frankfurter:`, e);
      for (const d of missing) {
        if (d in rates) continue;
        try {
          const resp = await fetch(`https://api.frankfurter.app/${d}?from=${from}&to=${to}`);
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
        } catch (e2) {
          console.error(`[fx] frankfurter ${d} failed:`, e2);
        }
      }
    }
  }

  if (Object.keys(rates).length) {
    const sorted = Object.entries(rates).sort(([a], [b]) => a.localeCompare(b));
    const stillMissing = uniqueDates.filter((d) => !(d in rates));
    for (const md of stillMissing) {
      const prev = sorted.filter(([d]) => d < md).pop();
      if (prev) rates[md] = prev[1];
      else if (sorted.length) rates[md] = sorted[0][1];
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
