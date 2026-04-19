import { supabaseServer } from "@/lib/supabase/server";
import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { AppsScriptBlock } from "./AppsScriptBlock";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const webhookSecret = process.env.SHEETS_WEBHOOK_SECRET || "";

  return (
    <>
      <TopHeader title="Settings" subtitle="Account, webhooks, sync configuration" />
      <div className="grid gap-4">
        <Panel title="Account">
          <div className="grid grid-cols-[140px_1fr] gap-y-2 text-[12px]">
            <div className="text-muted">Email</div>
            <div>{user?.email || "—"}</div>
            <div className="text-muted">User ID</div>
            <div className="font-mono text-[11px] break-all">{user?.id || "—"}</div>
          </div>
        </Panel>

        <Panel title="Google Sheets Sync" subtitle="Paste this into Extensions → Apps Script in your trade journal sheet">
          <AppsScriptBlock
            userId={user?.id || ""}
            webhookUrl={`${appUrl}/api/sync/sheets`}
            webhookSecret={webhookSecret}
          />
          <div className="mt-4 text-[11px] text-muted space-y-1">
            <div>1. Open your trade journal Google Sheet</div>
            <div>2. Extensions → Apps Script</div>
            <div>3. Replace the default code with the block above, save</div>
            <div>4. Run <code className="text-accent">setupDailySync</code> once, grant permissions</div>
            <div>5. Run <code className="text-accent">syncAllTrades</code> once to backfill</div>
            <div>6. Edits to the sheet will auto-sync via <code className="text-accent">onEdit</code></div>
          </div>
        </Panel>
      </div>
    </>
  );
}
