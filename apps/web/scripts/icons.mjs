// Rasterises the mascot into the PWA's PNG icons: node scripts/icons.mjs
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BG = [0x17, 0x16, 0x1a];
const BODY = [0x81, 0x8c, 0xf8];
const FACE = [0x17, 0x16, 0x1a];

const smile = Array.from({ length: 41 }, (_, i) => {
  const t = i / 40;
  // Cubic from (14,24) via (16.5,27) (23.5,27) to (26,24), matching the mascot's path.
  const x = (1 - t) ** 3 * 14 + 3 * (1 - t) ** 2 * t * 16.5 + 3 * (1 - t) * t ** 2 * 23.5 + t ** 3 * 26;
  const y = (1 - t) ** 3 * 24 + 3 * (1 - t) ** 2 * t * 27 + 3 * (1 - t) * t ** 2 * 27 + t ** 3 * 24;
  return [x, y];
});

function colourAt(x, y) {
  const inBody = ((x - 19.5) / 16.5) ** 2 + ((y - 19) / 16) ** 2 <= 1;
  if (!inBody) return null;
  const eye = Math.hypot(x - 15, y - 17) <= 2.4 || Math.hypot(x - 25, y - 17) <= 2.4;
  const mouth = smile.some(([sx, sy]) => Math.hypot(x - sx, y - sy) <= 1.1);
  return eye || mouth ? FACE : BODY;
}

function render(size, { scale, rounded }) {
  const px = Buffer.alloc(size * size * 4);
  const S = 4;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const acc = [0, 0, 0, 0];
      for (let sj = 0; sj < S; sj++)
        for (let si = 0; si < S; si++) {
          const u = (i + (si + 0.5) / S) / size;
          const v = (j + (sj + 0.5) / S) / size;
          if (rounded) {
            const r = 0.22;
            const dx = Math.max(r - u, 0, u - (1 - r));
            const dy = Math.max(r - v, 0, v - (1 - r));
            if (dx * dx + dy * dy > r * r) continue;
          }
          const x = 20 + (u - 0.5) * (40 / scale);
          const y = 19 + (v - 0.5) * (40 / scale);
          const c = colourAt(x, y) ?? BG;
          acc[0] += c[0];
          acc[1] += c[1];
          acc[2] += c[2];
          acc[3] += 255;
        }
      const n = S * S;
      const o = (j * size + i) * 4;
      const a = acc[3] / n;
      px[o] = a ? Math.round((acc[0] / n) * (255 / a)) : 0;
      px[o + 1] = a ? Math.round((acc[1] / n) * (255 / a)) : 0;
      px[o + 2] = a ? Math.round((acc[2] / n) * (255 / a)) : 0;
      px[o + 3] = Math.round(a);
    }
  return png(size, px);
}

function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

const out = new URL("../public/icons/", import.meta.url);
for (const size of [192, 512]) {
  writeFileSync(new URL(`icon-${size}.png`, out), render(size, { scale: 0.78, rounded: true }));
  writeFileSync(new URL(`maskable-${size}.png`, out), render(size, { scale: 0.56, rounded: false }));
}
writeFileSync(new URL("apple-touch-icon.png", out), render(180, { scale: 0.62, rounded: false }));
console.log("icons written");
