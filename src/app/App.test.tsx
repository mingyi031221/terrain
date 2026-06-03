// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import App from './App';
import type { TerrainMap, TerrainNodeDetail } from '../types';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

beforeEach(() => {
  window.localStorage.clear();
});

function buildMap(): TerrainMap {
  return {
    version: '1.0',
    topic: 'Docker',
    generatedAt: '2026-05-28T00:00:00.000Z',
    userPositionLabel: '听过术语但没串起来',
    nodes: Array.from({ length: 5 }, (_, i) => ({
      id: `node-${i + 1}`,
      title: `节点${i + 1}`,
      summary: 's',
      difficulty: 2,
      estimatedMinutes: 30,
      required: i < 3,
    })),
    edges: [{ from: 'node-1', to: 'node-2', kind: 'prerequisite' }],
  };
}

function buildDetail(nodeId = 'node-2'): TerrainNodeDetail {
  return {
    nodeId,
    title: '节点2',
    explanation:
      '这一段在讲的是：节点 2 的内容。你可以先这样理解：它和前一节是连着的，一旦你绕过去后面就要回头补。一些铺垫话填到 50 字以上。',
    whyThisMatters: '弄清这件事，后面节点你会顺。',
    reflectionPrompt: '上次你卡在类似的事，是怎么处理的？',
    suggestedNextNodeIds: [],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('App integration', () => {
  it('renders idle empty-state on first load', () => {
    render(<App />);
    expect(screen.getByText(/先随便写一个/)).toBeTruthy();
    expect(screen.getByText('我想搞懂 Docker')).toBeTruthy();
  });

  it('submits a topic, renders the map, opens a node, then toggles completion (full happy path)', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/terrain/map')) {
        return jsonResponse({ map: buildMap() });
      }
      if (url.includes('/api/terrain/node-detail')) {
        return jsonResponse({ detail: buildDetail() });
      }
      throw new Error('unexpected url: ' + url);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    // submit topic
    fireEvent.change(screen.getByLabelText('学习主题'), { target: { value: 'Docker' } });
    fireEvent.click(screen.getByText('生成地图'));

    // wait for map to render
    await waitFor(() => screen.getByText('听过术语但没串起来'));
    expect(screen.getByTestId('map-node-node-2')).toBeTruthy();

    // click node
    fireEvent.click(screen.getByTestId('map-node-node-2'));

    // wait for detail panel
    await waitFor(() => screen.getByText(/这一段在讲的是/));
    expect(screen.getByText('弄清这件事，后面节点你会顺。')).toBeTruthy();
    expect(screen.getByText('上次你卡在类似的事，是怎么处理的？')).toBeTruthy();

    // toggle complete
    fireEvent.click(screen.getByText('我爬过这一段了'));
    await waitFor(() => screen.getByText(/已爬过/));

    // persistence: completed node id should be in storage
    const stored = window.localStorage.getItem('terrain:session:v1');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string);
    expect(parsed.completedNodeIds).toEqual(['node-2']);
    expect(parsed.topic).toBe('Docker');
  });

  it('shows error state and retry button when map fetch fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ error: { code: 'LLM_UNAVAILABLE', message: '生成服务暂时不可用' } }, 502),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    fireEvent.change(screen.getByLabelText('学习主题'), { target: { value: 'Docker' } });
    fireEvent.click(screen.getByText('生成地图'));

    await waitFor(() => screen.getByText('生成服务暂时不可用'));
    expect(screen.getByText(/重试「Docker」/)).toBeTruthy();
  });

  it('shows detail error state and recovers via retry', async () => {
    let detailCallCount = 0;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/terrain/map')) {
        return jsonResponse({ map: buildMap() });
      }
      if (url.includes('/api/terrain/node-detail')) {
        detailCallCount++;
        if (detailCallCount === 1) {
          return jsonResponse(
            { error: { code: 'NODE_DETAIL_GENERATION_FAILED', message: '节点详情生成失败' } },
            500,
          );
        }
        return jsonResponse({ detail: buildDetail() });
      }
      throw new Error('unexpected url');
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    fireEvent.change(screen.getByLabelText('学习主题'), { target: { value: 'Docker' } });
    fireEvent.click(screen.getByText('生成地图'));
    await waitFor(() => screen.getByTestId('map-node-node-2'));

    fireEvent.click(screen.getByTestId('map-node-node-2'));
    await waitFor(() => screen.getByText('节点详情生成失败'));

    fireEvent.click(screen.getByText('重试'));
    await waitFor(() => screen.getByText(/这一段在讲的是/));
  });

  it('restores session from localStorage on fresh mount', () => {
    window.localStorage.setItem(
      'terrain:session:v1',
      JSON.stringify({ version: 1, topic: 'Docker', map: buildMap(), completedNodeIds: ['node-3'] }),
    );

    render(<App />);
    // restored map shown immediately, no fetch needed
    expect(screen.getByText('听过术语但没串起来')).toBeTruthy();
    expect(screen.getByTestId('map-node-node-3')).toBeTruthy();
  });

  it('discards corrupt localStorage and falls back to idle', () => {
    window.localStorage.setItem('terrain:session:v1', '{ this is not json');
    render(<App />);
    expect(screen.getByText(/先随便写一个/)).toBeTruthy();
    // corrupt entry was cleared
    expect(window.localStorage.getItem('terrain:session:v1')).toBeNull();
  });

  it('clears completedNodeIds when user submits a new topic', async () => {
    window.localStorage.setItem(
      'terrain:session:v1',
      JSON.stringify({
        version: 1,
        topic: 'OldTopic',
        map: { ...buildMap(), topic: 'OldTopic' },
        completedNodeIds: ['node-1', 'node-2'],
      }),
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ map: { ...buildMap(), topic: 'NewTopic' } }));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    // initially we have completed nodes from old session
    expect(window.localStorage.getItem('terrain:session:v1')).not.toBeNull();

    fireEvent.change(screen.getByLabelText('学习主题'), { target: { value: 'NewTopic' } });
    fireEvent.click(screen.getByText('生成地图'));

    await waitFor(() => screen.getByText('听过术语但没串起来'));

    const stored = window.localStorage.getItem('terrain:session:v1');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string);
    expect(parsed.completedNodeIds).toEqual([]);
    expect(parsed.topic).toBe('NewTopic');
  });
});
