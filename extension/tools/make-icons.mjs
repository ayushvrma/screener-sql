// Generate the three PNG icons (16, 48, 128) with a monochrome "SQ" mark.
// Uses zlib to build a minimal palette-based PNG — no external deps.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = resolve(HERE, "..", "src", "icons");
mkdirSync(ICONS_DIR, { recursive: true });

const BG = [37, 99, 235]; // #2563eb (Screener-ish blue)
const FG = [255, 255, 255];

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcBuf]);
}

// paint a size×size RGBA buffer, then encode as color type 6 (truecolor+alpha)
function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  // filled rounded-ish square with an "SQ" mark (very rough vector)
  const r = size * 0.18;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const inside = insideRounded(x + 0.5, y + 0.5, size, r);
      let c = [0, 0, 0, 0];
      if (inside) {
        c = [BG[0], BG[1], BG[2], 255];
        // draw "SQ" as two glyphs approximated by rectangles
        if (isGlyph(x, y, size)) c = [FG[0], FG[1], FG[2], 255];
      }
      px[idx] = c[0]; px[idx+1] = c[1]; px[idx+2] = c[2]; px[idx+3] = c[3];
    }
  }
  // encode: filter byte 0 per scanline + rgba
  const filtered = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    filtered[y * (1 + size * 4)] = 0;
    px.copy(filtered, y * (1 + size * 4) + 1, y * size * 4, y * size * 4 + size * 4);
  }
  const compressed = deflateSync(filtered);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;          // bit depth
  ihdr[9] = 6;          // color type: truecolor + alpha
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0))]);
}

function insideRounded(x, y, size, r) {
  if (x < r && y < r) return (x - r) ** 2 + (y - r) ** 2 <= r * r;
  if (x > size - r && y < r) return (x - (size - r)) ** 2 + (y - r) ** 2 <= r * r;
  if (x < r && y > size - r) return (x - r) ** 2 + (y - (size - r)) ** 2 <= r * r;
  if (x > size - r && y > size - r) return (x - (size - r)) ** 2 + (y - (size - r)) ** 2 <= r * r;
  return true;
}

// Rough "SQ" glyph: two 3-bar shapes side by side.
function isGlyph(x, y, size) {
  const s = size / 128; // scale factor
  // S: at cols 26..56, rows 40..88 in the 128 grid
  const s_left = 26 * s, s_right = 56 * s, s_top = 40 * s, s_bot = 88 * s, bar = 8 * s;
  const inCol = (x >= s_left && x <= s_right);
  if (inCol && (
    (y >= s_top && y <= s_top + bar) ||
    (y >= (s_top + s_bot)/2 - bar/2 && y <= (s_top + s_bot)/2 + bar/2) ||
    (y >= s_bot - bar && y <= s_bot)
  )) return true;
  if ((x >= s_left && x <= s_left + bar) && y >= s_top && y <= (s_top + s_bot)/2) return true;
  if ((x >= s_right - bar && x <= s_right) && y >= (s_top + s_bot)/2 && y <= s_bot) return true;

  // Q: rectangle outline at cols 72..102, rows 40..88 with a diagonal tail
  const q_left = 72 * s, q_right = 102 * s, q_top = 40 * s, q_bot = 88 * s;
  const inQ = (x >= q_left && x <= q_right && y >= q_top && y <= q_bot);
  if (inQ) {
    const onEdge =
      x <= q_left + bar || x >= q_right - bar ||
      y <= q_top + bar || y >= q_bot - bar;
    if (onEdge) return true;
  }
  // Q tail
  const tailX = q_right - 12 * s, tailY = q_bot - 12 * s;
  if (Math.abs((x - tailX) - (y - tailY)) < bar / 2 && x > tailX && x < tailX + 20 * s && y > tailY && y < tailY + 20 * s) return true;
  return false;
}

for (const size of [16, 48, 128]) {
  const png = drawIcon(size);
  writeFileSync(resolve(ICONS_DIR, `icon${size}.png`), png);
  console.log(`wrote ${ICONS_DIR}/icon${size}.png (${png.length} bytes)`);
}
