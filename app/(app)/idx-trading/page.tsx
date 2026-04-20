import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { IdxFriendOnboarding } from "./IdxFriendOnboarding";
import { IdxTradesTable } from "./IdxTradesTable";

export const dynamic = "force-dynamic";

export default async function IdxTradingPage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();

  const admin = supabaseAdmin();
  const [{ data: settings }, { count }] = await Promise.all([
    admin.from("user_settings").select("sheets_webhook_secret").eq("user_id", user!.id).maybeSingle(),
    admin.from("trades").select("*", { count: "exact", head: true }).eq("user_id", user!.id).eq("book", "idx_trading"),
  ]);

  const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/sync/sheets`
    : "https://aeternum-tracker-neon.vercel.app/api/sync/sheets";

  return (
    <>
      <TopHeader title="IDX Trading" subtitle={`${count ?? 0} trades · IDX Composite constituents · sync from external sheet`} />

      <Panel title="Recent IDX Trades" className="mb-4">
        <IdxTradesTable />
      </Panel>

      <Panel title="Invite your IDX trader" subtitle="Generate an Apps Script for their sheet — rows land here as book=idx_trading">
        <IdxFriendOnboarding
          userId={user!.id}
          webhookUrl={webhookUrl}
          webhookSecret={settings?.sheets_webhook_secret ?? ""}
        />
      </Panel>
    </>
  );
}
