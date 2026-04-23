import { TopHeader } from "@/components/TopHeader";
import { HyperliquidManager } from "./HyperliquidManager";

export const dynamic = "force-dynamic";

export default function CryptoTradingPage() {
  return (
    <>
      <TopHeader title="Crypto Trading" subtitle="Hyperliquid · auto-sync positions and fills" />
      <HyperliquidManager />
    </>
  );
}
