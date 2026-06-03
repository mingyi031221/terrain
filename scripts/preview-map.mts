// Generate a static SVG preview of a map layout (for eyeballing layout options).
//   npx tsx scripts/preview-map.mts <band|full> <mapJson> <bgFile> <outSvg>
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  scatterLayout,
  GROUND_BAND,
  MOUNTAIN_SCALE,
  type ScatterNode,
} from '../src/features/terrain-map/layout.ts';
import type { TerrainMap } from '../src/types/index.ts';

const [mode, mapJson, bgFile, outSvg] = process.argv.slice(2);
const W = 1000;
const H = 640;
const REPO = path.resolve(import.meta.dirname, '..');

const TINT: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: 'rgba(129,178,213,0.62)', border: 'rgba(96,150,194,0.85)', text: '#234a66' },
  green: { bg: 'rgba(143,194,150,0.62)', border: 'rgba(112,172,122,0.85)', text: '#2f5a39' },
  pink: { bg: 'rgba(237,156,168,0.62)', border: 'rgba(224,128,144,0.85)', text: '#893a48' },
  purple: { bg: 'rgba(186,168,219,0.62)', border: 'rgba(158,138,202,0.85)', text: '#4e3d75' },
  yellow: { bg: 'rgba(233,206,132,0.66)', border: 'rgba(211,180,104,0.9)', text: '#735824' },
};
const COLOR_NAMES = ['blue', 'green', 'pink', 'purple', 'yellow'];

const map = (JSON.parse(readFileSync(mapJson, 'utf-8')) as { map: TerrainMap }).map;
const opts =
  mode === 'band'
    ? { width: W, height: H, bandTop: H * GROUND_BAND.top, bandBot: H * GROUND_BAND.bottom }
    : { width: W, height: H };
const nodes = scatterLayout(map, opts);
for (const n of nodes)
  console.error(`  ${n.id} x=${n.x.toFixed(0)} y=${n.y.toFixed(0)} (${((n.y / H) * 100).toFixed(0)}%) ${n.labelDir} ${n.title}`);

const MTN = ['blue', 'green', 'pink', 'purple', 'yellow'].map(
  (c) => path.join(REPO, `src/assets/mountains/mountain_${c}.png`),
);
function dataUri(file: string): string {
  const ext = path.extname(file).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}
const bgUri = dataUri(bgFile);
const mtnUri = MTN.map(dataUri);

function mShape(d: number) {
  const w = (9 + d * 1.6) * 10 * MOUNTAIN_SCALE; // px in 1000-space
  return { w, h: w * 0.9 };
}
function labelXY(n: ScatterNode, lw: number) {
  const { w, h } = mShape(n.difficulty);
  const gap = 8;
  const lh = 30;
  if (n.labelDir === 'down') return { x: n.x, y: n.y + h / 2 + gap + lh / 2 };
  if (n.labelDir === 'up') return { x: n.x, y: n.y - h / 2 - gap - lh / 2 };
  if (n.labelDir === 'left') return { x: n.x - w / 2 - gap - lw / 2, y: n.y };
  return { x: n.x + w / 2 + gap + lw / 2, y: n.y };
}
const byId = new Map(nodes.map((n) => [n.id, n]));
const mr = (n: ScatterNode) => ((90 + n.difficulty * 16) / 2) * 0.9 * MOUNTAIN_SCALE;

let trails = '';
for (const e of map.edges) {
  const a = byId.get(e.from);
  const b = byId.get(e.to);
  if (!a || !b) continue;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const fx = a.x + ux * (mr(a) + 2);
  const fy = a.y + uy * (mr(a) + 2);
  const tx = b.x - ux * (mr(b) + 13);
  const ty = b.y - uy * (mr(b) + 13);
  const mx = (fx + tx) / 2;
  const my = (fy + ty) / 2 - 24;
  trails += `<path d="M ${fx} ${fy} Q ${mx} ${my} ${tx} ${ty}" fill="none" stroke="#8a7a4e" stroke-width="3" stroke-linecap="round" opacity="0.62" marker-end="url(#arr)"/>\n`;
}

let peaks = '';
nodes.forEach((n, i) => {
  const { w, h } = mShape(n.difficulty);
  peaks += `<image x="${n.x - w / 2}" y="${n.y - h / 2}" width="${w}" height="${h}" href="${mtnUri[i % mtnUri.length]}"/>\n`;
  const tint = TINT[COLOR_NAMES[i % COLOR_NAMES.length]];
  const lw = Math.min(150, Math.max(60, n.title.length * 12.5 + 20));
  const lp = labelXY(n, lw);
  peaks += `<g>
    <rect x="${lp.x - lw / 2}" y="${lp.y - 14}" width="${lw}" height="28" rx="14" fill="${tint.bg}" stroke="${tint.border}"/>
    <text x="${lp.x}" y="${lp.y + 5}" font-family="PingFang SC" font-size="15" font-weight="600" fill="${tint.text}" text-anchor="middle">${n.title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
  </g>\n`;
});

// square canvas (1000x1000 viewBox) so qlmanage renders it faithfully without
// stretching; the map lives in the top H rows and we crop the rest off afterward.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1500" viewBox="0 0 ${W} ${W}">
  <defs>
    <marker id="arr" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="24" markerHeight="24" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M1,1 L11,6 L1,11 L4,6 Z" fill="#8a7a4e" opacity="0.62"/>
    </marker>
  </defs>
  <image x="0" y="0" width="${W}" height="${H}" href="${bgUri}" preserveAspectRatio="xMidYMid slice"/>
  ${trails}
  ${peaks}
</svg>`;

writeFileSync(outSvg, svg);
console.log('wrote', outSvg, `(${mode}, ${nodes.length} nodes)`);
