"use client";

import { SWRConfig } from "swr";

/**
 * Global SWR defaults. Each hook can still override on a per-call basis, but this
 * sets sensible defaults so individual fetches feel snappier:
 *   - revalidateOnFocus: when Jenson tabs back to the app, every SWR key refreshes
 *   - keepPreviousData: new data swaps in without a loading flash
 *   - dedupingInterval: parallel components mounting the same key share one request
 *   - errorRetryCount: auto-retry transient failures twice before giving up
 */
const fetcher = (url: string) =>
  fetch(url, { credentials: "same-origin" }).then(async (r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        keepPreviousData: true,
        dedupingInterval: 8_000,
        errorRetryCount: 2,
        errorRetryInterval: 3_000,
        shouldRetryOnError: (err) => {
          // don't retry 401 (we'll redirect to login)
          const msg = String(err?.message || "");
          return !msg.startsWith("401");
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
