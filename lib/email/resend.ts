import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || "Aeternum Tracker <onboarding@resend.dev>";

const client = apiKey ? new Resend(apiKey) : null;

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!client) {
    console.warn("[resend] RESEND_API_KEY missing; skipping send");
    return { ok: false, error: "no_api_key" };
  }
  try {
    const { data, error } = await client.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function alertEmailHtml(params: {
  ticker: string;
  message: string;
  current_value: string;
  threshold: string;
  app_url: string;
}): string {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0a0e13;color:#e6e7eb;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#111820;border:1px solid #1c2532;border-radius:6px;padding:24px;">
<h2 style="color:#d4a64a;margin:0 0 16px 0;font-size:18px;letter-spacing:.08em;text-transform:uppercase;">AETERNUM — Alert</h2>
<p style="margin:0 0 8px;font-size:15px;"><strong style="color:#d4a64a;">${escapeHtml(params.ticker)}</strong></p>
<p style="margin:0 0 16px;font-size:14px;color:#cdd1d9;">${escapeHtml(params.message)}</p>
<div style="border-top:1px solid #1c2532;padding-top:12px;font-size:13px;color:#8a92a6;">
  <div>Current: <span style="color:#e6e7eb;">${escapeHtml(params.current_value)}</span></div>
  <div>Threshold: <span style="color:#e6e7eb;">${escapeHtml(params.threshold)}</span></div>
</div>
<a href="${escapeHtml(params.app_url)}" style="display:inline-block;margin-top:16px;padding:8px 16px;background:#d4a64a;color:#0a0e13;text-decoration:none;border-radius:4px;font-size:13px;font-weight:600;">Open Aeternum</a>
</div></body></html>`;
}

export function signalEmailHtml(params: {
  agent_slug: string;
  severity: string;
  headline: string;
  body: string;
  app_url: string;
}): string {
  const sevColor = params.severity === "critical" ? "#e06666" : params.severity === "warning" ? "#e0b058" : "#7fa2d6";
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0a0e13;color:#e6e7eb;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#111820;border:1px solid #1c2532;border-radius:6px;padding:24px;">
<h2 style="color:#d4a64a;margin:0 0 16px 0;font-size:18px;letter-spacing:.08em;text-transform:uppercase;">AETERNUM — Agent Signal</h2>
<div style="margin-bottom:12px;"><span style="background:${sevColor};color:#0a0e13;padding:2px 8px;border-radius:3px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">${escapeHtml(params.severity)}</span> <span style="color:#8a92a6;font-size:12px;margin-left:8px;">${escapeHtml(params.agent_slug)}</span></div>
<h3 style="margin:0 0 12px;font-size:16px;">${escapeHtml(params.headline)}</h3>
<div style="font-size:14px;color:#cdd1d9;line-height:1.5;white-space:pre-wrap;">${escapeHtml(params.body)}</div>
<a href="${escapeHtml(params.app_url)}/agents" style="display:inline-block;margin-top:16px;padding:8px 16px;background:#d4a64a;color:#0a0e13;text-decoration:none;border-radius:4px;font-size:13px;font-weight:600;">View in Aeternum</a>
</div></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
