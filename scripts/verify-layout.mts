// Verify the island layout on real generated maps:
//   • core node sits at/near the canvas centre
//   • no two footprints (mountain ∪ label) overlap  → no covered labels
//   • every footprint stays on-canvas
//   • report any orphan nodes (degree 0) — the render adds a soft fallback link
// Run: npx tsx scripts/verify-layout.mts
import { readFileSync } from 'node:fs';
import {
  scatterLayout,
  nodeBounds,
  pickCoreIndex,
  GROUND_BAND,
  type ScatterNode,
} from '../src/features/terrain-map/layout.ts';
import type { TerrainMap } from '../src/types/index.ts';

const W = 1000;
const H = 640;
const BAND = { top: H * GROUND_BAND.top, bot: H * GROUND_BAND.bottom };
const coreY = (BAND.top + BAND.bot) / 2; // core sits at the band centre, not canvas centre
const files = [
  ['Docker', '/tmp/map-docker.json'],
  ['选购投影仪', '/tmp/map-projector.json'],
] as const;

function overlap(a: ScatterNode, b: ScatterNode): number {
  const ba = nodeBounds(a);
  const bb = nodeBounds(b);
  const ox = Math.min(ba.maxX, bb.maxX) - Math.max(ba.minX, bb.minX);
  const oy = Math.min(ba.maxY, bb.maxY) - Math.max(ba.minY, bb.minY);
  return ox > 0 && oy > 0 ? Math.round(Math.min(ox, oy) * 10) / 10 : 0;
}

let allOk = true;
for (const [label, path] of files) {
  let map: TerrainMap;
  try {
    map = (JSON.parse(readFileSync(path, 'utf-8')) as { map: TerrainMap }).map;
  } catch {
    console.log(`\n(skip ${label}: ${path} 不存在)`);
    continue;
  }
  const out = scatterLayout(map, { width: W, height: H, bandTop: BAND.top, bandBot: BAND.bot });
  const coreId = map.nodes[pickCoreIndex(map)].id;

  const deg = new Map<string, number>();
  for (const n of map.nodes) deg.set(n.id, 0);
  for (const e of map.edges) {
    deg.set(e.from, (deg.get(e.from) ?? 0) + 1);
    deg.set(e.to, (deg.get(e.to) ?? 0) + 1);
  }

  console.log(
    `\n========= ${label}  (topic="${map.topic}", ${out.length} 座山) =========` +
      `\n  地面带 y∈[${BAND.top.toFixed(0)}, ${BAND.bot.toFixed(0)}]  (画布 ${W}x${H})`,
  );
  let offCanvas = 0;
  let orphans = 0;
  let sky = 0;
  for (const node of out) {
    const b = nodeBounds(node);
    const off = b.minX < -1 || b.minY < -1 || b.maxX > W + 1 || b.maxY > H + 1;
    if (off) offCanvas++;
    const inSky = node.y < BAND.top - 1;
    if (inSky) sky++;
    const orphan = (deg.get(node.id) ?? 0) === 0;
    if (orphan) orphans++;
    const isCore = node.id === coreId ? ' ★核心' : '';
    console.log(
      `  ${node.id.padEnd(8)} x=${node.x.toFixed(0).padStart(4)} y=${node.y
        .toFixed(0)
        .padStart(4)} (${((node.y / H) * 100).toFixed(0)}%)  label→${node.labelDir.padEnd(5)} deg=${deg.get(node.id)}${
        orphan ? '⚠孤儿' : ''
      }${off ? ' ⚠出界' : ''}${inSky ? ' ⚠飘天' : ''}${isCore}  ${node.title}`,
    );
  }

  const coreNode = out.find((nd) => nd.id === coreId)!;
  const coreDist = Math.round(Math.hypot(coreNode.x - W / 2, coreNode.y - coreY));
  let overlaps = 0;
  let maxO = 0;
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const o = overlap(out[i], out[j]);
      if (o > 1) {
        overlaps++;
        maxO = Math.max(maxO, o);
        console.log(`  ⚠ 重叠 ${out[i].id}×${out[j].id}: ${o}px`);
      }
    }
  }
  const coreCentered = coreDist <= 70;
  const ok = overlaps === 0 && offCanvas === 0 && sky === 0 && coreCentered;
  allOk = allOk && ok;
  console.log(
    `  → 核心居中: ${coreNode.title}（距草地带中心 ${coreDist}px${coreCentered ? ' ✓' : ' ⚠偏'}）| ` +
      `重叠对: ${overlaps}${maxO ? ` (max ${maxO}px)` : ''} | 出界: ${offCanvas} | 飘天: ${sky} | 孤儿: ${orphans} | ` +
      `${ok ? '✅ PASS' : '❌ FAIL'}`,
  );
}
console.log(`\n${allOk ? '✅ ALL MAPS PASS' : '❌ SOME MAPS FAIL'}`);
process.exit(allOk ? 0 : 1);
