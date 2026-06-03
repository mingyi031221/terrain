import { describe, it, expect } from 'vitest';
import { parseTerrainMap } from './terrain';
import { parseTerrainNodeDetail } from './node-detail';

describe('parseTerrainMap', () => {
  it('returns ok for a valid map', () => {
    const map = {
      version: '1.0',
      topic: 'Docker',
      generatedAt: '2026-05-27T10:00:00Z',
      userPositionLabel: '入门',
      nodes: Array.from({ length: 5 }, (_, i) => ({
        id: `n${i + 1}`,
        title: `节点 ${i + 1}`,
        summary: 's',
        difficulty: 1,
        estimatedMinutes: 10,
        required: false,
      })),
      edges: [],
    };
    const r = parseTerrainMap(map);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.nodes).toHaveLength(5);
  });

  it('returns formatted error for invalid input', () => {
    const r = parseTerrainMap({ topic: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });
});

describe('parseTerrainNodeDetail', () => {
  it('returns ok for a valid detail', () => {
    const detail = {
      nodeId: 'n1',
      title: '容器与镜像',
      explanation:
        '容器与镜像是 Docker 的两个最基础概念，容器是运行实例，镜像是只读模板。把握这点是后续所有内容的前提。',
      whyThisMatters: '不弄清就背命令。',
      reflectionPrompt: '你以前怎么打包环境？',
    };
    expect(parseTerrainNodeDetail(detail).ok).toBe(true);
  });

  it('returns formatted error for invalid input', () => {
    const r = parseTerrainNodeDetail({ nodeId: 'n1' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });
});
