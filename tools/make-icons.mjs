// 生成扩展图标（16/32/48/128）—— 纯 Node，无第三方依赖
// 用法: node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'icons');
mkdirSync(OUT, { recursive: true });

// ---------- 最小 PNG 编码器 ----------
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
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(size, rgba) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- 绘制 ----------
const BG_TOP = [47, 129, 247];    // #2f81f7
const BG_BOT = [9, 105, 218];     // #0969da
const FG = [255, 255, 255];

function isInRoundedRect(x, y, w, r, inset) {
  const x0 = inset, y0 = inset, x1 = w - inset, y1 = w - inset;
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const dx = Math.max(x0 + r - x, x - (x1 - r), 0);
  const dy = Math.max(y0 + r - y, y - (y1 - r), 0);
  return dx * dx + dy * dy <= r * r;
}
// 经典 Markdown 徽标：竖直条 + 底部箭头
function isInGlyph(x, y, u) {
  if (x >= 0.43 * u && x <= 0.50 * u && y >= 0.24 * u && y <= 0.56 * u) return true;   // 竖条
  if (y > 0.54 * u && y <= 0.80 * u) {                                                  // 箭头三角
    const half = (0.80 * u - y) / (0.26 * u) * 0.30 * u;
    return Math.abs(x - 0.465 * u) <= half;
  }
  return false;
}

function render(size) {
  const S = 4; // 4x4 超采样
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let cov = 0, r = 0, g = 0, b = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const x = (px + (sx + 0.5) / S) * (128 / size); // 统一在 128 坐标系绘制
          const y = (py + (sy + 0.5) / S) * (128 / size);
          if (!isInRoundedRect(x, y, 128, 28, 6)) continue;
          cov++;
          if (isInGlyph(x, y, 128)) {
            r += FG[0]; g += FG[1]; b += FG[2];
          } else {
            const t = y / 128;
            r += BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * t;
            g += BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * t;
            b += BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * t;
          }
        }
      }
      const o = (py * size + px) * 4;
      rgba[o] = Math.round(r / cov || 0);
      rgba[o + 1] = Math.round(g / cov || 0);
      rgba[o + 2] = Math.round(b / cov || 0);
      rgba[o + 3] = Math.round(255 * cov / (S * S));
    }
  }
  return encodePNG(size, rgba);
}

for (const s of [16, 32, 48, 128]) {
  writeFileSync(join(OUT, `icon${s}.png`), render(s));
  console.log(`icon${s}.png 写入完成`);
}
