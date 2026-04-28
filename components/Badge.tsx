import type { ReactNode } from "react";
import type { AssetClass, BookType, Severity } from "@/lib/types";
import { clsx } from "@/lib/format";

/* New language: chips are monochrome (elevated bg, muted text) with violet-accent
   reserved for the primary semantic state and success/loss for P&L-like meaning. */

const ASSET_STYLE: Record<AssetClass, string> = {
  idx_equity: "bg-elevated text-muted border-border",
  us_equity: "bg-elevated text-muted border-border",
  crypto: "bg-elevated text-muted border-border",
  fx: "bg-elevated text-muted border-border",
  other: "bg-elevated text-muted border-border",
};

// "firm" widens the BookBadge so capital-allocation / firm-level memos can
// label themselves without forcing every BookType consumer (positions,
// trades, KPI rows, etc.) to widen too — those tables only ever hold the
// three real books. The accent styling differentiates a firm-scoped item
// at a glance from the muted three-book tags.
type BookOrFirm = BookType | "firm";

const BOOK_STYLE: Record<BookOrFirm, string> = {
  investing: "bg-elevated text-muted border-border",
  idx_trading: "bg-elevated text-muted border-border",
  crypto_trading: "bg-elevated text-muted border-border",
  other: "bg-elevated text-muted border-border",
  firm: "bg-accent/10 text-accent border-accent/30",
};

/* Severity tones — terminal redesign:
 *   info     → cyan tone, label SIGNAL    (informational signal landed)
 *   warning  → amber tone, label WATCH    (something to keep an eye on)
 *   critical → down-red tone, label BREACH (threshold broken / drawdown)
 *
 * Built with rgba() colour-mix tokens so the chip background stays
 * consistent with the palette no matter how the @theme tokens change. */
const SEVERITY_STYLE: Record<Severity, string> = {
  info: "text-cyan border",
  warning: "text-amber border",
  critical: "text-down border",
};

const SEVERITY_INLINE: Record<Severity, React.CSSProperties> = {
  info: {
    background: "color-mix(in srgb, var(--color-cyan) 10%, transparent)",
    borderColor: "color-mix(in srgb, var(--color-cyan) 30%, transparent)",
  },
  warning: {
    background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
    borderColor: "color-mix(in srgb, var(--color-accent) 30%, transparent)",
  },
  critical: {
    background: "color-mix(in srgb, var(--color-down) 10%, transparent)",
    borderColor: "color-mix(in srgb, var(--color-down) 30%, transparent)",
  },
};

const SEVERITY_LABEL: Record<Severity, string> = {
  info: "signal",
  warning: "watch",
  critical: "breach",
};

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-[7px] py-[2px] border rounded-[3px] text-[10.5px] font-medium mono tracking-normal",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function AssetBadge({ cls }: { cls: AssetClass }) {
  const label = cls === "idx_equity" ? "idx" : cls === "us_equity" ? "us" : cls === "crypto" ? "crypto" : cls;
  return <Badge className={ASSET_STYLE[cls]}>{label}</Badge>;
}

export function BookBadge({ book }: { book: BookOrFirm }) {
  const label =
    book === "investing"
      ? "inv"
      : book === "idx_trading"
        ? "idx"
        : book === "crypto_trading"
          ? "crypto"
          : book === "firm"
            ? "firm"
            : "other";
  return <Badge className={BOOK_STYLE[book]}>{label}</Badge>;
}

export function SeverityBadge({ sev }: { sev: Severity }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-[7px] py-[2px] border rounded-[3px] text-[10.5px] font-medium mono uppercase tracking-[0.10em]",
        SEVERITY_STYLE[sev],
      )}
      style={SEVERITY_INLINE[sev]}
    >
      {SEVERITY_LABEL[sev]}
    </span>
  );
}
