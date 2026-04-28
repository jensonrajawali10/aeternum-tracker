import { clsx } from "@/lib/format";

interface Props {
  /** Numeric value the glyph reflects.  null/undefined renders "—". */
  value: number | null | undefined;
  /** Pre-formatted string to display.  Pass `fmtPct(x, 2, true)` etc. */
  text: string;
  /** Override the auto-derived tone (up/down/neutral). */
  tone?: "up" | "down" | "neutral" | "amber";
  /** Hide the leading ▲/▼ glyph (useful in cells where the column header
      already conveys direction). Defaults to false — show the glyph. */
  hideGlyph?: boolean;
  className?: string;
}

/**
 * DeltaNumber — every P&L number on the dashboard should flow through
 * this so colourblind users can read direction from the glyph alone.
 * Pure red/green tokens (no pastels) per terminal brief.
 */
export function DeltaNumber({
  value,
  text,
  tone,
  hideGlyph,
  className,
}: Props) {
  const auto: "up" | "down" | "neutral" =
    value == null || !Number.isFinite(value) || value === 0
      ? "neutral"
      : value > 0
        ? "up"
        : "down";
  const t = tone ?? auto;
  const glyph = t === "up" ? "▲" : t === "down" ? "▼" : "·";
  const colorClass =
    t === "up"
      ? "text-up"
      : t === "down"
        ? "text-down"
        : t === "amber"
          ? "text-amber"
          : "text-muted";

  return (
    <span className={clsx("mono inline-flex items-center gap-1", colorClass, className)}>
      {!hideGlyph && (
        <span aria-hidden style={{ fontSize: "0.8em", lineHeight: 1 }}>
          {glyph}
        </span>
      )}
      <span>{text}</span>
    </span>
  );
}
