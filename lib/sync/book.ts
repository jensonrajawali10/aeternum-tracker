import type { AssetClass, BookType } from "@/lib/types";

export function deriveBook(assetType: string, strategy: string | null | undefined): BookType {
  const at = (assetType || "").toLowerCase().trim();
  const st = (strategy || "").toLowerCase().trim();

  if (at.includes("crypto") || at.includes("digital")) return "crypto_trading";

  const investingStrategies = ["long-term", "long term", "core", "investing", "compounder", "hold"];
  if (investingStrategies.some((s) => st.includes(s))) return "investing";

  if (at.includes("idx") || at.includes("indo") || at.includes("indonesia")) return "idx_trading";

  if (at.includes("us") || at.includes("stock")) {
    return investingStrategies.some((s) => st.includes(s)) ? "investing" : "idx_trading";
  }

  return "other";
}

export function normalizeAssetClass(assetType: string): AssetClass {
  const at = (assetType || "").toLowerCase();
  if (at.includes("crypto") || at.includes("digital")) return "crypto";
  if (at.includes("fx") || at.includes("forex")) return "fx";
  if (at.includes("idx") || at.includes("indo")) return "idx_equity";
  if (at.includes("us")) return "us_equity";
  return "other";
}

export function derivePnlCurrency(assetClass: AssetClass): "IDR" | "USD" {
  return assetClass === "idx_equity" ? "IDR" : "USD";
}
