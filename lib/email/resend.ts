import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || "Aeternum Tracker <onboarding@resend.dev>";

const client = apiKey ? new Resend(apiKey) : null;

export async function sendEmail(opts: {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!client) {
    console.warn("[resend] RESEND_API_KEY missing; skipping send");
    return { ok: false, error: "no_api_key" };
  }
  try {
    // Resend rejects empty arrays on cc/bcc — normalise to undefined.
    const cc = Array.isArray(opts.cc) ? (opts.cc.length ? opts.cc : undefined) : opts.cc;
    const bcc = Array.isArray(opts.bcc) ? (opts.bcc.length ? opts.bcc : undefined) : opts.bcc;
    const { data, error } = await client.emails.send({
      from: FROM,
      to: opts.to,
      cc,
      bcc,
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

export function hotNewsEmailHtml(params: {
  items: { title: string; url: string; source: string; ticker?: string | null; score: number; reasons: string[]; published: number }[];
  app_url: string;
}): string {
  const rows = params.items
    .map((i) => {
      const reasonChip = i.reasons
        .slice(0, 3)
        .map(
          (r) =>
            `<span style="background:#1c2532;color:#d4a64a;padding:1px 6px;border-radius:3px;font-size:10px;letter-spacing:.04em;text-transform:uppercase;margin-right:4px;">${escapeHtml(r)}</span>`,
        )
        .join("");
      const when = new Date(i.published).toLocaleString();
      return `<div style="border-bottom:1px solid #1c2532;padding:12px 0;">
  <div style="margin-bottom:4px;">${i.ticker ? `<span style=\"color:#d4a64a;font-weight:700;font-size:12px;margin-right:8px;\">${escapeHtml(i.ticker)}</span>` : ""}<span style="color:#8a92a6;font-size:11px;">${escapeHtml(i.source)} · ${escapeHtml(when)} · score ${i.score}</span></div>
  <a href="${escapeHtml(i.url)}" style="color:#e6e7eb;font-size:14px;font-weight:600;text-decoration:none;line-height:1.35;display:block;margin-bottom:6px;">${escapeHtml(i.title)}</a>
  <div>${reasonChip}</div>
</div>`;
    })
    .join("");
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0a0e13;color:#e6e7eb;padding:24px;">
<div style="max-width:640px;margin:0 auto;background:#111820;border:1px solid #1c2532;border-radius:6px;padding:24px;">
<h2 style="color:#d4a64a;margin:0 0 4px 0;font-size:18px;letter-spacing:.08em;text-transform:uppercase;">AETERNUM — Hot News</h2>
<p style="margin:0 0 16px;font-size:12px;color:#8a92a6;">${params.items.length} flagged ${params.items.length === 1 ? "item" : "items"} across your positions and watchlist.</p>
${rows}
<a href="${escapeHtml(params.app_url)}/news" style="display:inline-block;margin-top:16px;padding:8px 16px;background:#d4a64a;color:#0a0e13;text-decoration:none;border-radius:4px;font-size:13px;font-weight:600;">Open news feed</a>
<p style="margin:16px 0 0;font-size:11px;color:#8a92a6;">Disable hot-news emails in Settings → Alerts.</p>
</div></body></html>`;
}

export function marketRecapEmailHtml(params: {
  session_label: string; // "US Close" | "IDX Close"
  session_date: string; // e.g. "2026-04-22"
  benchmarks: { name: string; close: number | null; day_pct: number | null; ccy: string }[];
  portfolio: {
    nav_idr: number | null;
    nav_prev_idr: number | null;
    day_pct: number | null;
    unrealized_pnl_idr: number | null;
  } | null;
  top_movers: { ticker: string; asset_class: string; day_pct: number | null; price: number | null }[];
  news: { title: string; url: string; source: string; ticker?: string | null; score: number; reasons: string[]; published: number }[];
  app_url: string;
}): string {
  const fmtPct = (n: number | null) => {
    if (n === null || !Number.isFinite(n)) return "—";
    const sign = n > 0 ? "+" : "";
    const c = n > 0 ? "#7fb98c" : n < 0 ? "#e06666" : "#cdd1d9";
    return `<span style="color:${c};">${sign}${n.toFixed(2)}%</span>`;
  };
  const fmtNum = (n: number | null, digits = 2) => {
    if (n === null || !Number.isFinite(n)) return "—";
    return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  };
  const fmtIdr = (n: number | null) => {
    if (n === null || !Number.isFinite(n)) return "—";
    if (Math.abs(n) >= 1e9) return `Rp ${(n / 1e9).toFixed(2)}B`;
    if (Math.abs(n) >= 1e6) return `Rp ${(n / 1e6).toFixed(2)}M`;
    return `Rp ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  };

  const benchRows = params.benchmarks
    .map(
      (b) =>
        `<tr><td style="padding:6px 8px;color:#cdd1d9;font-size:13px;">${escapeHtml(b.name)}</td>` +
        `<td style="padding:6px 8px;color:#e6e7eb;font-size:13px;text-align:right;font-variant-numeric:tabular-nums;">${b.close !== null ? fmtNum(b.close) : "—"}</td>` +
        `<td style="padding:6px 8px;font-size:13px;text-align:right;font-variant-numeric:tabular-nums;">${fmtPct(b.day_pct)}</td></tr>`,
    )
    .join("");

  const portfolioRow = params.portfolio
    ? `<div style="margin:16px 0 8px;padding:12px;background:#0e141b;border:1px solid #1c2532;border-radius:4px;">
        <div style="color:#8a92a6;font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px;">Your Portfolio</div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <div><span style="color:#e6e7eb;font-size:18px;font-weight:600;font-variant-numeric:tabular-nums;">${fmtIdr(params.portfolio.nav_idr)}</span>
          <span style="margin-left:10px;font-size:14px;">${fmtPct(params.portfolio.day_pct)}</span></div>
          <div style="color:#8a92a6;font-size:12px;">Unreal ${fmtIdr(params.portfolio.unrealized_pnl_idr)}</div>
        </div>
      </div>`
    : "";

  const moverRows = params.top_movers
    .slice(0, 6)
    .map(
      (m) =>
        `<tr><td style="padding:6px 8px;font-size:13px;"><span style="color:#d4a64a;font-weight:600;">${escapeHtml(m.ticker)}</span> <span style="color:#8a92a6;font-size:10px;text-transform:uppercase;letter-spacing:.06em;">${escapeHtml(m.asset_class.replace("_", " "))}</span></td>` +
        `<td style="padding:6px 8px;color:#cdd1d9;font-size:13px;text-align:right;font-variant-numeric:tabular-nums;">${m.price !== null ? fmtNum(m.price) : "—"}</td>` +
        `<td style="padding:6px 8px;font-size:13px;text-align:right;font-variant-numeric:tabular-nums;">${fmtPct(m.day_pct)}</td></tr>`,
    )
    .join("");

  const newsRows = params.news
    .slice(0, 8)
    .map((i) => {
      const reasonChip = i.reasons
        .slice(0, 2)
        .map(
          (r) =>
            `<span style="background:#1c2532;color:#d4a64a;padding:1px 6px;border-radius:3px;font-size:10px;letter-spacing:.04em;text-transform:uppercase;margin-right:4px;">${escapeHtml(r)}</span>`,
        )
        .join("");
      return `<div style="border-bottom:1px solid #1c2532;padding:10px 0;">
        <div style="margin-bottom:3px;">${i.ticker ? `<span style=\"color:#d4a64a;font-weight:700;font-size:12px;margin-right:8px;\">${escapeHtml(i.ticker)}</span>` : ""}<span style="color:#8a92a6;font-size:11px;">${escapeHtml(i.source)} · score ${i.score}</span></div>
        <a href="${escapeHtml(i.url)}" style="color:#e6e7eb;font-size:13px;font-weight:600;text-decoration:none;line-height:1.35;display:block;margin-bottom:4px;">${escapeHtml(i.title)}</a>
        <div>${reasonChip}</div>
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0a0e13;color:#e6e7eb;padding:24px;">
<div style="max-width:640px;margin:0 auto;background:#111820;border:1px solid #1c2532;border-radius:6px;padding:24px;">
<h2 style="color:#d4a64a;margin:0 0 4px 0;font-size:18px;letter-spacing:.08em;text-transform:uppercase;">AETERNUM — ${escapeHtml(params.session_label)} Recap</h2>
<p style="margin:0 0 16px;font-size:12px;color:#8a92a6;">${escapeHtml(params.session_date)}</p>

<div style="color:#8a92a6;font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin:16px 0 6px;">Benchmarks</div>
<table style="width:100%;border-collapse:collapse;background:#0e141b;border:1px solid #1c2532;border-radius:4px;">${benchRows}</table>

${portfolioRow}

${moverRows ? `<div style="color:#8a92a6;font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin:16px 0 6px;">Top Movers (Your Book)</div>
<table style="width:100%;border-collapse:collapse;background:#0e141b;border:1px solid #1c2532;border-radius:4px;">${moverRows}</table>` : ""}

${newsRows ? `<div style="color:#8a92a6;font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin:18px 0 6px;">Headlines Worth Knowing</div>
${newsRows}` : `<p style="color:#8a92a6;font-size:12px;margin-top:16px;">No headlines cleared the hot-news bar this session.</p>`}

<a href="${escapeHtml(params.app_url)}" style="display:inline-block;margin-top:16px;padding:8px 16px;background:#d4a64a;color:#0a0e13;text-decoration:none;border-radius:4px;font-size:13px;font-weight:600;">Open Aeternum</a>
<p style="margin:16px 0 0;font-size:11px;color:#8a92a6;">Session recaps fire at IDX close (~16:05 WIB) and US close (~16:05 ET). Toggle in Settings → Alerts.</p>
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
