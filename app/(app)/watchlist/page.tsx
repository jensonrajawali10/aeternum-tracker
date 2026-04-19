import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { WatchlistManager } from "./WatchlistManager";

export const dynamic = "force-dynamic";

export default function WatchlistPage() {
  return (
    <>
      <TopHeader title="Watchlist" subtitle="Ideas on the bench · live quotes · no live MTM" />
      <Panel>
        <WatchlistManager />
      </Panel>
    </>
  );
}
