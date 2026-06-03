// Remove a checkerboard "fake transparency" background from a single-subject PNG
// by flood-filling neutral-gray/white pixels inward from the border, then crop.
// The subject (e.g. a watercolor mountain) is saturated/warm, so it survives —
// even a cream snow cap stays, because it's enclosed and slightly warm, not the
// checker's pure neutral gray.
//   node scripts/decheckerboard.mjs <in.png> <out.png> [maxSat=14] [minBright=150]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { decodePng } from './split-stickers.mjs';

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
};
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const [inp, outp, satArg, brightArg] = process.argv.slice(2);
const MAX_SAT = Number(satArg ?? 14);
const MIN_BRIGHT = Number(brightArg ?? 150);
const { width: W, height: H, rgba } = decodePng(fs.readFileSync(inp));
const N = W * H;

const isChecker = (i) => {
  const r = rgba[i * 4];
  const g = rgba[i * 4 + 1];
  const b = rgba[i * 4 + 2];
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx - mn <= MAX_SAT && mx >= MIN_BRIGHT; // neutral & bright = checker
};

const visited = new Uint8Array(N);
const stack = [];
const push = (x, y) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = y * W + x;
  if (!visited[i] && isChecker(i)) {
    visited[i] = 1;
    stack.push(i);
  }
};
for (let x = 0; x < W; x++) {
  push(x, 0);
  push(x, H - 1);
}
for (let y = 0; y < H; y++) {
  push(0, y);
  push(W - 1, y);
}
while (stack.length) {
  const i = stack.pop();
  const x = i % W;
  const y = (i / W) | 0;
  push(x - 1, y);
  push(x + 1, y);
  push(x, y - 1);
  push(x, y + 1);
}

let minX = W;
let minY = H;
let maxX = -1;
let maxY = -1;
for (let i = 0; i < N; i++) {
  if (visited[i]) {
    rgba[i * 4 + 3] = 0;
  } else {
    const x = i % W;
    const y = (i / W) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
}
const pad = 14;
minX = Math.max(0, minX - pad);
minY = Math.max(0, minY - pad);
maxX = Math.min(W - 1, maxX + pad);
maxY = Math.min(H - 1, maxY + pad);
const cw = maxX - minX + 1;
const ch = maxY - minY + 1;
const out = new Uint8Array(cw * ch * 4);
for (let y = 0; y < ch; y++) {
  for (let x = 0; x < cw; x++) {
    const si = ((minY + y) * W + (minX + x)) * 4;
    const di = (y * cw + x) * 4;
    out[di] = rgba[si];
    out[di + 1] = rgba[si + 1];
    out[di + 2] = rgba[si + 2];
    out[di + 3] = rgba[si + 3];
  }
}
fs.writeFileSync(outp, encodePng(cw, ch, out));
console.log('wrote', outp, `${cw}x${ch} (maxSat=${MAX_SAT}, minBright=${MIN_BRIGHT})`);
