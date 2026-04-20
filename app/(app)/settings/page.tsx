import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TopHeader } from "@/components/TopHeader";
import { Panel } from "@/components/Panel";
import { AppsScriptBlock } from "./AppsScriptBlock";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

async function ensureWebhookSecret(userId: string): Promise<string> {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("user_settings")
    .select("sheets_webhook_secret")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.sheets_webhook_secret) return data.sheets_webhook_secret;
  const secret = randomBytes(32).toString("hex");
  await admin.from("user_settings").upsert(
    { user_id: userId, sheets_webhook_secret: secret },
    { onConflict: "user_id" },
  );
  return secret;
}

export default async function SettingsPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://aeternum-tracker-neon.vercel.app";
  const webhookSecret = user ? await ensureWebhookSecret(user.id) : "";

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
            <div className="text-muted">Webhook secret</div>
            <div className="font-mono text-[11px] break-all">
              {webhookSecret ? `${webhookSecret.slice(0, 8)}…${webhookSecret.slice(-6)}` : "—"}
            </div>
          </div>
        </Panel>

        <Panel
          title="Google Sheets Sync"
          subtitle="Paste this into Extensions → Apps Script in your trade journal sheet"
        >
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
