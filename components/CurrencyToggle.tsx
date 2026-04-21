"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { clsx } from "@/lib/format";

export function CurrencyToggle({ current }: { current: "IDR" | "USD" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function set(ccy: "IDR" | "USD") {
    const params = new URLSearchParams(searchParams.toString());
    if (ccy === "IDR") params.delete("ccy");
    else params.set("ccy", ccy);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center rounded-[6px] border border-border bg-panel overflow-hidden">
      {(["IDR", "USD"] as const).map((c) => (
        <button
          key={c}
          onClick={() => set(c)}
          className={clsx(
            "mono px-3 h-[28px] text-[11px] transition-colors",
            current === c ? "bg-elevated text-fg" : "text-muted hover:text-fg hover:bg-elevated",
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
