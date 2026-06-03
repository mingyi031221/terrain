// Tiny in-memory TTL + LRU cache. Used to avoid re-calling the LLM for a topic
// (or node) we've already generated — the single biggest lever on quota cost.
// Dependency-free; relies on Map preserving insertion order for LRU eviction.

export class TTLCache<V> {
  private store = new Map<string, { value: V; expires: number }>();

  constructor(
    private readonly maxSize = 300,
    private readonly ttlMs = 24 * 60 * 60 * 1000,
  ) {}

  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    // refresh recency
    this.store.delete(key);
    this.store.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.store.size > this.maxSize) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  get size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}

/** Normalise a topic so trivially-different strings share a cache entry. */
export function normalizeTopic(topic: string): string {
  return topic.trim().replace(/\s+/g, ' ').toLowerCase();
}
