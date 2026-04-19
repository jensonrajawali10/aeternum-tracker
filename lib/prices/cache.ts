const memCache = new Map<string, { price: number; at: number; meta?: Record<string, unknown> }>();
const TTL_MS = 60_000;

export function getCached(key: string): { price: number; at: number; meta?: Record<string, unknown> } | null {
  const hit = memCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    memCache.delete(key);
    return null;
  }
  return hit;
}

export function setCached(key: string, price: number, meta?: Record<string, unknown>): void {
  memCache.set(key, { price, at: Date.now(), meta });
}

export function clearCache(): void {
  memCache.clear();
}
