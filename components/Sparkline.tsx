"use client";

import { useMemo } from "react";

interface Props {
  /** Series values; nulls/NaNs are skipped without breaking the line. */
  values: (number | null | undefined)[];
  /** Render width in CSS pixels. Defaults to 80, height 24 — KPI-tile sized. */
  width?: number;
  height?: number;
  /** Stroke colour; auto-flips to muted when last vs first is flat / unknown. */
  color?: string;
  /** Show the last point as a dot (defaults true). */
  showLast?: boolean;
  /** Render an "—" placeholder when there's <2 points to draw. */
  className?: string;
}

/**
 * Tiny inline-SVG sparkline used in the KPI tiles to give every headline
 * number a trend line.  Pure SVG (no Chart.js) keeps it cheap so we can
 * pile them into KpiRow without bloating the bundle.  Auto-colours by
 * last-vs-first sign so a reader can read direction at a glance:
 *   last > first  → green (success)
 *   last < first  → red (loss)
 *   last == first → muted
 *
 * The polyline is normalised between the series min and max with a 4%
 * vertical pad so the trace doesn't touch the box edges.  Values that
 * are null / NaN / not finite are skipped — the polyline simply jumps
 * over them rather than drawing a zero.
 */
export function Sparkline({
  values,
  width = 80,
  height = 24,
  color,
  showLast = true,
  className,
}: Props) {
  const points = useMemo(() => {
    const valid: { i: number; v: number }[] = [];
    values.forEach((v, i) => {
      if (v != null && Number.isFinite(v)) valid.push({ i, v: v as number });
    });
    if (valid.length < 2) return null;
    const vs = valid.map((p) => p.v);
    const min = Math.min(...vs);
    const max = Math.max(...vs);
    const range = max - min || 1;
    const padY = height * 0.08;
    const usable = height - padY * 2;
    const lastIdx = values.length - 1;
    const xs = valid.map((p) => (p.i / Math.max(1, lastIdx)) * width);
    const ys = valid.map((p) => height - padY - ((p.v - min) / range) * usable);
    const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${ys[i].toFixed(2)}`).join(" ");
    return {
      path,
      lastX: xs[xs.length - 1],
      lastY: ys[ys.length - 1],
      firstV: valid[0].v,
      lastV: valid[valid.length - 1].v,
    };
  }, [values, width, height]);

  if (!points) {
    return (
      <span
        className={className}
        style={{ display: "inline-block", width, height, color: "var(--color-muted-2)" }}
        aria-hidden
      />
    );
  }

  const direction =
    points.lastV > points.firstV
      ? "var(--color-success)"
      : points.lastV < points.firstV
        ? "var(--color-loss)"
        : "var(--color-muted-2)";
  const stroke = color ?? direction;

  return (
    <svg
      role="img"
      aria-label="Sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ display: "block" }}
    >
      <path
        d={points.path}
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {showLast && (
        <circle cx={points.lastX} cy={points.lastY} r="1.8" fill={stroke} />
      )}
    </svg>
  );
}
