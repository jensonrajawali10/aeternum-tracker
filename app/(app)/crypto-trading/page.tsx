import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
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
