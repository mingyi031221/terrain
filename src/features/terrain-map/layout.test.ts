import { describe, it, expect } from 'vitest';
import {
  layoutMap,
  scatterLayout,
  nodeBounds,
  pickCoreIndex,
  GROUND_BAND,
  type ScatterNode,
  type LabelDir,
} from './layout';
import type { TerrainMap, TerrainNode } from '../../types';

function makeMap(overrides: Partial<TerrainMap> = {}): TerrainMap {
  return {
    version: '1.0',
    topic: 'X',
    generatedAt: '2026-05-28T00:00:00.000Z',
    userPositionLabel: '入门',
    nodes: Array.from({ length: 5 }, (_, i) => ({
      id: `n${i + 1}`,
      title: `t${i + 1}`,
      summary: 's',
      difficulty: 2,
      estimatedMinutes: 30,
      required: true,
    })),
    edges: [
      { from: 'n1', to: 'n2', kind: 'prerequisite' },
      { from: 'n2', to: 'n3', kind: 'prerequisite' },
      { from: 'n3', to: 'n4', kind: 'prerequisite' },
      { from: 'n3', to: 'n5', kind: 'prerequisite' },
    ],
    ...overrides,
  };
}

describe('layoutMap', () => {
  it('returns one entry per node', () => {
    const out = layoutMap(makeMap(), { width: 800, height: 400 });
    expect(out).toHaveLength(5);
  });

  it('roots are at x = padding (leftmost)', () => {
    const out = layoutMap(makeMap(), { width: 800, height: 400, padding: 40 });
    const n1 = out.find((n) => n.id === 'n1');
    expect(n1?.x).toBe(40);
  });

  it('leaves of the deepest path are at rightmost x', () => {
    const out = layoutMap(makeMap(), { width: 800, height: 400, padding: 40 });
    const n4 = out.find((n) => n.id === 'n4');
    const n5 = out.find((n) => n.id === 'n5');
    expect(n4?.x).toBe(760);
    expect(n5?.x).toBe(760);
  });

  it('orphan nodes (no edges) all land at level 0', () => {
    const orphanMap = makeMap({ edges: [] });
    const out = layoutMap(orphanMap, { width: 800, height: 400, padding: 40 });
    out.forEach((n) => expect(n.x).toBe(400)); // maxLevel=0 → center
  });

  it('preserves node properties', () => {
    const out = layoutMap(makeMap(), { width: 800, height: 400 });
    const n1 = out.find((n) => n.id === 'n1');
    expect(n1?.title).toBe('t1');
    expect(n1?.difficulty).toBe(2);
  });

  it('y positions within a level are spread', () => {
    const out = layoutMap(makeMap(), { width: 800, height: 400, padding: 40 });
    const n4 = out.find((n) => n.id === 'n4');
    const n5 = out.find((n) => n.id === 'n5');
    expect(n4?.y).not.toBe(n5?.y);
  });
});

const W = 1000;
const HGT = 640;

// A connected branching DAG (binary tree) shaped like real generator output:
// single root node-1, every node reachable, short Chinese titles.
function nodesMap(count: number, topic = 'X'): TerrainMap {
  const nodes: TerrainNode[] = Array.from({ length: count }, (_, i) => ({
    id: `node-${i + 1}`,
    title: `知识点${i + 1}`,
    summary: 's',
    difficulty: ((i % 4) + 1) as 1 | 2 | 3 | 4 | 5,
    estimatedMinutes: 30,
    required: i < Math.ceil(count / 2),
  }));
  // node i (i>=1) depends on parent floor((i-1)/2) → connected tree, root node-1
  const edges = nodes.slice(1).map((n, i) => ({
    from: nodes[Math.floor(i / 2)].id,
    to: n.id,
    kind: 'prerequisite' as const,
  }));
  return {
    version: '1.0',
    topic,
    generatedAt: '2026-06-03T00:00:00.000Z',
    userPositionLabel: '入门',
    nodes,
    edges,
  };
}

function boxesOverlap(a: ScatterNode, b: ScatterNode, tol = 1): boolean {
  const ba = nodeBounds(a);
  const bb = nodeBounds(b);
  const ox = Math.min(ba.maxX, bb.maxX) - Math.max(ba.minX, bb.minX);
  const oy = Math.min(ba.maxY, bb.maxY) - Math.max(ba.minY, bb.minY);
  return ox > tol && oy > tol;
}

describe('scatterLayout (island)', () => {
  it('places the core node at the canvas centre', () => {
    for (const count of [5, 6, 7, 8]) {
      const map = nodesMap(count);
      const out = scatterLayout(map, { width: W, height: HGT });
      const coreId = map.nodes[pickCoreIndex(map)].id;
      const core = out.find((n) => n.id === coreId)!;
      const dist = Math.hypot(core.x - W / 2, core.y - HGT / 2);
      expect(dist).toBeLessThanOrEqual(60);
    }
  });

  it('produces no overlapping footprints (mountain + label) for 5–8 nodes', () => {
    for (const count of [5, 6, 7, 8]) {
      const out = scatterLayout(nodesMap(count), { width: W, height: HGT });
      for (let i = 0; i < out.length; i++) {
        for (let j = i + 1; j < out.length; j++) {
          expect(boxesOverlap(out[i], out[j])).toBe(false);
        }
      }
    }
  });

  it('keeps every footprint on-canvas', () => {
    const out = scatterLayout(nodesMap(8), { width: W, height: HGT });
    for (const n of out) {
      const b = nodeBounds(n);
      expect(b.minX).toBeGreaterThanOrEqual(-1);
      expect(b.minY).toBeGreaterThanOrEqual(-1);
      expect(b.maxX).toBeLessThanOrEqual(W + 1);
      expect(b.maxY).toBeLessThanOrEqual(HGT + 1);
    }
  });

  it('assigns every node a label direction', () => {
    const valid: LabelDir[] = ['down', 'up', 'left', 'right'];
    const out = scatterLayout(nodesMap(7), { width: W, height: HGT });
    for (const n of out) expect(valid).toContain(n.labelDir);
  });

  it('is deterministic: same map yields identical coordinates + label dirs', () => {
    const m = nodesMap(7, 'Docker');
    const a = scatterLayout(m, { width: W, height: HGT });
    const b = scatterLayout(m, { width: W, height: HGT });
    expect(a.map((n) => [n.id, n.x, n.y, n.labelDir])).toEqual(
      b.map((n) => [n.id, n.x, n.y, n.labelDir]),
    );
  });

  it('varies by topic seed (different topics scatter differently)', () => {
    const a = scatterLayout(nodesMap(7, 'Docker'), { width: W, height: HGT });
    const b = scatterLayout(nodesMap(7, '回归分析'), { width: W, height: HGT });
    const same = a.every((n, i) => n.x === b[i].x && n.y === b[i].y);
    expect(same).toBe(false);
  });

  // — ground-band mode (what the app uses, so mountains sit on the grass) —
  it('band mode: confines nodes to the ground band, no overlap, core centred in band', () => {
    const bandTop = HGT * GROUND_BAND.top;
    const bandBot = HGT * GROUND_BAND.bottom;
    for (const count of [5, 6, 7, 8]) {
      const map = nodesMap(count);
      const out = scatterLayout(map, { width: W, height: HGT, bandTop, bandBot });
      // every footprint stays within the band (no peaks in the sky)
      for (const n of out) {
        const b = nodeBounds(n);
        expect(b.minY).toBeGreaterThanOrEqual(bandTop - 1);
        expect(b.maxY).toBeLessThanOrEqual(bandBot + 1);
      }
      // no overlaps
      for (let i = 0; i < out.length; i++) {
        for (let j = i + 1; j < out.length; j++) {
          expect(boxesOverlap(out[i], out[j])).toBe(false);
        }
      }
      // core sits at the horizontal centre + band centre
      const coreId = map.nodes[pickCoreIndex(map)].id;
      const core = out.find((n) => n.id === coreId)!;
      const dist = Math.hypot(core.x - W / 2, core.y - (bandTop + bandBot) / 2);
      expect(dist).toBeLessThanOrEqual(70);
    }
  });
});
