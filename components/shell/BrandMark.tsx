/**
 * BrandMark — terminal-style amber dot + stacked Aeternum / CIO COCKPIT
 * lockup. Lives on the left of the desktop TopBar and as the page
 * "logo" in the mobile drawer header.
 */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="inline-block rounded-full"
        style={{
          width: compact ? 5 : 6,
          height: compact ? 5 : 6,
          background: "var(--color-accent)",
          boxShadow: "0 0 8px 0 var(--color-accent)",
        }}
        aria-hidden
      />
      <div className="leading-none">
        <div
          className="font-medium tracking-[-0.01em] text-fg"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: compact ? 12 : 13,
          }}
        >
          Aeternum
        </div>
        <div
          className="mono uppercase mt-[2px] text-muted-2"
          style={{
            fontSize: compact ? 8.5 : 9,
            letterSpacing: "0.18em",
          }}
        >
          CIO Cockpit
        </div>
      </div>
    </div>
  );
}
