"use client";

import { useState } from "react";
import { buildAppsScript } from "./apps-script-template";

export function AppsScriptBlock({
  userId,
  webhookUrl,
  webhookSecret,
}: {
  userId: string;
  webhookUrl: string;
  webhookSecret: string;
}) {
  const [copied, setCopied] = useState(false);
  const code = buildAppsScript({ userId, webhookUrl, webhookSecret });

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative">
      <button
        onClick={copy}
        className="absolute top-2 right-2 bg-accent text-bg px-3 py-1 rounded text-[10px] font-semibold tracking-wider uppercase"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="bg-panel-2 border border-border rounded p-3 text-[11px] font-mono overflow-x-auto max-h-[400px]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
