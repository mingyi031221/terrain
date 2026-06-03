// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveSession,
  loadSession,
  clearSession,
  __STORAGE_KEY,
  type PersistedSession,
} from './persistence';
import type { TerrainMap } from '../types';

function buildMap(): TerrainMap {
  return {
    version: '1.0',
    topic: 'Docker',
    generatedAt: '2026-05-28T00:00:00.000Z',
    userPositionLabel: '入门',
    nodes: Array.from({ length: 5 }, (_, i) => ({
      id: `node-${i + 1}`,
      title: `节点 ${i + 1}`,
      summary: 's',
      difficulty: 2,
      estimatedMinutes: 30,
      required: i < 3,
    })),
    edges: [{ from: 'node-1', to: 'node-2', kind: 'prerequisite' }],
  };
}

function buildSession(overrides: Partial<PersistedSession> = {}): PersistedSession {
  return {
    topic: 'Docker',
    map: buildMap(),
    completedNodeIds: ['node-1'],
    ...overrides,
  };
}

describe('persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saveSession then loadSession round-trip', () => {
    const session = buildSession();
    saveSession(session);
    const loaded = loadSession();
    expect(loaded).toEqual(session);
  });

  it('loadSession returns null when storage is empty', () => {
    expect(loadSession()).toBeNull();
  });

  it('clearSession removes the key', () => {
    saveSession(buildSession());
    clearSession();
    expect(window.localStorage.getItem(__STORAGE_KEY)).toBeNull();
    expect(loadSession()).toBeNull();
  });

  it('loadSession returns null and clears storage on invalid JSON', () => {
    window.localStorage.setItem(__STORAGE_KEY, '{ this is not json');
    expect(loadSession()).toBeNull();
    expect(window.localStorage.getItem(__STORAGE_KEY)).toBeNull();
  });

  it('loadSession returns null and clears storage when schema mismatch', () => {
    window.localStorage.setItem(
      __STORAGE_KEY,
      JSON.stringify({ version: 1, topic: '', map: {}, completedNodeIds: [] }),
    );
    expect(loadSession()).toBeNull();
    expect(window.localStorage.getItem(__STORAGE_KEY)).toBeNull();
  });

  it('loadSession returns null when version is wrong (future schema change)', () => {
    window.localStorage.setItem(
      __STORAGE_KEY,
      JSON.stringify({ ...buildSession(), version: 99 }),
    );
    expect(loadSession()).toBeNull();
  });

  it('handles completedNodeIds being empty', () => {
    const session = buildSession({ completedNodeIds: [] });
    saveSession(session);
    expect(loadSession()).toEqual(session);
  });

  it('persists multiple completedNodeIds', () => {
    const session = buildSession({ completedNodeIds: ['node-1', 'node-3', 'node-5'] });
    saveSession(session);
    expect(loadSession()?.completedNodeIds).toEqual(['node-1', 'node-3', 'node-5']);
  });
});
