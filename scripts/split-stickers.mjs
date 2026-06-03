#!/usr/bin/env node
// Split a "sticker sheet" PNG (multiple stickers on a transparent background)
// into one trimmed transparent PNG per sticker. Pure Node — only built-in
// `zlib`/`fs`, so it runs offline with no dependencies.
//
// Stickers are found as connected components of non-transparent pixels, sorted
// into reading order (top→bottom, left→right). Each is cropped to its bounding
// box (with padding); pixels belonging to *other* stickers are erased so a
// neighbour never bleeds into a crop.
//
// Usage:
//   node scripts/split-stickers.mjs <input.png> <outDir> [options]
//
// Options:
//   --prefix <name>     filename prefix for auto-named files     (default: "sticker")
//   --names a,b,c       explicit names in reading order (count must match)
//   --ext png           output extension                         (default: png)
//   --threshold <0-255> alpha above this counts as "ink"         (default: 24)
//   --min-area <px>     ignore components smaller than this      (default: 2500)
//   --pad <px>          transparent padding around each crop     (default: 16)
//   --dry               analyse & print components, write nothing

import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

// ----------------------------- CRC32 (for PNG chunks) -----------------------
const CRC_TABLE = (() => {
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
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ----------------------------- PNG decode -----------------------------------
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function decodePng(buf) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error('not a PNG');

  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];

  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len;
  }

  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth} (need 8)`);
  if (interlace !== 0) throw new Error('interlaced PNG not supported');
  const channelsByType = { 0: 1, 2: 3, 4: 2, 6: 4 };
  const channels = channelsByType[colorType];
  if (!channels) throw new Error(`unsupported color type ${colorType}`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = channels;
  const stride = width * bpp;
  const recon = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const lineOff = y * (stride + 1) + 1;
    const rowOff = y * stride;
    const prevOff = rowOff - stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[lineOff + i];
      const a = i >= bpp ? recon[rowOff + i - bpp] : 0;
      const b = y > 0 ? recon[prevOff + i] : 0;
      const c = y > 0 && i >= bpp ? recon[prevOff + i - bpp] : 0;
      let v;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: v = x + paeth(a, b, c); break;
        default: throw new Error(`bad filter ${filter}`);
      }
      recon[rowOff + i] = v & 0xff;
    }
  }

  // normalise to RGBA
  const rgba = new Uint8Array(width * height * 4);
  for (let p = 0, q = 0; p < width * height; p++) {
    const s = p * bpp;
    if (channels === 4) {
      rgba[q++] = recon[s]; rgba[q++] = recon[s + 1]; rgba[q++] = recon[s + 2]; rgba[q++] = recon[s + 3];
    } else if (channels === 3) {
      rgba[q++] = recon[s]; rgba[q++] = recon[s + 1]; rgba[q++] = recon[s + 2]; rgba[q++] = 255;
    } else if (channels === 2) {
      rgba[q++] = recon[s]; rgba[q++] = recon[s]; rgba[q++] = recon[s]; rgba[q++] = recon[s + 1];
    } else {
      rgba[q++] = recon[s]; rgba[q++] = recon[s]; rgba[q++] = recon[s]; rgba[q++] = 255;
    }
  }
  return { width, height, rgba };
}

// ----------------------------- PNG encode (RGBA) ----------------------------
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const rawSize = height * (stride + 1);
  const raw = Buffer.alloc(rawSize);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: None
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1,
    );
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ----------------------------- background detection -------------------------
// Two ways a Gemini export marks "background":
//   alpha → genuinely transparent pixels (alpha <= threshold)
//   gray  → an opaque gray checkerboard baked in to *represent* transparency
//           (low-saturation mid-gray pixels)
export function backgroundMask(width, height, rgba, opts) {
  const n = width * height;
  const cand = new Uint8Array(n);
  if (opts.mode === 'alpha') {
    for (let p = 0; p < n; p++) cand[p] = rgba[p * 4 + 3] <= opts.threshold ? 1 : 0;
  } else {
    for (let p = 0; p < n; p++) {
      const r = rgba[p * 4];
      const g = rgba[p * 4 + 1];
      const b = rgba[p * 4 + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = (r + g + b) / 3;
      cand[p] =
        max - min <= opts.graySpread && lum >= opts.grayLo && lum <= opts.grayHi ? 1 : 0;
    }
  }

  // Keep only background that reaches the image border, so gray detail *inside*
  // a sticker (e.g. a pebble) isn't punched out as a hole.
  const isBg = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  const push = (idx) => {
    if (cand[idx] && !isBg[idx]) {
      isBg[idx] = 1;
      stack[sp++] = idx;
    }
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (sp > 0) {
    const idx = stack[--sp];
    const x = idx % width;
    const y = (idx - x) / width;
    if (x > 0) push(idx - 1);
    if (x < width - 1) push(idx + 1);
    if (y > 0) push(idx - width);
    if (y < height - 1) push(idx + width);
    // diagonals so a checker (squares touch only at corners) stays connected
    if (x > 0 && y > 0) push(idx - width - 1);
    if (x < width - 1 && y > 0) push(idx - width + 1);
    if (x > 0 && y < height - 1) push(idx + width - 1);
    if (x < width - 1 && y < height - 1) push(idx + width + 1);
  }
  return isBg;
}

// ----------------------------- connected components -------------------------
// Components of the *foreground* (= not background), 8-connected.
export function findComponents(width, height, isBg, minArea) {
  const n = width * height;
  const labels = new Int32Array(n); // 0 = unlabeled
  const stack = new Int32Array(n);
  const comps = [];
  let next = 1;

  for (let start = 0; start < n; start++) {
    if (labels[start] !== 0) continue;
    if (isBg[start]) continue;

    const label = next++;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = label;
    let minx = width, miny = height, maxx = 0, maxy = 0, area = 0;

    while (sp > 0) {
      const idx = stack[--sp];
      const x = idx % width;
      const y = (idx - x) / width;
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
      if (y < miny) miny = y;
      if (y > maxy) maxy = y;
      area++;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nidx = ny * width + nx;
          if (labels[nidx] !== 0) continue;
          if (isBg[nidx]) continue;
          labels[nidx] = label;
          stack[sp++] = nidx;
        }
      }
    }

    comps.push({ label, minx, miny, maxx, maxy, area, cx: (minx + maxx) / 2, cy: (miny + maxy) / 2 });
  }

  return { labels, comps: comps.filter((c) => c.area >= minArea) };
}

// sort into reading order: group into rows by vertical overlap, then by x
function readingOrder(comps) {
  const sorted = [...comps].sort((a, b) => a.cy - b.cy);
  const avgH = sorted.reduce((s, c) => s + (c.maxy - c.miny), 0) / Math.max(sorted.length, 1);
  const rows = [];
  for (const c of sorted) {
    const row = rows.find((r) => Math.abs(r.cy - c.cy) < avgH * 0.5);
    if (row) {
      row.items.push(c);
      row.cy = (row.cy * (row.items.length - 1) + c.cy) / row.items.length;
    } else {
      rows.push({ cy: c.cy, items: [c] });
    }
  }
  const out = [];
  for (const r of rows) {
    r.items.sort((a, b) => a.cx - b.cx);
    out.push(...r.items);
  }
  return out;
}

// ----------------------------- main -----------------------------------------
function parseArgs(argv) {
  const a = {
    _: [],
    prefix: 'sticker',
    ext: 'png',
    bg: 'gray', // 'gray' (baked checkerboard) | 'alpha' (real transparency)
    threshold: 24,
    graySpread: 18,
    grayLo: 40,
    grayHi: 214,
    minArea: 2500,
    pad: 16,
    dry: false,
    names: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--dry') a.dry = true;
    else if (t === '--prefix') a.prefix = argv[++i];
    else if (t === '--names') a.names = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (t === '--ext') a.ext = argv[++i];
    else if (t === '--bg') a.bg = argv[++i];
    else if (t === '--threshold') a.threshold = Number(argv[++i]);
    else if (t === '--gray-spread') a.graySpread = Number(argv[++i]);
    else if (t === '--gray-lo') a.grayLo = Number(argv[++i]);
    else if (t === '--gray-hi') a.grayHi = Number(argv[++i]);
    else if (t === '--min-area') a.minArea = Number(argv[++i]);
    else if (t === '--pad') a.pad = Number(argv[++i]);
    else a._.push(t);
  }
  return a;
}

function main() {
  const args = parseArgs(process.argv);
  const [input, outDir] = args._;
  if (!input || !outDir) {
    console.error('usage: node scripts/split-stickers.mjs <input.png> <outDir> [options]');
    process.exit(1);
  }

  const buf = fs.readFileSync(input);
  const { width, height, rgba } = decodePng(buf);
  console.log(`decoded ${path.basename(input)}: ${width}x${height}  (bg mode: ${args.bg})`);

  const isBg = backgroundMask(width, height, rgba, {
    mode: args.bg,
    threshold: args.threshold,
    graySpread: args.graySpread,
    grayLo: args.grayLo,
    grayHi: args.grayHi,
  });
  const { labels, comps } = findComponents(width, height, isBg, args.minArea);
  const ordered = readingOrder(comps);
  console.log(`found ${ordered.length} sticker(s) (min-area=${args.minArea})`);

  if (args.names && args.names.length !== ordered.length) {
    console.warn(
      `! --names has ${args.names.length} entries but ${ordered.length} stickers found; falling back to "${args.prefix}_NN"`,
    );
    args.names = null;
  }

  if (!args.dry) fs.mkdirSync(outDir, { recursive: true });

  ordered.forEach((c, i) => {
    const name = args.names ? args.names[i] : `${args.prefix}_${String(i + 1).padStart(2, '0')}`;
    const x0 = Math.max(0, c.minx - args.pad);
    const y0 = Math.max(0, c.miny - args.pad);
    const x1 = Math.min(width - 1, c.maxx + args.pad);
    const y1 = Math.min(height - 1, c.maxy + args.pad);
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    console.log(
      `  [${i + 1}] ${name}.${args.ext}  bbox=${c.minx},${c.miny}..${c.maxx},${c.maxy}  ${w}x${h}  area=${c.area}`,
    );
    if (args.dry) return;

    const out = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sidx = (y0 + y) * width + (x0 + x);
        const didx = y * w + x;
        if (labels[sidx] === c.label) {
          out[didx * 4] = rgba[sidx * 4];
          out[didx * 4 + 1] = rgba[sidx * 4 + 1];
          out[didx * 4 + 2] = rgba[sidx * 4 + 2];
          out[didx * 4 + 3] = 255; // opaque sticker pixel
        } else {
          out[didx * 4 + 3] = 0; // background or a neighbouring sticker
        }
      }
    }
    fs.writeFileSync(path.join(outDir, `${name}.${args.ext}`), encodePng(w, h, out));
  });

  console.log(args.dry ? 'dry run — nothing written' : `wrote ${ordered.length} file(s) to ${outDir}`);
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
