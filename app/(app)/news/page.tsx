import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { NewsFeed } from "./NewsFeed";

export const dynamic = "force-dynamic";

export default function NewsPage() {
  return (
    <>
      <TopHeader
        title="News"
        subtitle="Yahoo Finance + Google News · merged across positions + watchlist · hotness-scored"
      />
      <Panel>
        <NewsFeed />
      </Panel>
    </>
  );
}
