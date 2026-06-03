import { describe, it, expect } from 'vitest';
import { topicReducer, initialTopicState, type TopicState } from './topic-reducer';
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
      required: true,
    })),
    edges: [],
  };
}

describe('topicReducer', () => {
  it('initial state is idle', () => {
    expect(initialTopicState).toEqual({ kind: 'idle' });
  });

  it('submit from idle transitions to loading', () => {
    const next = topicReducer({ kind: 'idle' }, { type: 'submit', topic: 'Docker' });
    expect(next).toEqual({ kind: 'loading', topic: 'Docker' });
  });

  it('submit overrides any previous state', () => {
    const prev: TopicState = {
      kind: 'success',
      topic: 'Foo',
      map: buildMap(),
    };
    const next = topicReducer(prev, { type: 'submit', topic: 'Bar' });
    expect(next).toEqual({ kind: 'loading', topic: 'Bar' });
  });

  it('success transitions loading to success', () => {
    const map = buildMap();
    const next = topicReducer({ kind: 'loading', topic: 'Docker' }, { type: 'success', map });
    expect(next).toEqual({ kind: 'success', topic: 'Docker', map });
  });

  it('success is ignored when not loading', () => {
    const prev: TopicState = { kind: 'idle' };
    const next = topicReducer(prev, { type: 'success', map: buildMap() });
    expect(next).toBe(prev);
  });

  it('error transitions loading to error', () => {
    const next = topicReducer(
      { kind: 'loading', topic: 'Docker' },
      { type: 'error', code: 'LLM_UNAVAILABLE', message: 'oops' },
    );
    expect(next).toEqual({
      kind: 'error',
      topic: 'Docker',
      code: 'LLM_UNAVAILABLE',
      message: 'oops',
    });
  });

  it('error is ignored when not loading', () => {
    const prev: TopicState = { kind: 'idle' };
    const next = topicReducer(prev, { type: 'error', code: 'X', message: 'y' });
    expect(next).toBe(prev);
  });

  it('reset returns to idle from any state', () => {
    expect(
      topicReducer({ kind: 'error', topic: 't', code: 'c', message: 'm' }, { type: 'reset' }),
    ).toEqual({ kind: 'idle' });
  });
});
