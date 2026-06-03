import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchMap, fetchNodeDetail } from './api';
import type { TerrainMap, TerrainNodeDetail } from '../types';

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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('fetchMap', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns ok with map on 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ map: buildMap() })));
    const result = await fetchMap('Docker');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.map.topic).toBe('Docker');
  });

  it('returns error from server error envelope on non-200', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { code: 'LLM_UNAVAILABLE', message: '生成服务暂时不可用' } }, 502),
        ),
    );
    const result = await fetchMap('Docker');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('LLM_UNAVAILABLE');
      expect(result.message).toBe('生成服务暂时不可用');
    }
  });

  it('returns NETWORK_ERROR on fetch rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    const result = await fetchMap('Docker');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NETWORK_ERROR');
  });

  it('returns ABORTED when signal aborts', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortErr));
    const result = await fetchMap('Docker');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('ABORTED');
  });

  it('returns UNKNOWN when 200 has empty body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));
    const result = await fetchMap('Docker');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('UNKNOWN');
  });
});

function buildDetail(): TerrainNodeDetail {
  return {
    nodeId: 'node-2',
    title: '什么是镜像',
    explanation:
      '这一段在讲的是：镜像就是一份打包好的环境快照，可以反复拿来开新的容器。像冷冻便当，随时拿出来加热都一样。',
    whyThisMatters: '弄清这件事，后面看 docker run 的输出会突然知道在指哪一层。',
    reflectionPrompt: '你上次想"重新来一遍干净环境"的时候是怎么做的？',
    suggestedNextNodeIds: [],
  };
}

describe('fetchNodeDetail', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  const input = { topic: 'Docker', nodeId: 'node-2', nodeTitle: '什么是镜像' };

  it('returns ok with detail on 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: buildDetail() })));
    const result = await fetchNodeDetail(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.detail.nodeId).toBe('node-2');
  });

  it('sends the full input object as JSON body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ detail: buildDetail() }));
    vi.stubGlobal('fetch', fetchSpy);
    await fetchNodeDetail(input);
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(input);
  });

  it('returns error envelope on non-200', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { code: 'NODE_DETAIL_GENERATION_FAILED', message: '节点详情生成失败' } },
            500,
          ),
        ),
    );
    const result = await fetchNodeDetail(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('NODE_DETAIL_GENERATION_FAILED');
      expect(result.message).toBe('节点详情生成失败');
    }
  });

  it('returns NETWORK_ERROR on fetch rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    const result = await fetchNodeDetail(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NETWORK_ERROR');
  });

  it('returns ABORTED when signal aborts', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortErr));
    const result = await fetchNodeDetail(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('ABORTED');
  });

  it('returns UNKNOWN when 200 has empty body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));
    const result = await fetchNodeDetail(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('UNKNOWN');
  });
});
