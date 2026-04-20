"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";
import { Panel } from "@/components/Panel";
import { Kpi } from "@/components/Kpi";
import { clsx, fmtCurrency, fmtNumber, fmtPct, signClass } from "@/lib/format";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type HlPosition = {
  position: {
    coin: string;
    szi: string;
    entryPx: string | null;
    positionValue: string;
    unrealizedPnl: string;
    returnOnEquity: string;
    liquidationPx: string | null;
    marginUsed: string;
    leverage: { type: string; value: number };
  };
};

type SpotBalance = { coin: string; total: number; hold: number; entryNtl: number; usdValue: number };

type HlState = {
  address: string;
  perp: {
    marginSummary: { accountValue: string; totalNtlPos: string; totalMarginUsed: string };
    withdrawable: string;
    assetPositions: HlPosition[];
    time: number;
  } | null;
  spot: { balances: SpotBalance[] } | null;
  spot_value_usd: number;
  combined_account_value_usd: number;
  at: string;
};

type SyncInfo = { address: string | null; last_sync_at: string | null; last_sync_tid: number | null };

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function relTime(now: number, atIso: string | null | undefined): string {
  if (!atIso) return "—";
  const dt = now - new Date(atIso).getTime();
  const s = Math.max(0, Math.round(dt / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

export function HyperliquidManager() {
  const { data: sync, mutate: mutateSync } = useSWR<SyncInfo>("/api/sync/hyperliquid", fetcher, {
    refreshInterval: 60000,
  });
  const hasAddress = !!sync?.address;

  const {
    data: state,
    mutate: mutateState,
    isLoading,
  } = useSWR<HlState>(hasAddress ? "/api/hyperliquid/state" : null, fetcher, {
    refreshInterval: 15000,
  });

  const now = useNow(1000);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function saveAndSync() {
    const address = input.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      setMsg("Invalid address. Must be 0x + 40 hex chars.");
      return;
    }
    setBusy(true);
    setMsg("Syncing fills…");
    const r = await fetch("/api/sync/hyperliquid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) {
      setMsg(j.error || "sync failed");
      return;
    }
    setMsg(`Synced ${j.synced} fills.`);
    setInput("");
    mutateSync();
    mutateState();
  }

  async function resync() {
    setBusy(true);
    setMsg("Resyncing…");
    const r = await fetch("/api/sync/hyperliquid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const j = await r.json();
    setBusy(false);
    setMsg(r.ok ? `Synced ${j.synced} fills.` : j.error);
    mutateSync();
    mutateState();
  }

  if (!hasAddress) {
    return (
      <Panel title="Connect Hyperliquid" subtitle="Paste your wallet address — read-only, no signature needed">
        <div className="max-w-md space-y-3">
          <input
            type="text"
            placeholder="0x…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full font-mono text-[12px]"
          />
          <button
            onClick={saveAndSync}
            disabled={busy}
            className="px-4 py-2 rounded-[4px] bg-accent text-bg text-[12px] font-semibold tracking-wide hover:bg-accent-dim transition-colors disabled:opacity-50"
          >
            {busy ? "Connecting…" : "Connect & Sync"}
          </button>
          {msg && <div className="text-[11px] text-muted">{msg}</div>}
          <div className="text-[10.5px] text-muted-2 leading-relaxed pt-2 border-t border-border">
            Uses Hyperliquid's public info API. Reads your perp positions, spot balances, and trade fills.
            No API key or signature required since all account data on HL is public on-chain.
          </div>
        </div>
      </Panel>
    );
  }

  const perp = state?.perp;
  const perpAccountValue = perp ? parseFloat(perp.marginSummary.accountValue) : 0;
  const spotValue = state?.spot_value_usd ?? 0;
  const combined = state?.combined_account_value_usd ?? perpAccountValue + spotValue;
  const totalPos = perp ? parseFloat(perp.marginSummary.totalNtlPos) : 0;
  const withdrawable = perp ? parseFloat(perp.withdrawable) : 0;

  const positions = perp?.assetPositions ?? [];
  const totalUnrealized = positions.reduce((s, p) => s + parseFloat(p.position.unrealizedPnl || "0"), 0);

  const spotBalances = state?.spot?.balances ?? [];
  const liveAge = state?.at ? Math.round((now - new Date(state.at).getTime()) / 1000) : null;
  const isFresh = liveAge != null && liveAge < 20;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10.5px] text-muted-2">
          <span className={clsx("inline-block w-1.5 h-1.5 rounded-full", isFresh ? "bg-green animate-pulse" : "bg-muted-2")} />
          <span>Live · refreshes every 15s</span>
          {state?.at && <span>· updated {relTime(now, state.at)}</span>}
        </div>
        <button
          onClick={() => mutateState()}
          className="px-3 py-1 rounded-[4px] border border-border hover:border-accent text-[10.5px] tracking-wide transition-colors"
        >
          Refresh now
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Account Value" value={fmtCurrency(combined, "USD")} compact />
        <Kpi label="Perp / Spot" value={`${fmtCurrency(perpAccountValue, "USD")} · ${fmtCurrency(spotValue, "USD")}`} compact />
        <Kpi label="Unrealized P&L" value={fmtCurrency(totalUnrealized, "USD")} deltaClass={signClass(totalUnrealized)} compact />
        <Kpi label="Withdrawable" value={fmtCurrency(withdrawable, "USD")} compact />
      </div>

      <Panel
        title="Open Perp Positions"
        subtitle={state?.address ? `${state.address.slice(0, 6)}…${state.address.slice(-4)} · notional ${fmtCurrency(totalPos, "USD")}` : undefined}
        actions={
          <button
            onClick={resync}
            disabled={busy}
            className="px-3 py-1 rounded-[4px] border border-border hover:border-accent text-[11px] tracking-wide transition-colors disabled:opacity-50"
          >
            {busy ? "Syncing…" : "Sync fills"}
          </button>
        }
      >
        {isLoading && <div className="text-muted text-[11px]">Loading…</div>}
        {!isLoading && positions.length === 0 && (
          <div className="text-muted text-[11px]">No open perp positions. Spot balances shown below.</div>
        )}
        {positions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[11.5px] tabular-nums">
              <thead className="text-muted text-[10px] uppercase tracking-[0.14em] border-b border-border">
                <tr>
                  <th className="text-left py-2">Coin</th>
                  <th className="text-right">Size</th>
                  <th className="text-right">Entry</th>
                  <th className="text-right">Notional</th>
                  <th className="text-right">Lev</th>
                  <th className="text-right">Liq</th>
                  <th className="text-right">Margin</th>
                  <th className="text-right">uPnL</th>
                  <th className="text-right">ROE</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const szi = parseFloat(p.position.szi);
                  const upnl = parseFloat(p.position.unrealizedPnl);
                  const roe = parseFloat(p.position.returnOnEquity) * 100;
                  const long = szi >= 0;
                  return (
                    <tr key={p.position.coin} className="border-b border-border hover:bg-hover">
                      <td className="py-2 font-semibold">
                        <span
                          className={clsx(
                            "inline-block w-[38px] text-[9.5px] px-1.5 py-0.5 mr-2 rounded border uppercase tracking-wide",
                            long ? "text-green border-green/30" : "text-red border-red/30",
                          )}
                        >
                          {long ? "LONG" : "SHORT"}
                        </span>
                        {p.position.coin}
                      </td>
                      <td className="text-right">{fmtNumber(Math.abs(szi), Math.abs(szi) < 1 ? 4 : 2)}</td>
                      <td className="text-right">
                        {p.position.entryPx ? fmtCurrency(parseFloat(p.position.entryPx), "USD", false) : "—"}
                      </td>
                      <td className="text-right">{fmtCurrency(parseFloat(p.position.positionValue), "USD")}</td>
                      <td className="text-right">{p.position.leverage.value}x</td>
                      <td className="text-right text-muted">
                        {p.position.liquidationPx ? fmtCurrency(parseFloat(p.position.liquidationPx), "USD", false) : "—"}
                      </td>
                      <td className="text-right">{fmtCurrency(parseFloat(p.position.marginUsed), "USD")}</td>
                      <td className={clsx("text-right font-medium", signClass(upnl))}>{fmtCurrency(upnl, "USD")}</td>
                      <td className={clsx("text-right", signClass(roe))}>{fmtPct(roe, 2, true)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {spotBalances.length > 0 && (
        <Panel title="Spot Balances" subtitle={`${fmtCurrency(spotValue, "USD")} across ${spotBalances.length} asset${spotBalances.length === 1 ? "" : "s"}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-[11.5px] tabular-nums">
              <thead className="text-muted text-[10px] uppercase tracking-[0.14em] border-b border-border">
                <tr>
                  <th className="text-left py-2">Coin</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Hold</th>
                  <th className="text-right">Entry Ntl</th>
                  <th className="text-right">USD Value</th>
                </tr>
              </thead>
              <tbody>
                {spotBalances.map((b) => (
                  <tr key={b.coin} className="border-b border-border hover:bg-hover">
                    <td className="py-2 font-semibold">{b.coin}</td>
                    <td className="text-right">{fmtNumber(b.total, 4)}</td>
                    <td className="text-right text-muted">{fmtNumber(b.hold, 4)}</td>
                    <td className="text-right text-muted">{fmtCurrency(b.entryNtl, "USD")}</td>
                    <td className="text-right font-medium">{fmtCurrency(b.usdValue, "USD")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div className="text-[10.5px] text-muted-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          Address: <span className="font-mono">{state?.address}</span>
        </span>
        {sync?.last_sync_at && <span>· Last fill sync {relTime(now, sync.last_sync_at)}</span>}
        {msg && <span className="text-accent">· {msg}</span>}
      </div>
    </div>
  );
}
