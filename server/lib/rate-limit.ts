// Fixed-window rate limiter, in-memory and dependency-free. Best-effort guard
// so a public link can't burn the free LLM quota in one burst.

export interface RateResult {
  ok: boolean;
  retryAfterMs: number;
}

export class RateLimiter {
  private windows = new Map<string, { count: number; reset: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  hit(key: string, now: number = Date.now()): RateResult {
    let w = this.windows.get(key);
    if (!w || w.reset <= now) {
      w = { count: 0, reset: now + this.windowMs };
      this.windows.set(key, w);
    }
    w.count += 1;
    if (w.count > this.limit) {
      return { ok: false, retryAfterMs: Math.max(0, w.reset - now) };
    }
    return { ok: true, retryAfterMs: 0 };
  }

  /** Drop expired windows so the map can't grow unbounded. */
  sweep(now: number = Date.now()): void {
    for (const [key, w] of this.windows) {
      if (w.reset <= now) this.windows.delete(key);
    }
  }

  get trackedKeys(): number {
    return this.windows.size;
  }
}
