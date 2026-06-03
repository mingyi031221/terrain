import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateMap, MapGenerationError, ensureConnected } from './map-generator';
import { chatComplete } from './llm-client';
import type { TerrainMap } from '../../src/types';

vi.mock('./llm-client', () => ({
  chatComplete: vi.fn(),
  LLMUnavailableError: class LLMUnavailableError extends Error {
    constructor(
      public kind: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

const mockedChatComplete = vi.mocked(chatComplete);

function validDraft() {
  return {
    topic: 'Docker',
    userPositionLabel: '听过术语但没串起来',
    nodes: Array.from({ length: 5 }, (_, i) => ({
      id: `node-${i + 1}`,
      title: `节点 ${i + 1}`,
      summary: '概要',
      difficulty: 2,
      estimatedMinutes: 30,
      required: i < 3,
    })),
    edges: [
      { from: 'node-1', to: 'node-2', kind: 'prerequisite' },
      { from: 'node-2', to: 'node-3', kind: 'prerequisite' },
    ],
  };
}

describe('generateMap', () => {
  beforeEach(() => {
    mockedChatComplete.mockReset();
  });

  it('returns a TerrainMap on first valid response', async () => {
    mockedChatComplete.mockResolvedValueOnce(JSON.stringify(validDraft()));
    const map = await generateMap('Docker');
    expect(map.topic).toBe('Docker');
    expect(map.version).toBe('1.0');
    expect(map.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(map.nodes).toHaveLength(5);
    expect(mockedChatComplete).toHaveBeenCalledTimes(1);
  });

  it('retries once on invalid JSON then succeeds', async () => {
    mockedChatComplete
      .mockResolvedValueOnce('not json {')
      .mockResolvedValueOnce(JSON.stringify(validDraft()));
    const map = await generateMap('Docker');
    expect(map.nodes).toHaveLength(5);
    expect(mockedChatComplete).toHaveBeenCalledTimes(2);
  });

  it('retries once on schema failure then succeeds', async () => {
    mockedChatComplete
      .mockResolvedValueOnce(JSON.stringify({ topic: 'X', nodes: [], edges: [] }))
      .mockResolvedValueOnce(JSON.stringify(validDraft()));
    const map = await generateMap('Docker');
    expect(map.nodes).toHaveLength(5);
    expect(mockedChatComplete).toHaveBeenCalledTimes(2);
  });

  it('throws MapGenerationError after two failed attempts', async () => {
    mockedChatComplete
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce(JSON.stringify({ topic: 'X', nodes: [], edges: [] }));
    await expect(generateMap('Docker')).rejects.toBeInstanceOf(MapGenerationError);
    expect(mockedChatComplete).toHaveBeenCalledTimes(2);
  });

  it('passes signal through to chatComplete', async () => {
    mockedChatComplete.mockResolvedValueOnce(JSON.stringify(validDraft()));
    const controller = new AbortController();
    await generateMap('Docker', { signal: controller.signal });
    expect(mockedChatComplete).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('uses LLM_MODEL_MAP env var', async () => {
    vi.stubEnv('LLM_MODEL_MAP', 'qwen-test');
    mockedChatComplete.mockResolvedValueOnce(JSON.stringify(validDraft()));
    await generateMap('Docker');
    expect(mockedChatComplete).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'qwen-test' }),
    );
    vi.unstubAllEnvs();
  });

  it('includes feedback in retry prompt', async () => {
    mockedChatComplete
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce(JSON.stringify(validDraft()));
    await generateMap('Docker');
    const secondCall = mockedChatComplete.mock.calls[1][0];
    expect(secondCall.userPrompt).toContain('上次返回出错');
    expect(secondCall.userPrompt).toContain('JSON parse failed');
  });
});

describe('ensureConnected', () => {
  function map(nodeCount: number, edges: [string, string][]): TerrainMap {
    return {
      version: '1.0',
      topic: 'X',
      generatedAt: '2026-06-03T00:00:00.000Z',
      userPositionLabel: '入门',
      nodes: Array.from({ length: nodeCount }, (_, i) => ({
        id: `node-${i + 1}`,
        title: `t${i + 1}`,
        summary: 's',
        difficulty: 2 as const,
        estimatedMinutes: 30,
        required: true,
      })),
      edges: edges.map(([from, to]) => ({ from, to, kind: 'prerequisite' as const })),
    };
  }
  const deg = (m: TerrainMap, id: string) =>
    m.edges.filter((e) => e.from === id || e.to === id).length;

  it('connects an orphan node to the hub with a real edge', () => {
    // node-3 has no edges
    const out = ensureConnected(
      map(3, [
        ['node-1', 'node-2'],
      ]),
    );
    expect(deg(out, 'node-3')).toBeGreaterThan(0);
    // hub is node-1 (root with most out-edges); new edge points from it
    expect(out.edges).toContainEqual({ from: 'node-1', to: 'node-3', kind: 'prerequisite' });
  });

  it('leaves an already-connected graph unchanged', () => {
    const m = map(3, [
      ['node-1', 'node-2'],
      ['node-2', 'node-3'],
    ]);
    expect(ensureConnected(m).edges).toEqual(m.edges);
  });

  it('connects every node when the graph has no edges at all (star from node-1)', () => {
    const out = ensureConnected(map(4, []));
    for (const n of out.nodes) expect(deg(out, n.id)).toBeGreaterThan(0);
    expect(out.edges).toHaveLength(3); // node-1 → 2,3,4
  });
});
