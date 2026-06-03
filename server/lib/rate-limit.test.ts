import { describe, it, expect } from 'vitest';
import { RateLimiter } from './rate-limit';

describe('RateLimiter', () => {
  it('allows up to the limit then blocks within the window', () => {
    const rl = new RateLimiter(3, 1000);
    const t = 0;
    expect(rl.hit('ip', t).ok).toBe(true);
    expect(rl.hit('ip', t).ok).toBe(true);
    expect(rl.hit('ip', t).ok).toBe(true);
    const blocked = rl.hit('ip', t);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('resets after the window elapses', () => {
    const rl = new RateLimiter(1, 1000);
    expect(rl.hit('ip', 0).ok).toBe(true);
    expect(rl.hit('ip', 500).ok).toBe(false);
    expect(rl.hit('ip', 1001).ok).toBe(true);
  });

  it('tracks separate keys independently', () => {
    const rl = new RateLimiter(1, 1000);
    expect(rl.hit('a', 0).ok).toBe(true);
    expect(rl.hit('b', 0).ok).toBe(true);
    expect(rl.hit('a', 0).ok).toBe(false);
  });

  it('sweeps expired windows', () => {
    const rl = new RateLimiter(1, 1000);
    rl.hit('a', 0);
    rl.hit('b', 0);
    expect(rl.trackedKeys).toBe(2);
    rl.sweep(2000);
    expect(rl.trackedKeys).toBe(0);
  });
});
