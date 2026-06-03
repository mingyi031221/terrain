import { describe, it, expect, beforeEach } from 'vitest';
import { loadPrompt, renderPrompt, clearPromptCache } from './loader';

describe('loadPrompt', () => {
  beforeEach(() => clearPromptCache());

  it('loads map.v1 with non-empty content', () => {
    const content = loadPrompt('map.v1');
    expect(content.length).toBeGreaterThan(100);
    expect(content).toContain('{{topic}}');
  });

  it('throws on nonexistent prompt', () => {
    expect(() => loadPrompt('does-not-exist')).toThrow();
  });

  it('caches across calls (returns same reference)', () => {
    const a = loadPrompt('map.v1');
    const b = loadPrompt('map.v1');
    expect(a).toBe(b);
  });

  it('loads node-detail.v1 with required placeholders', () => {
    const content = loadPrompt('node-detail.v1');
    expect(content.length).toBeGreaterThan(100);
    expect(content).toContain('{{topic}}');
    expect(content).toContain('{{nodeTitle}}');
    expect(content).toContain('{{nodeId}}');
  });
});

describe('renderPrompt', () => {
  it('substitutes a single variable', () => {
    expect(renderPrompt('hello {{name}}', { name: 'world' })).toBe('hello world');
  });

  it('substitutes multiple occurrences', () => {
    expect(renderPrompt('{{x}}-{{x}}-{{y}}', { x: 'a', y: 'b' })).toBe('a-a-b');
  });

  it('throws on unknown variable', () => {
    expect(() => renderPrompt('{{foo}}', {})).toThrow(/foo/);
  });

  it('leaves text without placeholders untouched', () => {
    expect(renderPrompt('plain text', {})).toBe('plain text');
  });
});
