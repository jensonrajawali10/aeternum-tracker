"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { BookFilter } from "@/lib/types";
import { clsx } from "@/lib/format";

const BOOKS: { value: BookFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "investing", label: "Investing" },
  { value: "idx_trading", label: "IDX trades" },
  { value: "crypto_trading", label: "Crypto" },
];

export function BookSwitcher({ current }: { current: BookFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setBook(b: BookFilter) {
    const params = new URLSearchParams(searchParams.toString());
    if (b === "all") params.delete("book");
    else params.set("book", b);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center rounded-[6px] border border-border bg-panel overflow-hidden">
      {BOOKS.map((b) => (
        <button
          key={b.value}
          onClick={() => setBook(b.value)}
          className={clsx(
            "px-3 h-[28px] text-[11.5px] transition-colors",
            current === b.value
              ? "bg-elevated text-fg border-l border-r first:border-l-0 last:border-r-0 border-accent"
              : "text-muted hover:text-fg hover:bg-elevated",
          )}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
