import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { TerrainMap } from '../../types';
import { scatterLayout, GROUND_BAND, MOUNTAIN_SCALE, type ScatterNode } from './layout';
import {
  backgroundUrls,
  mountainUrls,
  decorationUrls,
  walkingCatUrl,
  sleepingCatUrl,
  pick,
} from './assets';

interface Props {
  map: TerrainMap;
  completedNodeIds?: Set<string>;
  /** The node whose detail panel is currently open (subtle ring). */
  activeNodeId?: string;
  /** The node the climber is "on" right now (glow + stars). */
  currentNodeId?: string;
  onNodeClick?: (nodeId: string) => void;
}

const WIDTH = 1000;
const HEIGHT = 640;
const WALK_MS = 700;

// Decoration slots hug the bottom band + lower side edges so cats and nature
// props read as "on the ground" and never visually crowd the peaks — and
// pointer-events:none means they can never block a click or a label.
const DECOR_SLOTS = [
  { x: 0.08, y: 0.93, s: 1.0 },
  { x: 0.26, y: 0.965, s: 0.82 },
  { x: 0.5, y: 0.97, s: 0.9 },
  { x: 0.74, y: 0.96, s: 0.82 },
  { x: 0.92, y: 0.93, s: 1.0 },
  { x: 0.03, y: 0.66, s: 0.78 },
  { x: 0.97, y: 0.6, s: 0.78 },
];

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// translucent label tint that matches each mountain's watercolor colour, so a
// label reads as "belonging to" its peak.
const LABEL_TINT: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: 'rgba(129,178,213,0.62)', border: 'rgba(96,150,194,0.8)', text: '#234a66' },
  green: { bg: 'rgba(143,194,150,0.62)', border: 'rgba(112,172,122,0.8)', text: '#2f5a39' },
  pink: { bg: 'rgba(237,156,168,0.62)', border: 'rgba(224,128,144,0.8)', text: '#893a48' },
  purple: { bg: 'rgba(186,168,219,0.62)', border: 'rgba(158,138,202,0.8)', text: '#4e3d75' },
  yellow: { bg: 'rgba(233,206,132,0.66)', border: 'rgba(211,180,104,0.85)', text: '#735824' },
};
function tintOf(src: string): { bg: string; border: string; text: string } {
  const m = /mountain_(blue|green|pink|purple|yellow)/.exec(src);
  return LABEL_TINT[m?.[1] ?? 'blue'] ?? LABEL_TINT.blue;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

interface XY {
  x: number;
  y: number;
}

export function TerrainMapCanvas({
  map,
  completedNodeIds,
  activeNodeId,
  currentNodeId,
  onNodeClick,
}: Props) {
  // confine nodes to the ground band so every mountain sits on the grass
  const laidOut = useMemo(
    () =>
      scatterLayout(map, {
        width: WIDTH,
        height: HEIGHT,
        bandTop: HEIGHT * GROUND_BAND.top,
        bandBot: HEIGHT * GROUND_BAND.bottom,
      }),
    [map],
  );
  const nodeMap = useMemo(() => new Map(laidOut.map((n) => [n.id, n])), [laidOut]);

  // Safety net: any node with no edges gets a soft (arrow-less) link to its
  // nearest neighbour so nothing is left stranded. The prompt asks the model for
  // a connected graph, so this should rarely fire.
  const orphanLinks = useMemo(() => {
    const deg = new Map<string, number>();
    for (const n of laidOut) deg.set(n.id, 0);
    for (const e of map.edges) {
      deg.set(e.from, (deg.get(e.from) ?? 0) + 1);
      deg.set(e.to, (deg.get(e.to) ?? 0) + 1);
    }
    const links: { from: ScatterNode; to: ScatterNode }[] = [];
    for (const n of laidOut) {
      if ((deg.get(n.id) ?? 0) > 0) continue;
      let nearest: ScatterNode | null = null;
      let best = Infinity;
      for (const m of laidOut) {
        if (m.id === n.id) continue;
        const d = Math.hypot(m.x - n.x, m.y - n.y);
        if (d < best) {
          best = d;
          nearest = m;
        }
      }
      if (nearest) links.push({ from: n, to: nearest });
    }
    return links;
  }, [laidOut, map.edges]);

  const background = backgroundUrls[0];
  const seed = hashSeed(map.topic);

  const reduceMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  // — the climber's cat avatar —
  const [catNodeId, setCatNodeId] = useState<string | null>(null);
  const [catXY, setCatXY] = useState<XY | null>(null);
  const [walking, setWalking] = useState(false);
  const [walkTarget, setWalkTarget] = useState<string | null>(null);
  const [facing, setFacing] = useState<1 | -1>(1);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopWalk = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // place / reset the cat on the current node whenever the map changes
  useEffect(() => {
    stopWalk();
    const home =
      currentNodeId && nodeMap.has(currentNodeId) ? currentNodeId : (laidOut[0]?.id ?? null);
    setCatNodeId(home);
    setCatXY(null);
    setWalking(false);
    setWalkTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => () => stopWalk(), []);

  const homeNode = catNodeId ? nodeMap.get(catNodeId) : undefined;
  const catPos: XY | null = catXY ?? (homeNode ? { x: homeNode.x, y: homeNode.y } : null);

  const walkTo = (node: ScatterNode) => {
    const from: XY = catPos ?? { x: node.x, y: node.y };
    const hasEdge = map.edges.some(
      (e) =>
        (e.from === catNodeId && e.to === node.id) ||
        (e.from === node.id && e.to === catNodeId),
    );
    // follow the trail's gentle arc when a path exists, a shallower one otherwise
    const cx = (from.x + node.x) / 2;
    const cy = (from.y + node.y) / 2 - (hasEdge ? 36 : 22);

    setFacing(node.x >= from.x ? 1 : -1);
    setWalking(true);
    setWalkTarget(node.id);

    // Completion is driven by a timer so the panel reliably opens after the
    // stroll, independent of whether rAF frames fire (e.g. in tests).
    const finish = () => {
      stopWalk();
      setCatXY({ x: node.x, y: node.y });
      setCatNodeId(node.id);
      setWalking(false);
      setWalkTarget(null);
      onNodeClick?.(node.id);
    };
    timerRef.current = setTimeout(finish, WALK_MS);

    // rAF just paints the smooth in-between motion (a gentle hopping arc).
    if (typeof requestAnimationFrame === 'function') {
      const start = nowMs();
      const step = () => {
        const t = Math.min(1, (nowMs() - start) / WALK_MS);
        const e = easeInOutCubic(t);
        const mt = 1 - e;
        const x = mt * mt * from.x + 2 * mt * e * cx + e * e * node.x;
        const baseY = mt * mt * from.y + 2 * mt * e * cy + e * e * node.y;
        const hop = -Math.abs(Math.sin(t * Math.PI * 5)) * 6; // little bouncing steps
        setCatXY({ x, y: baseY + hop });
        if (t < 1) rafRef.current = requestAnimationFrame(step);
        else rafRef.current = null;
      };
      rafRef.current = requestAnimationFrame(step);
    }
  };

  const handleClick = (id: string) => {
    const node = nodeMap.get(id);
    if (!node) return;
    if (walking) return; // let the cat finish its stroll
    if (id === catNodeId) {
      onNodeClick?.(id);
      return;
    }
    if (reduceMotion) {
      setCatXY({ x: node.x, y: node.y });
      setCatNodeId(id);
      onNodeClick?.(id);
      return;
    }
    walkTo(node);
  };

  return (
    <div
      className="world-map"
      role="img"
      aria-label={`${map.topic} 学习地图`}
      style={background ? { backgroundImage: `url("${background}")` } : undefined}
    >
      {/* dependency paths — soft dashed trails + small suggestion arrows */}
      <svg
        className="world-map__paths"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <marker
            id="trail-arrow"
            viewBox="0 0 12 12"
            refX="9"
            refY="6"
            markerWidth="24"
            markerHeight="24"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path className="world-trail__arrowhead" d="M1,1 L11,6 L1,11 L4,6 Z" />
          </marker>
          <marker
            id="trail-arrow-done"
            viewBox="0 0 12 12"
            refX="9"
            refY="6"
            markerWidth="24"
            markerHeight="24"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path
              className="world-trail__arrowhead world-trail__arrowhead--done"
              d="M1,1 L11,6 L1,11 L4,6 Z"
            />
          </marker>
        </defs>
        {map.edges.map((edge, i) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const done =
            (completedNodeIds?.has(edge.from) ?? false) &&
            (completedNodeIds?.has(edge.to) ?? false);
          return <Trail key={`edge-${i}`} from={from} to={to} done={done} />;
        })}
        {orphanLinks.map((link, i) => (
          <Trail key={`orphan-${i}`} from={link.from} to={link.to} done={false} orphan />
        ))}
      </svg>

      {/* decorations — cats & nature props, scattered in the margins, never interactive */}
      <div className="world-map__decor" aria-hidden="true">
        {DECOR_SLOTS.map((slot, i) => {
          const url = pick(decorationUrls, seed * 7 + i * 5 + 1, '');
          if (!url) return null;
          return (
            <img
              key={`decor-${i}`}
              src={url}
              alt=""
              className="world-decor"
              style={{
                left: `${slot.x * 100}%`,
                top: `${slot.y * 100}%`,
                width: `${8 * slot.s}%`,
              }}
            />
          );
        })}
      </div>

      {/* knowledge-point mountains */}
      {laidOut.map((node, i) => {
        const completed = completedNodeIds?.has(node.id) ?? false;
        const current = currentNodeId === node.id;
        const todo = !completed && !current;
        const catHere = node.id === catNodeId || node.id === walkTarget;
        return (
          <Mountain
            key={node.id}
            node={node}
            index={i}
            seed={seed}
            completed={completed}
            active={activeNodeId === node.id}
            current={current}
            showStars={current && catNodeId !== node.id}
            sleeping={todo && !catHere}
            onClick={() => handleClick(node.id)}
          />
        );
      })}

      {/* the climber — a cat that walks the trails */}
      {catPos && walkingCatUrl && (
        <div
          className={walking ? 'world-cat world-cat--walking' : 'world-cat'}
          aria-hidden="true"
          style={{
            left: `${(catPos.x / WIDTH) * 100}%`,
            top: `${(catPos.y / HEIGHT) * 100}%`,
            transform: `translate(-50%, -94%) scaleX(${facing})`,
          }}
        >
          <img src={walkingCatUrl} alt="" className="world-cat__img" />
        </div>
      )}
    </div>
  );
}

function mountainRadius(node: ScatterNode): number {
  return ((90 + node.difficulty * 16) / 2) * 0.9 * MOUNTAIN_SCALE;
}

function Trail({
  from,
  to,
  done,
  orphan = false,
}: {
  from: ScatterNode;
  to: ScatterNode;
  done: boolean;
  orphan?: boolean;
}) {
  // trim both ends to just outside each mountain so the line + arrow never sit
  // under a peak; the arrow then points from prerequisite into successor.
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const rFrom = (orphan ? 28 : mountainRadius(from)) + 2;
  const rTo = (orphan ? 28 : mountainRadius(to)) + (orphan ? 4 : 13);
  const fx = from.x + ux * rFrom;
  const fy = from.y + uy * rFrom;
  const tx = to.x - ux * rTo;
  const ty = to.y - uy * rTo;
  const midX = (fx + tx) / 2;
  const midY = (fy + ty) / 2 - 24;
  const d = `M ${fx} ${fy} Q ${midX} ${midY} ${tx} ${ty}`;

  const cls = ['world-trail', done ? 'world-trail--done' : '', orphan ? 'world-trail--orphan' : '']
    .filter(Boolean)
    .join(' ');
  const markerEnd = orphan
    ? undefined
    : done
      ? 'url(#trail-arrow-done)'
      : 'url(#trail-arrow)';

  return (
    <g className={cls}>
      <path d={d} className="world-trail__line" fill="none" markerEnd={markerEnd} />
    </g>
  );
}

function Mountain({
  node,
  index,
  seed,
  completed,
  active,
  current,
  showStars,
  sleeping,
  onClick,
}: {
  node: ScatterNode;
  index: number;
  seed: number;
  completed: boolean;
  active: boolean;
  current: boolean;
  showStars: boolean;
  sleeping: boolean;
  onClick: () => void;
}) {
  const src = pick(mountainUrls, seed + index, '');
  const tint = tintOf(src);
  const widthPct = (9 + node.difficulty * 1.6) * MOUNTAIN_SCALE; // shrunk to fit the band

  const state = completed ? 'completed' : current ? 'current' : 'todo';
  const className = [
    'world-mountain',
    `world-mountain--${state}`,
    `world-mountain--label-${node.labelDir}`,
    active ? 'world-mountain--active' : '',
    node.required ? 'world-mountain--required' : 'world-mountain--optional',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      data-testid={`map-node-${node.id}`}
      onClick={onClick}
      style={
        {
          left: `${(node.x / WIDTH) * 100}%`,
          top: `${(node.y / HEIGHT) * 100}%`,
          width: `${widthPct}%`,
          '--rise-delay': `${index * 70}ms`,
        } as CSSProperties
      }
      aria-label={`${node.title} — 难度 ${node.difficulty}/5${
        node.required ? '，主干' : '，支线'
      }${completed ? '，已爬过' : current ? '，正在这里' : ''}`}
    >
      <span className="world-mountain__art">
        {src && <img src={src} alt="" className="world-mountain__img" />}
        {sleeping && sleepingCatUrl && (
          <img src={sleepingCatUrl} alt="" className="world-mountain__sleeper" />
        )}
        {completed && (
          <span className="world-mountain__flag" aria-hidden="true">
            🚩
          </span>
        )}
        {showStars && (
          <span className="world-mountain__stars" aria-hidden="true">
            <span className="world-mountain__star world-mountain__star--1">✦</span>
            <span className="world-mountain__star world-mountain__star--2">✧</span>
            <span className="world-mountain__star world-mountain__star--3">✦</span>
          </span>
        )}
      </span>
      <span
        className="world-mountain__label"
        style={{ background: tint.bg, borderColor: tint.border, color: tint.text }}
      >
        {node.title}
      </span>
    </button>
  );
}
