import { describe, it, expect, vi, afterEach } from 'vitest';
import { TTLCache, normalizeTopic } from './cache';

afterEach(() => vi.useRealTimers());

describe('TTLCache', () => {
  it('stores and retrieves values', () => {
    const c = new TTLCache<number>();
    c.set('a', 1);
    expect(c.get('a')).toBe(1);
    expect(c.get('missing')).toBeUndefined();
  });

  it('expires entries after the TTL', () => {
    vi.useFakeTimers();
    const c = new TTLCache<number>(100, 1000);
    c.set('a', 1);
    vi.advanceTimersByTime(999);
    expect(c.get('a')).toBe(1);
    vi.advanceTimersByTime(2);
    expect(c.get('a')).toBeUndefined();
  });

  it('evicts least-recently-used entries past maxSize', () => {
    const c = new TTLCache<number>(2);
    c.set('a', 1);
    c.set('b', 2);
    c.get('a'); // 'a' is now most-recent → 'b' is LRU
    c.set('c', 3);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(1);
    expect(c.get('c')).toBe(3);
  });
});

describe('normalizeTopic', () => {
  it('trims, collapses whitespace and lowercases', () => {
    expect(normalizeTopic('  Docker  ')).toBe('docker');
    expect(normalizeTopic('我想  搞懂   Docker')).toBe('我想 搞懂 docker');
  });
});
