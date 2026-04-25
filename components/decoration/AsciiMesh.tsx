import { clsx } from "@/lib/format";

interface Props {
  /** Pattern density — `tight` reads as texture, `loose` as decoration. */
  density?: "tight" | "loose" | "default";
  /** Glyph used for the mesh — `+` is the hyperlane signature, `·` reads more like rain. */
  glyph?: "+" | "·";
  /** Number of rows × cols rendered. Bigger = more area covered. */
  rows?: number;
  cols?: number;
  /** Slow horizontal drift for hero backdrops; off by default. */
  drift?: boolean;
  /** Extra class applied to the underlying <pre>. Use to absolutely position. */
  className?: string;
}

/**
 * AsciiMesh — translates hyperlane.xyz's signature `+` ASCII pattern
 * into a decorative backdrop layer. Renders a literal monospace grid;
 * positioning + opacity controlled via the .ae-mesh-bg utility class
 * (and the loose/tight modifiers) defined in globals.css.
 *
 * Default usage (positioned absolute, parent must be relative):
 *
 *     <div className="relative ...">
 *       <AsciiMesh />
 *       <div className="relative ...">actual content</div>
 *     </div>
 *
 * The mesh is aria-hidden and pointer-events-none so it never traps
 * focus or interferes with text selection in the foreground content.
 */
export function AsciiMesh({
  density = "default",
  glyph = "+",
  rows = 30,
  cols = 80,
  drift = false,
  className,
}: Props) {
  // Stagger the glyph across the grid via a checkerboard-ish (r + c) % 4
  // mod so the pattern looks irregular rather than a uniform grid.
  // Empty cells stay as spaces (they're rendered, just invisible) so the
  // monospace alignment holds in every browser.
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = "";
    for (let c = 0; c < cols; c++) {
      line += (r + c) % 4 === 0 ? glyph : " ";
    }
    lines.push(line);
  }
  const text = lines.join("\n");

  const densityClass =
    density === "loose" ? "ae-mesh-loose" : density === "tight" ? "ae-mesh-tight" : "";

  return (
    <pre
      aria-hidden
      className={clsx("ae-mesh-bg", densityClass, drift && "ae-mesh-drift", className)}
    >
      {text}
    </pre>
  );
}
