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

const SEVERITY_STYLE: Record<Severity, string> = {
  info: "bg-[rgba(139,92,246,0.12)] text-[#B794F6] border-transparent",
  warning: "bg-[rgba(184,104,104,0.12)] text-loss border-transparent",
  critical: "bg-[rgba(184,104,104,0.2)] text-loss border-transparent",
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
  return <Badge className={SEVERITY_STYLE[sev]}>{sev}</Badge>;
}
