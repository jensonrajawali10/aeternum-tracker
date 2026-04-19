export function fmtIDR(value: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (value == null || !isFinite(value)) return "—";
  const { compact = true } = opts;
  if (!compact) return `IDR ${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const abs = Math.abs(value);
  if (abs >= 1e12) return `IDR ${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `IDR ${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `IDR ${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `IDR ${(value / 1e3).toFixed(1)}K`;
  return `IDR ${value.toFixed(0)}`;
}

export function fmtNumber(value: number | null | undefined, decimals = 2): string {
  if (value == null || !isFinite(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

export function fmtPct(value: number | null | undefined, decimals = 2, withSign = false): string {
  if (value == null || !isFinite(value)) return "—";
  const formatted = value.toFixed(decimals) + "%";
  return withSign && value > 0 ? `+${formatted}` : formatted;
}

export function fmtBps(value: number | null | undefined, withSign = true): string {
  if (value == null || !isFinite(value)) return "—";
  const formatted = Math.round(value) + " bps";
  return withSign && value > 0 ? `+${formatted}` : formatted;
}

export function fmtCurrency(value: number | null | undefined, currency: "IDR" | "USD", compact = true): string {
  if (value == null || !isFinite(value)) return "—";
  if (currency === "IDR") return fmtIDR(value, { compact });
  const abs = Math.abs(value);
  if (!compact) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export function fmtQty(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return "—";
  if (Math.abs(value) < 10 && !Number.isInteger(value)) return value.toFixed(4);
  if (Math.abs(value) < 1000 && !Number.isInteger(value)) return value.toFixed(2);
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function fmtDate(value: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", opts);
}

export function signClass(value: number | null | undefined): string {
  if (value == null) return "";
  if (value > 0) return "pos";
  if (value < 0) return "neg";
  return "";
}

export function clsx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
