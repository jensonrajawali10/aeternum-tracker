import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { CcEmailsPanel } from "./CcEmailsPanel";
import { SheetSourcesPanel } from "./SheetSourcesPanel";
import { AgentIntegrationsPanel } from "./AgentIntegrationsPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = supabaseAdmin();
  const { data: settings } = user
    ? await admin
        .from("user_settings")
        .select("sheet_trading_url, sheet_holdings_url, sheet_last_sync_at")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <>
      <TopHeader title="Settings" subtitle="Account, data sources, preferences" />
      <div className="grid gap-4">
        <Panel title="Account">
          <div className="grid grid-cols-[140px_1fr] gap-y-2 text-[12px]">
            <div className="text-muted">Email</div>
            <div>{user?.email || "—"}</div>
            <div className="text-muted">User ID</div>
            <div className="font-mono text-[11px] break-all">{user?.id || "—"}</div>
          </div>
        </Panel>

        <CcEmailsPanel />

        <Panel
          title="Google Sheets sync"
          subtitle="Aeternum polls your sheets every 10 min · no Apps Script required"
        >
          <SheetSourcesPanel
            initialTradingUrl={settings?.sheet_trading_url || ""}
            initialHoldingsUrl={settings?.sheet_holdings_url || ""}
            lastSyncAt={settings?.sheet_last_sync_at || null}
          />
        </Panel>

        <Panel
          title="Agent integrations"
          subtitle="Webhook keys for the four Claude Code analysts · generate once, paste into skill config"
        >
          <AgentIntegrationsPanel />
        </Panel>
      </div>
    </>
  );
}
