import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { NewsFeed } from "./NewsFeed";

export const dynamic = "force-dynamic";

export default function NewsPage() {
  return (
    <>
      <TopHeader
        title="News"
        subtitle="TradingView feed · merged across positions + watchlist"
      />
      <Panel>
        <NewsFeed />
      </Panel>
    </>
  );
}
