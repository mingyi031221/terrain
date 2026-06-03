// Crop the top-left WxH region of a PNG (qlmanage pads thumbnails to a square).
//   node scripts/crop-top.mjs <in.png> <out.png> <w> <h>
import { readFileSync, writeFileSync } from 'node:fs';
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
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const [inp, outp, wArg, hArg] = process.argv.slice(2);
const { width, height, rgba } = decodePng(readFileSync(inp));
const cw = Math.min(Number(wArg), width);
const ch = Math.min(Number(hArg), height);
const out = new Uint8Array(cw * ch * 4);
for (let y = 0; y < ch; y++) {
  const src = y * width * 4;
  out.set(rgba.subarray(src, src + cw * 4), y * cw * 4);
}
writeFileSync(outp, encodePng(cw, ch, out));
console.log('cropped', outp, `${cw}x${ch}`);
