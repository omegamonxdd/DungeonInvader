/* Utilidad de inspección: decodifica un PNG generado por generate.mjs
 * (8-bit RGBA, filtro 0) y recorta celdas / compone un contacto.
 * Uso: node tools/ballista-art/crop.mjs <src.png> <salida.png> <x> <y> <w> <h>
 *    o: node tools/ballista-art/crop.mjs <src.png> <salida.png> sheet <cols> <rows> <pitch> <lista...>
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('no PNG');
  let off = 8, w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || colorType !== 6) throw new Error(`no soportado: depth=${bitDepth} type=${colorType}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter !== 0) throw new Error(`filtro ${filter} no soportado`);
    raw.copy(out, y * stride, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
  }
  return { w, h, data: out };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(img) {
  const stride = img.w * 4;
  const raw = Buffer.alloc((stride + 1) * img.h);
  for (let y = 0; y < img.h; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(img.data.buffer, img.data.byteOffset + y * stride, stride)
      .copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0); ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
function crop(img, x, y, w, h) {
  const data = new Uint8Array(w * h * 4);
  for (let row = 0; row < h; row++) {
    data.set(img.data.subarray(((y + row) * img.w + x) * 4, ((y + row) * img.w + x + w) * 4), row * w * 4);
  }
  return { data, w, h };
}
function blit(dst, src, ox, oy, scale = 1) {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4;
      const sa = src.data[si + 3] / 255;
      if (sa <= 0) continue;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const dx = x * scale + sx + ox, dy = y * scale + sy + oy;
          if (dx < 0 || dy < 0 || dx >= dst.w || dy >= dst.h) continue;
          const di = (dy * dst.w + dx) * 4;
          const da = dst.data[di + 3] / 255;
          const oa = sa + da * (1 - sa);
          if (oa <= 0) continue;
          dst.data[di] = (src.data[si] * sa + dst.data[di] * da * (1 - sa)) / oa;
          dst.data[di + 1] = (src.data[si + 1] * sa + dst.data[di + 1] * da * (1 - sa)) / oa;
          dst.data[di + 2] = (src.data[si + 2] * sa + dst.data[di + 2] * da * (1 - sa)) / oa;
          dst.data[di + 3] = oa * 255;
        }
      }
    }
  }
}

let [srcPath, outPath, mode, ...rest] = process.argv.slice(2);
const img = decodePNG(fs.readFileSync(srcPath));
console.log(`decode ${srcPath}: ${img.w}x${img.h}`);

// Permite `crop <x> <y> <w> <h>` y `sheet <cols> ...`; si el tercer
// argumento es numérico se trata como coordenada de recorte.
if (mode && /^\d/.test(mode)) {
  rest = [mode, ...rest];
  mode = 'crop';
}

if (mode === 'sheet') {
  const [cols, rows, pitch, cell, list] = rest.map(Number).slice(0, 4).concat([rest[4]]);
  const cells = list.split(',').map(s => {
    const [c, r] = s.split(':').map(Number);
    return { c, r };
  });
  const scale = 1;
  const W = cols * (cell * scale + 8) + 8, H = rows * (cell * scale + 8) + 8;
  const dst = { w: W, h: H, data: new Uint8Array(W * H * 4) };
  for (let i = 0; i < W * H; i++) { dst.data[i * 4] = 30; dst.data[i * 4 + 1] = 28; dst.data[i * 4 + 2] = 34; dst.data[i * 4 + 3] = 255; }
  cells.forEach(({ c, r }, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = c * pitch + 4, y = r * pitch + 4;
    if (x + cell > img.w || y + cell > img.h) throw new Error(`celda ${c}:${r} fuera: x=${x} y=${y} cell=${cell} img=${img.w}x${img.h}`);
    const sub = crop(img, x, y, cell, cell);
    blit(dst, sub, 8 + col * (cell + 8), 8 + row * (cell + 8), scale);
  });
  fs.writeFileSync(outPath, encodePNG(dst));
  console.log(`guardado ${outPath} (${W}x${H})`);
} else {
  const [x, y, w, h] = rest.join(' ').split(/[:\s]+/).map(Number);
  fs.writeFileSync(outPath, encodePNG(crop(img, x, y, w, h)));
  console.log(`guardado ${outPath} (${w}x${h}) de ${img.w}x${img.h}`);
}
