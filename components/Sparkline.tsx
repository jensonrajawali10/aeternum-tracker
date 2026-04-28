"use client";

import { useId, useMemo } from "react";

interface Props {
  /** Series values; nulls/NaNs are skipped without breaking the line. */
  values: (number | null | undefined)[];
  /** Render width — defaults to "100%" so the parent controls horizontal
      stretch.  The internal viewBox is 100×100 with non-uniform aspect
      so the path scales to whatever dimensions the caller hands us. */
  width?: number | string;
  /** Render height in CSS pixels.  22 is the bottom-strip default. */
  height?: number;
  /** Optional stroke override.  Defaults: up=success, down=loss, flat=muted. */
  color?: string;
  className?: string;
}

/**
 * Inline-SVG sparkline rebuilt for the bottom-strip slot in Kpi tiles.
 *
 * Differences vs the previous corner-trend version:
 *   - viewBox is a fixed 100×100 with preserveAspectRatio="none" so the
 *     line + gradient stretch across whatever width the parent gives.
 *   - useId() seeds the gradient-fill id, so multiple sparklines on a
 *     page don't collide on a shared "spark" id.
 *   - A subtle gradient area fill sits below the stroke (top stop 0.22
 *     opacity in stroke colour, bottom stop 0).
 *   - The line uses vectorEffect="non-scaling-stroke" so the 1.4px
 *     weight survives the non-uniform stretch.
 *
 * Auto-coloured by direction (last vs first valid sample).  Empty or
 * <2-points renders an invisible div sized to `height` to keep layout
 * steady.
 */
export function Sparkline({
  values,
  width = "100%",
  height = 22,
  color,
  className,
}: Props) {
  const gradId = useId();

  const paths = useMemo(() => {
    const valid: { i: number; v: number }[] = [];
    values.forEach((v, i) => {
      if (v != null && Number.isFinite(v)) valid.push({ i, v: v as number });
    });
    if (valid.length < 2) return null;
    const vs = valid.map((p) => p.v);
    const min = Math.min(...vs);
    const max = Math.max(...vs);
    const range = max - min || 1;
    const padY = 8; // 8% vertical pad so the stroke doesn't kiss the edges
    const usable = 100 - padY * 2;
    const lastIdx = values.length - 1;
    const xs = valid.map((p) => (p.i / Math.max(1, lastIdx)) * 100);
    const ys = valid.map((p) => 100 - padY - ((p.v - min) / range) * usable);
    const linePath = xs
      .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${ys[i].toFixed(2)}`)
      .join(" ");
    const areaPath = `${linePath} L${xs[xs.length - 1].toFixed(2)},100 L${xs[0].toFixed(2)},100 Z`;
    return {
      linePath,
      areaPath,
      firstV: valid[0].v,
      lastV: valid[valid.length - 1].v,
    };
  }, [values]);

  if (!paths) {
    // Empty / single-point: invisible spacer the caller can rely on for
    // stable layout (the bottom strip won't collapse).
    return (
      <div
        className={className}
        style={{ width, height }}
        aria-hidden
      />
    );
  }

  const direction =
    paths.lastV > paths.firstV
      ? "var(--color-up)"
      : paths.lastV < paths.firstV
        ? "var(--color-down)"
        : "var(--color-muted-2)";
  const stroke = color ?? direction;
  // useId returns a string with colons that aren't valid in a fragment id,
  // so strip them.
  const safeId = `spark-${gradId.replace(/[^\w-]/g, "")}`;

  return (
    <svg
      role="img"
      aria-label="Sparkline"
      width={width}
      height={height}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={className}
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={safeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={paths.areaPath} fill={`url(#${safeId})`} stroke="none" />
      <path
        d={paths.linePath}
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
