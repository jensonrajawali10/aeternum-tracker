"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Density = "comfortable" | "compact";

interface DensityContextValue {
  density: Density;
  setDensity: (d: Density) => void;
  toggle: () => void;
}

const DensityContext = createContext<DensityContextValue | null>(null);

const STORAGE_KEY = "ae-density";

/**
 * Density provider — keeps "comfortable" (default) or "compact" in
 * localStorage and reflects the choice on `<html data-density=…>`.
 * CSS in globals.css reads that attr and tightens padding + font
 * sizes for compact.
 *
 * Lazy init reads localStorage synchronously at mount, then the
 * useEffect syncs the root attribute and listens for cross-tab
 * changes via the `storage` event.
 */
export function DensityProvider({ children }: { children: ReactNode }) {
  // Lazy init reads localStorage once at mount.  On the server it falls
  // through to "comfortable" because window is undefined; the client
  // hydrates with the stored value in the same render — no useEffect +
  // setState dance that React 19 purity rules would flag.
  const [density, setDensityState] = useState<Density>(() => {
    if (typeof window === "undefined") return "comfortable";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "compact" ? "compact" : "comfortable";
  });

  // Sync external systems (DOM + localStorage) whenever density changes —
  // this is the canonical "update external system from React state" pattern.
  useEffect(() => {
    document.documentElement.dataset.density = density;
    window.localStorage.setItem(STORAGE_KEY, density);
  }, [density]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      if (e.newValue === "compact" || e.newValue === "comfortable") {
        setDensityState(e.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setDensity = useCallback((d: Density) => setDensityState(d), []);
  const toggle = useCallback(
    () => setDensityState((d) => (d === "compact" ? "comfortable" : "compact")),
    [],
  );

  return (
    <DensityContext.Provider value={{ density, setDensity, toggle }}>
      {children}
    </DensityContext.Provider>
  );
}

export function useDensity(): DensityContextValue {
  const ctx = useContext(DensityContext);
  if (!ctx) {
    // Graceful fallback so components don't crash if the provider is missing —
    // renders as comfortable and no-ops the toggle.
    return { density: "comfortable", setDensity: () => {}, toggle: () => {} };
  }
  return ctx;
}
