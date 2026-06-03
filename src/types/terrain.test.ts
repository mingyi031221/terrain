import { describe, it, expect } from 'vitest';
import {
  TerrainMapSchema,
  TerrainNodeDetailSchema,
  type TerrainMap,
  type TerrainNodeDetail,
} from './terrain';

function makeValidMap(): TerrainMap {
  return {
    version: '1.0',
    topic: 'Docker',
    generatedAt: '2026-05-27T10:00:00Z',
    userPositionLabel: '入门',
    nodes: Array.from({ length: 5 }, (_, i) => ({
      id: `n${i + 1}`,
      title: `节点 ${i + 1}`,
      summary: 'summary',
      difficulty: 2 as const,
      estimatedMinutes: 30,
      required: i === 0,
    })),
    edges: [
      { from: 'n1', to: 'n2', kind: 'prerequisite' },
      { from: 'n2', to: 'n3', kind: 'prerequisite' },
    ],
  };
}

function makeValidDetail(): TerrainNodeDetail {
  return {
    nodeId: 'n1',
    title: '容器与镜像',
    explanation:
      '容器是一个隔离的运行环境，镜像是容器的只读模板。理解二者关系是学习 Docker 的第一步，后续所有概念都从这里展开。',
    whyThisMatters: '不弄清这层关系，后面所有命令都像背咒语。',
    reflectionPrompt: '想想你过去用什么方式打包应用环境？',
  };
}

describe('TerrainMapSchema', () => {
  it('accepts a well-formed map with 5 nodes', () => {
    expect(TerrainMapSchema.safeParse(makeValidMap()).success).toBe(true);
  });

  it('accepts up to 8 nodes', () => {
    const m = makeValidMap();
    while (m.nodes.length < 8) {
      m.nodes.push({
        id: `extra-${m.nodes.length}`,
        title: 't',
        summary: 's',
        difficulty: 1,
        estimatedMinutes: 10,
        required: false,
      });
    }
    expect(TerrainMapSchema.safeParse(m).success).toBe(true);
  });

  it('rejects fewer than 5 nodes', () => {
    const m = makeValidMap();
    m.nodes = m.nodes.slice(0, 4);
    expect(TerrainMapSchema.safeParse(m).success).toBe(false);
  });

  it('rejects more than 8 nodes', () => {
    const m = makeValidMap();
    while (m.nodes.length < 9) {
      m.nodes.push({
        id: `extra-${m.nodes.length}`,
        title: 't',
        summary: 's',
        difficulty: 1,
        estimatedMinutes: 10,
        required: false,
      });
    }
    expect(TerrainMapSchema.safeParse(m).success).toBe(false);
  });

  it('rejects difficulty outside 1-5', () => {
    const m = makeValidMap();
    (m.nodes[0] as { difficulty: number }).difficulty = 6;
    expect(TerrainMapSchema.safeParse(m).success).toBe(false);
  });

  it('rejects non-positive estimatedMinutes', () => {
    const m = makeValidMap();
    m.nodes[0].estimatedMinutes = 0;
    expect(TerrainMapSchema.safeParse(m).success).toBe(false);
  });

  it('rejects edges referencing nonexistent nodes', () => {
    const m = makeValidMap();
    m.edges.push({ from: 'n1', to: 'ghost', kind: 'prerequisite' });
    expect(TerrainMapSchema.safeParse(m).success).toBe(false);
  });

  it('rejects self-loop edges', () => {
    const m = makeValidMap();
    m.edges.push({ from: 'n1', to: 'n1', kind: 'prerequisite' });
    expect(TerrainMapSchema.safeParse(m).success).toBe(false);
  });

  it('rejects duplicate node ids', () => {
    const m = makeValidMap();
    m.nodes[1].id = m.nodes[0].id;
    expect(TerrainMapSchema.safeParse(m).success).toBe(false);
  });

  it('rejects empty topic', () => {
    const m = makeValidMap();
    m.topic = '';
    expect(TerrainMapSchema.safeParse(m).success).toBe(false);
  });
});

describe('TerrainNodeDetailSchema', () => {
  it('accepts a well-formed detail', () => {
    expect(TerrainNodeDetailSchema.safeParse(makeValidDetail()).success).toBe(true);
  });

  it('accepts optional suggestedNextNodeIds', () => {
    const d = { ...makeValidDetail(), suggestedNextNodeIds: ['n2', 'n3'] };
    expect(TerrainNodeDetailSchema.safeParse(d).success).toBe(true);
  });

  it('rejects explanation shorter than 50 chars', () => {
    const d = makeValidDetail();
    d.explanation = '太短了';
    expect(TerrainNodeDetailSchema.safeParse(d).success).toBe(false);
  });

  it('rejects missing whyThisMatters', () => {
    const d = makeValidDetail() as Partial<TerrainNodeDetail>;
    delete d.whyThisMatters;
    expect(TerrainNodeDetailSchema.safeParse(d).success).toBe(false);
  });

  it('rejects empty nodeId', () => {
    const d = makeValidDetail();
    d.nodeId = '';
    expect(TerrainNodeDetailSchema.safeParse(d).success).toBe(false);
  });
});
