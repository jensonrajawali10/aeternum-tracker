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
    <div className="flex items-center rounded border border-border bg-panel overflow-hidden">
      {(["IDR", "USD"] as const).map((c) => (
        <button
          key={c}
          onClick={() => set(c)}
          className={clsx(
            "px-3 py-[5px] text-[11px] tracking-wider transition-colors",
            current === c ? "bg-accent text-bg font-semibold" : "text-muted hover:text-fg hover:bg-hover",
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
