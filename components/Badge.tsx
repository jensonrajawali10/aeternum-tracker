import type { ReactNode } from "react";
import type { AssetClass, BookType, Severity } from "@/lib/types";
import { clsx } from "@/lib/format";

const ASSET_STYLE: Record<AssetClass, string> = {
  idx_equity: "bg-blue-900/30 text-blue-300 border-blue-900/60",
  us_equity: "bg-green-900/30 text-green-300 border-green-900/60",
  crypto: "bg-amber-900/30 text-amber-300 border-amber-900/60",
  fx: "bg-purple-900/30 text-purple-300 border-purple-900/60",
  other: "bg-slate-700/40 text-slate-300 border-slate-700",
};

const BOOK_STYLE: Record<BookType, string> = {
  investing: "bg-teal-900/30 text-teal-300 border-teal-900/60",
  idx_trading: "bg-blue-900/30 text-blue-300 border-blue-900/60",
  crypto_trading: "bg-amber-900/30 text-amber-300 border-amber-900/60",
  other: "bg-slate-700/40 text-slate-300 border-slate-700",
};

const SEVERITY_STYLE: Record<Severity, string> = {
  info: "bg-blue-900/30 text-blue-300 border-blue-900/60",
  warning: "bg-amber-900/30 text-amber-300 border-amber-900/60",
  critical: "bg-red-900/40 text-red-300 border-red-900/60",
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
        "inline-flex items-center px-[6px] py-[1px] border rounded text-[10px] font-medium tracking-wider uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function AssetBadge({ cls }: { cls: AssetClass }) {
  const label = cls === "idx_equity" ? "IDX" : cls === "us_equity" ? "US" : cls === "crypto" ? "CRYPTO" : cls.toUpperCase();
  return <Badge className={ASSET_STYLE[cls]}>{label}</Badge>;
}

export function BookBadge({ book }: { book: BookType }) {
  const label =
    book === "investing" ? "INV" : book === "idx_trading" ? "IDX" : book === "crypto_trading" ? "CRYPTO" : "OTHER";
  return <Badge className={BOOK_STYLE[book]}>{label}</Badge>;
}

export function SeverityBadge({ sev }: { sev: Severity }) {
  return <Badge className={SEVERITY_STYLE[sev]}>{sev}</Badge>;
}
