export function numeric(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[,\s%]/g, ""));
  return isNaN(n) ? null : n;
}

export function parseDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return new Date(v).toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s.slice(0, 10);
}

export function parseHoldTime(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (!v) return null;
  const s = String(v).toLowerCase().trim();
  if (!s) return null;
  let hours = 0;
  const d = s.match(/(\d+(?:\.\d+)?)\s*d/); if (d) hours += parseFloat(d[1]) * 24;
  const h = s.match(/(\d+(?:\.\d+)?)\s*h/); if (h) hours += parseFloat(h[1]);
  const m = s.match(/(\d+(?:\.\d+)?)\s*m(?!o)/); if (m) hours += parseFloat(m[1]) / 60;
  if (hours > 0) return hours;
  const bare = Number(s);
  return isNaN(bare) ? null : bare;
}

export function parseDirection(v: unknown): "LONG" | "SHORT" {
  const s = String(v ?? "").toUpperCase().trim();
  return s === "SHORT" ? "SHORT" : "LONG";
}

export function parseResult(v: unknown, exitPrice: unknown): "WIN" | "LOSS" | "BE" | "OPEN" | null {
  const s = String(v ?? "").toUpperCase().trim();
  if (["WIN", "LOSS", "BE", "OPEN"].includes(s)) return s as never;
  if (exitPrice === null || exitPrice === undefined || exitPrice === "") return "OPEN";
  return null;
}
