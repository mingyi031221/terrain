import type { TerrainMap, TerrainNode } from '../../types';

export interface LaidOutNode extends TerrainNode {
  x: number;
  y: number;
}

export interface LayoutOptions {
  width: number;
  height: number;
  padding?: number;
  /** Optional vertical band (px) to confine all nodes to — e.g. a "ground" band
   *  so mountains sit on grass instead of floating in the sky. Omit for the full
   *  canvas (radial island spread). */
  bandTop?: number;
  bandBot?: number;
}

/** Which side of the mountain its text label is placed on. */
export type LabelDir = 'down' | 'up' | 'left' | 'right';

export interface ScatterNode extends LaidOutNode {
  /** topological depth (longest path from a root) */
  level: number;
  /** the emptiest side to place this node's label so it never gets covered */
  labelDir: LabelDir;
}

/** Deterministic pseudo-random in [0, 1) from a string + salt. Stable per node id. */
function hash01(input: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function computeLevels(map: TerrainMap): Map<string, number> {
  const adj = new Map<string, string[]>();
  for (const edge of map.edges) {
    const list = adj.get(edge.from) ?? [];
    list.push(edge.to);
    adj.set(edge.from, list);
  }

  const incoming = new Map<string, number>();
  for (const node of map.nodes) incoming.set(node.id, 0);
  for (const edge of map.edges) incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);

  const levels = new Map<string, number>();
  const queue: string[] = [];
  for (const node of map.nodes) {
    if ((incoming.get(node.id) ?? 0) === 0) {
      levels.set(node.id, 0);
      queue.push(node.id);
    }
  }
  while (queue.length > 0) {
    const id = queue.shift() as string;
    const current = levels.get(id) ?? 0;
    for (const childId of adj.get(id) ?? []) {
      const candidate = current + 1;
      if ((levels.get(childId) ?? -1) < candidate) {
        levels.set(childId, candidate);
        queue.push(childId);
      }
    }
  }
  for (const node of map.nodes) if (!levels.has(node.id)) levels.set(node.id, 0);
  return levels;
}

// ————————————————————————————————————————————————————————————————
//  Island-map layout: core node in the middle, everything else fanned
//  evenly around it, with each label parked on its emptiest side so no
//  name is ever covered. Canvas is isotropic (1 x-unit == 1 y-unit since
//  the container aspect-ratio equals width/height), so plain distances work.
// ————————————————————————————————————————————————————————————————

/** Ground band (fraction of canvas height) to confine mountains to, so they sit
 *  on the grass instead of floating in the sky. Pass to scatterLayout via
 *  bandTop/bandBot. */
export const GROUND_BAND = { top: 0.4, bottom: 0.94 } as const;

/** Mountain size multiplier — shrinks peaks so 5–8 of them + their labels-below
 *  fit the ground band without crowding. The renderer must use the SAME scale. */
export const MOUNTAIN_SCALE = 0.78;

const LABEL_H = 28; // label capsule height in layout units
const LABEL_GAP = 8; // gap between mountain and its label

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function mountainHalf(difficulty: number): { halfW: number; halfH: number } {
  const w = (90 + difficulty * 16) * MOUNTAIN_SCALE; // matches CSS widthPct * scale
  return { halfW: w / 2, halfH: (w * 0.9) / 2 };
}

function labelHalfW(title: string): number {
  // smaller font now (~0.72rem); CSS caps the capsule at max-width 150px.
  return clamp(title.length * 12.5 + 20, 60, 150) / 2;
}

/** Just the label rectangle, for the chosen side. */
function labelRect(x: number, y: number, difficulty: number, title: string, dir: LabelDir): Box {
  const m = mountainHalf(difficulty);
  const lhw = labelHalfW(title);
  const lhh = LABEL_H / 2;
  if (dir === 'down') {
    const c = y + m.halfH + LABEL_GAP + lhh;
    return { minX: x - lhw, maxX: x + lhw, minY: c - lhh, maxY: c + lhh };
  }
  if (dir === 'up') {
    const c = y - m.halfH - LABEL_GAP - lhh;
    return { minX: x - lhw, maxX: x + lhw, minY: c - lhh, maxY: c + lhh };
  }
  if (dir === 'left') {
    const c = x - m.halfW - LABEL_GAP - lhw;
    return { minX: c - lhw, maxX: c + lhw, minY: y - lhh, maxY: y + lhh };
  }
  const c = x + m.halfW + LABEL_GAP + lhw;
  return { minX: c - lhw, maxX: c + lhw, minY: y - lhh, maxY: y + lhh };
}

/** Mountain box ∪ label box — the node's whole footprint, used for collisions. */
function unionBox(x: number, y: number, difficulty: number, title: string, dir: LabelDir): Box {
  const m = mountainHalf(difficulty);
  const l = labelRect(x, y, difficulty, title, dir);
  return {
    minX: Math.min(x - m.halfW, l.minX),
    maxX: Math.max(x + m.halfW, l.maxX),
    minY: Math.min(y - m.halfH, l.minY),
    maxY: Math.max(y + m.halfH, l.maxY),
  };
}

/** Public: a laid-out node's full footprint box (mountain + label). */
export function nodeBounds(node: ScatterNode): Box {
  return unionBox(node.x, node.y, node.difficulty, node.title, node.labelDir);
}

/**
 * The core node: a most-foundational entry point. Prefer nodes with no
 * prerequisites (in-degree 0); among those, the one that the most other nodes
 * depend on (largest reachable set), then required, then lowest id — all
 * deterministic.
 */
export function pickCoreIndex(map: TerrainMap): number {
  const idx = new Map(map.nodes.map((n, i) => [n.id, i]));
  const out = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const n of map.nodes) indeg.set(n.id, 0);
  for (const e of map.edges) {
    out.set(e.from, [...(out.get(e.from) ?? []), e.to]);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  }
  const reach = (start: string): number => {
    const seen = new Set<string>();
    const stack = [start];
    while (stack.length) {
      const u = stack.pop() as string;
      for (const v of out.get(u) ?? []) {
        if (!seen.has(v)) {
          seen.add(v);
          stack.push(v);
        }
      }
    }
    return seen.size;
  };
  const roots = map.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0);
  const pool = roots.length ? roots : map.nodes;
  let best = pool[0];
  let bestKey = [-1, 0, ''] as [number, number, string];
  for (const n of pool) {
    const key: [number, number, string] = [reach(n.id), n.required ? 1 : 0, n.id];
    if (
      key[0] > bestKey[0] ||
      (key[0] === bestKey[0] && key[1] > bestKey[1]) ||
      (key[0] === bestKey[0] && key[1] === bestKey[1] && key[2] < bestKey[2])
    ) {
      bestKey = key;
      best = n;
    }
  }
  return idx.get(best.id) ?? 0;
}

/**
 * Island layout: core pinned to centre, the rest seeded on rings by graph
 * distance then relaxed with repulsion + edge springs + a gentle centring
 * force, and finally separated so no two footprints (mountain OR label) touch.
 * Each label is parked on its emptiest side. Pure function of (topic, nodes,
 * edges) → never reshuffles on refresh. Produces x/y + labelDir only; the
 * rendering, trails, flag and companion cat read these unchanged.
 */
export function scatterLayout(map: TerrainMap, opts: LayoutOptions): ScatterNode[] {
  const W = opts.width;
  const H = opts.height;
  const padding = opts.padding ?? 60;
  const hasBand = opts.bandTop != null && opts.bandBot != null;
  const bandTop = opts.bandTop ?? 0;
  const bandBot = opts.bandBot ?? H;
  const cx = W / 2;
  const cy = hasBand ? (bandTop + bandBot) / 2 : H / 2;
  const nodes = map.nodes;
  const n = nodes.length;
  const levels = computeLevels(map);
  const seed = map.topic;

  const idToIdx = new Map(nodes.map((nd, i) => [nd.id, i]));
  const adj: number[][] = nodes.map(() => []);
  for (const e of map.edges) {
    const a = idToIdx.get(e.from);
    const b = idToIdx.get(e.to);
    if (a == null || b == null) continue;
    adj[a].push(b);
    adj[b].push(a);
  }

  const core = pickCoreIndex(map);
  const diffOf = (i: number) => nodes[i].difficulty;
  const titleOf = (i: number) => nodes[i].title;

  // graph distance from core (undirected); disconnected nodes go on the outer ring
  const dist = new Array<number>(n).fill(Infinity);
  dist[core] = 0;
  const queue = [core];
  while (queue.length) {
    const u = queue.shift() as number;
    for (const v of adj[u]) {
      if (!isFinite(dist[v])) {
        dist[v] = dist[u] + 1;
        queue.push(v);
      }
    }
  }
  const finiteMax = Math.max(1, ...dist.filter((d) => isFinite(d)));
  for (let i = 0; i < n; i++) if (!isFinite(dist[i])) dist[i] = finiteMax + 1;
  const D = Math.max(1, ...dist);

  // — seeded ring placement (even fan-out around the centre) —
  const rxMax = W / 2 - padding - 120;
  const ryMax = hasBand ? (bandBot - bandTop) / 2 - 30 : H / 2 - padding - 80;
  const pos = nodes.map(() => ({ x: cx, y: cy }));
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    if (i === core) continue;
    const list = groups.get(dist[i]) ?? [];
    list.push(i);
    groups.set(dist[i], list);
  }
  for (const [d, idxs] of groups) {
    const m = idxs.length;
    const base = hash01(seed + '#ring' + d, 11) * Math.PI * 2 + d * 0.7;
    idxs.forEach((i, k) => {
      const ang = base + (Math.PI * 2 * k) / m;
      const r = d / D;
      pos[i] = { x: cx + Math.cos(ang) * rxMax * r, y: cy + Math.sin(ang) * ryMax * r };
    });
  }

  // labels always sit directly below their mountain — clearest association, and
  // the relaxation below spreads nodes so the below-labels never collide.
  const dirs: LabelDir[] = nodes.map(() => 'down');

  // — force + hard-collision relaxation (deterministic) —
  const REP = 150000;
  const SPRING = 0.02;
  const L = 235;
  const CENTER = 0.003;
  const STEP = 0.85;
  const MAX_MOVE = 42;
  const MARGIN = 10;
  const ITERS = 320;
  const inset = 6;

  for (let it = 0; it < ITERS; it++) {
    const fx = new Array<number>(n).fill(0);
    const fy = new Array<number>(n).fill(0);

    // repulsion between all pairs
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[j].x - pos[i].x;
        let dy = pos[j].y - pos[i].y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          dx = (hash01(seed + i + '_' + j, 5) - 0.5) || 0.1;
          dy = (hash01(seed + j + '_' + i, 9) - 0.5) || 0.1;
          d2 = dx * dx + dy * dy;
        }
        const d = Math.sqrt(d2);
        const f = Math.min(REP / d2, 60);
        fx[i] -= (f * dx) / d;
        fy[i] -= (f * dy) / d;
        fx[j] += (f * dx) / d;
        fy[j] += (f * dy) / d;
      }
    }
    // edge springs toward an ideal length
    for (const e of map.edges) {
      const a = idToIdx.get(e.from);
      const b = idToIdx.get(e.to);
      if (a == null || b == null) continue;
      const dx = pos[b].x - pos[a].x;
      const dy = pos[b].y - pos[a].y;
      const d = Math.hypot(dx, dy) + 0.001;
      const f = (d - L) * SPRING;
      fx[a] += (f * dx) / d;
      fy[a] += (f * dy) / d;
      fx[b] -= (f * dx) / d;
      fy[b] -= (f * dy) / d;
    }
    // gentle pull toward centre (keeps the cluster from drifting to a corner)
    for (let i = 0; i < n; i++) {
      fx[i] += (cx - pos[i].x) * CENTER;
      fy[i] += (cy - pos[i].y) * CENTER;
    }
    // integrate (core stays pinned at the centre)
    for (let i = 0; i < n; i++) {
      if (i === core) continue;
      let mx = fx[i] * STEP;
      let my = fy[i] * STEP;
      const mm = Math.hypot(mx, my);
      if (mm > MAX_MOVE) {
        mx *= MAX_MOVE / mm;
        my *= MAX_MOVE / mm;
      }
      pos[i].x += mx;
      pos[i].y += my;
    }
    pos[core] = { x: cx, y: cy };

    // hard separation of footprint boxes (mountain ∪ label)
    for (let s = 0; s < 4; s++) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const bi = unionBox(pos[i].x, pos[i].y, diffOf(i), titleOf(i), dirs[i]);
          const bj = unionBox(pos[j].x, pos[j].y, diffOf(j), titleOf(j), dirs[j]);
          const icx = (bi.minX + bi.maxX) / 2;
          const icy = (bi.minY + bi.maxY) / 2;
          const jcx = (bj.minX + bj.maxX) / 2;
          const jcy = (bj.minY + bj.maxY) / 2;
          const ihw = (bi.maxX - bi.minX) / 2;
          const ihh = (bi.maxY - bi.minY) / 2;
          const jhw = (bj.maxX - bj.minX) / 2;
          const jhh = (bj.maxY - bj.minY) / 2;
          const ox = ihw + jhw + MARGIN - Math.abs(jcx - icx);
          const oy = ihh + jhh + MARGIN - Math.abs(jcy - icy);
          if (ox > 0 && oy > 0) {
            let dix = 0;
            let diy = 0;
            let djx = 0;
            let djy = 0;
            if (ox <= oy) {
              const sgn = jcx - icx >= 0 ? 1 : -1;
              dix = -(ox / 2) * sgn;
              djx = (ox / 2) * sgn;
            } else {
              const sgn = jcy - icy >= 0 ? 1 : -1;
              diy = -(oy / 2) * sgn;
              djy = (oy / 2) * sgn;
            }
            // a pinned core never moves — the other takes the full push
            if (i === core) {
              pos[j].x += djx - dix;
              pos[j].y += djy - diy;
            } else if (j === core) {
              pos[i].x += dix - djx;
              pos[i].y += diy - djy;
            } else {
              pos[i].x += dix;
              pos[i].y += diy;
              pos[j].x += djx;
              pos[j].y += djy;
            }
          }
        }
      }
    }

    // keep every footprint inside the canvas (or the ground band, if set)
    const yLo = hasBand ? bandTop : inset;
    const yHi = hasBand ? bandBot : H - inset;
    for (let i = 0; i < n; i++) {
      if (i === core) continue;
      const b = unionBox(pos[i].x, pos[i].y, diffOf(i), titleOf(i), dirs[i]);
      if (b.minX < inset) pos[i].x += inset - b.minX;
      if (b.maxX > W - inset) pos[i].x -= b.maxX - (W - inset);
      if (b.minY < yLo) pos[i].y += yLo - b.minY;
      if (b.maxY > yHi) pos[i].y -= b.maxY - yHi;
    }
  }

  return nodes.map((nd, i) => ({
    ...nd,
    x: Math.round(pos[i].x * 10) / 10,
    y: Math.round(pos[i].y * 10) / 10,
    level: levels.get(nd.id) ?? 0,
    labelDir: dirs[i],
  }));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Prerequisite node ids for `nodeId` (direct incoming "prerequisite" edges) that
 * are NOT yet completed. Used for the gentle "先爬过…会更顺" panel hint.
 */
export function incompletePrereqs(
  map: TerrainMap,
  nodeId: string,
  completed: Set<string>,
): TerrainNode[] {
  const fromIds = map.edges.filter((e) => e.to === nodeId).map((e) => e.from);
  return map.nodes.filter((n) => fromIds.includes(n.id) && !completed.has(n.id));
}

/**
 * The node the climber is "on" right now: the first not-completed node (in
 * topological order) whose prerequisites are all done. Falls back to the first
 * not-completed node. Returns null when everything is completed.
 */
export function currentNodeId(map: TerrainMap, completed: Set<string>): string | null {
  const levels = computeLevels(map);
  const ordered = [...map.nodes].sort(
    (a, b) => (levels.get(a.id) ?? 0) - (levels.get(b.id) ?? 0),
  );
  const ready = ordered.find(
    (n) => !completed.has(n.id) && incompletePrereqs(map, n.id, completed).length === 0,
  );
  if (ready) return ready.id;
  const anyUndone = ordered.find((n) => !completed.has(n.id));
  return anyUndone ? anyUndone.id : null;
}

export function layoutMap(map: TerrainMap, opts: LayoutOptions): LaidOutNode[] {
  const padding = opts.padding ?? 40;
  const usableWidth = opts.width - padding * 2;
  const usableHeight = opts.height - padding * 2;

  const adj = new Map<string, string[]>();
  for (const edge of map.edges) {
    const list = adj.get(edge.from) ?? [];
    list.push(edge.to);
    adj.set(edge.from, list);
  }

  const incoming = new Map<string, number>();
  for (const node of map.nodes) incoming.set(node.id, 0);
  for (const edge of map.edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }

  const levels = new Map<string, number>();
  const queue: string[] = [];
  for (const node of map.nodes) {
    if ((incoming.get(node.id) ?? 0) === 0) {
      levels.set(node.id, 0);
      queue.push(node.id);
    }
  }

  while (queue.length > 0) {
    const id = queue.shift() as string;
    const current = levels.get(id) ?? 0;
    for (const childId of adj.get(id) ?? []) {
      const candidate = current + 1;
      if ((levels.get(childId) ?? -1) < candidate) {
        levels.set(childId, candidate);
        queue.push(childId);
      }
    }
  }

  for (const node of map.nodes) {
    if (!levels.has(node.id)) levels.set(node.id, 0);
  }

  const maxLevel = Math.max(...Array.from(levels.values()));
  const byLevel = new Map<number, TerrainNode[]>();
  for (let i = 0; i <= maxLevel; i++) byLevel.set(i, []);
  for (const node of map.nodes) {
    byLevel.get(levels.get(node.id) ?? 0)?.push(node);
  }

  const result: LaidOutNode[] = [];
  for (let lv = 0; lv <= maxLevel; lv++) {
    const nodesAtLevel = byLevel.get(lv) ?? [];
    const x = maxLevel === 0 ? opts.width / 2 : padding + (usableWidth * lv) / maxLevel;
    nodesAtLevel.forEach((node, i) => {
      const y =
        nodesAtLevel.length === 1
          ? opts.height / 2
          : padding + (usableHeight * i) / (nodesAtLevel.length - 1);
      result.push({ ...node, x, y });
    });
  }

  return result;
}
