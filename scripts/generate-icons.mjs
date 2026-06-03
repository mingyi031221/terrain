#!/usr/bin/env node
// Generate the PWA app icons procedurally — a little watercolor mountain with a
// summit flag on a warm sky. Pure Node (zlib only), so it runs offline and adds
// no dependency. Outputs to public/ where Vite copies them to the dist root.
//
//   node scripts/generate-icons.mjs

import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- PNG encode (RGBA) ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- tiny drawing kit ----
function makeCanvas(size) {
  return { size, px: new Uint8ClampedArray(size * size * 4) };
}
function blend(cv, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= cv.size || y >= cv.size || a <= 0) return;
  const i = (y * cv.size + x) * 4;
  const da = cv.px[i + 3] / 255;
  const sa = a;
  const oa = sa + da * (1 - sa);
  if (oa <= 0) return;
  cv.px[i] = (r * sa + cv.px[i] * da * (1 - sa)) / oa;
  cv.px[i + 1] = (g * sa + cv.px[i + 1] * da * (1 - sa)) / oa;
  cv.px[i + 2] = (b * sa + cv.px[i + 2] * da * (1 - sa)) / oa;
  cv.px[i + 3] = oa * 255;
}
function vGradient(cv, top, bottom) {
  for (let y = 0; y < cv.size; y++) {
    const t = y / (cv.size - 1);
    const r = top[0] + (bottom[0] - top[0]) * t;
    const g = top[1] + (bottom[1] - top[1]) * t;
    const b = top[2] + (bottom[2] - top[2]) * t;
    for (let x = 0; x < cv.size; x++) blend(cv, x, y, r, g, b, 1);
  }
}
function tri(cv, ax, ay, bx, by, cx, cy, col) {
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(cv.size - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(cv.size - 1, Math.ceil(Math.max(ay, by, cy)));
  const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // sample at pixel centre with a touch of supersampling for soft edges
      let cover = 0;
      for (const [sx, sy] of [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75],
      ]) {
        const px = x + sx;
        const py = y + sy;
        const a = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / d;
        const b = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / d;
        const c = 1 - a - b;
        if (a >= 0 && b >= 0 && c >= 0) cover += 0.25;
      }
      if (cover > 0) blend(cv, x, y, col[0], col[1], col[2], (col[3] ?? 1) * cover);
    }
  }
}

function drawIcon(size, contentScale) {
  const cv = makeCanvas(size);
  vGradient(cv, [246, 236, 214], [223, 233, 200]); // sky → meadow

  const S = size;
  const cx = 0.5;
  const cyAnchor = 0.52;
  // place mountain geometry in unit space, scaled toward centre for maskable safe-zone
  const map = (ux, uy) => [
    (cx + (ux - cx) * contentScale) * S,
    (cyAnchor + (uy - cyAnchor) * contentScale) * S,
  ];

  const peak = map(0.5, 0.24);
  const baseL = map(0.16, 0.8);
  const baseR = map(0.84, 0.8);
  const ridgeBase = map(0.54, 0.8);

  // soft halo
  tri(cv, ...peak, ...map(0.1, 0.84), ...map(0.9, 0.84), [150, 190, 220, 0.4]);
  // lit (left) face
  tri(cv, ...peak, ...baseL, ...ridgeBase, [150, 198, 226, 1]);
  // shadow (right) face
  tri(cv, ...peak, ...ridgeBase, ...baseR, [108, 162, 198, 1]);
  // snow cap
  const snL = map(0.42, 0.4);
  const snR = map(0.585, 0.4);
  tri(cv, ...peak, ...snL, ...snR, [253, 251, 244, 0.96]);

  // summit flag
  const [pxs, pys] = peak;
  const poleH = 0.16 * S * contentScale;
  for (let i = 0; i < Math.max(2, Math.round(0.012 * S)); i++) {
    for (let y = pys - poleH; y < pys; y++) {
      blend(cv, Math.round(pxs) + i, Math.round(y), 90, 74, 52, 1);
    }
  }
  const flagW = 0.12 * S * contentScale;
  const flagH = 0.08 * S * contentScale;
  tri(
    cv,
    pxs,
    pys - poleH,
    pxs + flagW,
    pys - poleH + flagH / 2,
    pxs,
    pys - poleH + flagH,
    [224, 92, 92, 1],
  );

  return encodePng(size, cv.px);
}

const outDir = fileURLToPath(new URL('../public', import.meta.url));
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  ['icon-192.png', 192, 0.92],
  ['icon-512.png', 512, 0.92],
  ['icon-maskable-512.png', 512, 0.66], // content inside the safe zone
  ['apple-touch-icon.png', 180, 0.9],
  ['favicon-32.png', 32, 0.96],
];
for (const [name, size, scale] of targets) {
  fs.writeFileSync(path.join(outDir, name), drawIcon(size, scale));
  console.log('wrote', name, `${size}x${size}`);
}
