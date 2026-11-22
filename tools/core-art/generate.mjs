/* ==========================================================================
 * GENERADOR DE ARTE DEL NÚCLEO (pipeline coc-25d-pipeline)
 * --------------------------------------------------------------------------
 * Igual que tools/ballista-art/generate.mjs: modelo 3D estilizado -> cámara
 * ortográfica isométrica real (azimut 45°, elevación 30°) -> PNG RGBA limpio.
 * No se simula la vista 2.5D con escalas/cizallas 2D.
 *
 * Modelo: plataforma de piedra de mazmorra con 4 pilares desgastados y
 * agrietados en las esquinas de una huella 3×3, y un cristal cian pequeño
 * flotando en el centro. Misma clave cálida + relleno frío y mismo contorno
 * de 1 px que la ballesta para que ambos sets se lean como una familia.
 *
 * Uso:  npm run art:core
 *
 * Salida en front/assets/estructuras/nucleo/:
 *   core.png          384×384, piedra + cristal + sombra de contacto
 *   core-glow.png     256×256, resplandor cian (se anima su alfa en Phaser)
 *   core-art.json     anclas y medidas derivadas del render
 *   (preview en tools/core-art/preview.png)
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT = path.resolve('front/assets/estructuras/nucleo');
const PREVIEW_DIR = path.resolve('tools/core-art');

// --- Configuración del horneado -------------------------------------------
const CELL = 384;          // px por celda a la salida (huella 3×3 + pilares)
const PAD = 4;             // margen transparente
const SS = 4;              // supersampling
const PPU = 62 * SS;       // px por unidad de mundo (idéntico a la ballesta)
const ART_SCALE = 1.0947;  // 96 px de casilla / (1.4142 × 62 px de arte)

// Cámara isométrica: azimut 45°, elevación 30°, proyección ortográfica.
const AZ = Math.PI / 4;
const EL = Math.PI / 6;
const VIEW = [Math.cos(EL) * Math.cos(AZ), Math.cos(EL) * Math.sin(AZ), Math.sin(EL)];
const RIGHT = [Math.sin(AZ), -Math.cos(AZ), 0];
const UP = [-Math.sin(EL) * Math.cos(AZ), -Math.sin(EL) * Math.sin(AZ), Math.cos(EL)];

// El ancla cae en el centro de la huella 3×3, sobre la cara superior del
// bloque del núcleo (CORE_HEIGHT en el juego). El cristal queda unos px de
// arte por encima, que es donde se coloca el resplandor en CoreView.
const ANCHOR = [192, 306];
const GLOW_SIZE = 168;     // diámetro del resplandor en px de arte

// Base (parte inferior del núcleo): la misma piedra, pero con el alto de la
// plataforma recortado a la mitad. Todo lo que apoya en ella baja lo mismo
// para que el cristal siga asentado sobre el escalón superior.
const BASE_H_SCALE = 0.5;
const DAIS_BOTTOM = 0.02;
const DAIS_Z = [DAIS_BOTTOM];
for (const h of [0.14, 0.11, 0.06]) DAIS_Z.push(DAIS_Z[DAIS_Z.length - 1] + h * BASE_H_SCALE);
const DAIS_TOP = DAIS_Z[3];            // 0.175 (antes 0.33)
const BASE_DROP = 0.33 - DAIS_TOP;     // 0.155: bajada del cristal y su zócalo

// Centro del cristal principal, bajado junto con la base.
const CRYSTAL_Z = 0.95 - BASE_DROP;
const GLOW_LIFT = Math.round(CRYSTAL_Z * Math.cos(EL) * (PPU / SS)); // px de arte ancla→cristal

// Paleta: piedra gris agrietada + cian saturado de cristal.
const C = {
  stone: [116, 116, 126],
  stoneLight: [151, 151, 161],
  stoneDark: [76, 76, 87],
  stoneDeep: [48, 48, 58],
  crack: [24, 22, 30],
  cyan: [92, 220, 252],
  cyanLight: [186, 246, 255],
  cyanDeep: [30, 132, 190],
  outline: [18, 16, 26],
};

// Luces fijas de mundo: clave cálida arriba-izquierda + relleno frío derecha.
const KEY = norm([
  -0.78 * RIGHT[0] + 0.62 * UP[0] + 0.30 * VIEW[0],
  -0.78 * RIGHT[1] + 0.62 * UP[1] + 0.30 * VIEW[1],
  -0.78 * RIGHT[2] + 0.62 * UP[2] + 0.30 * VIEW[2],
]);
const FILL = norm([
  0.85 * RIGHT[0] + 0.16 * UP[0] + 0.22 * VIEW[0],
  0.85 * RIGHT[1] + 0.16 * UP[1] + 0.22 * VIEW[1],
  0.85 * RIGHT[2] + 0.16 * UP[2] + 0.22 * VIEW[2],
]);

// --------------------------------------------------------------------------
 // Álgebra vectorial mínima
 // --------------------------------------------------------------------------
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function len(a) { return Math.hypot(a[0], a[1], a[2]); }
function norm(a) { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function centroid(pts) {
  const sum = [0, 0, 0];
  for (const p of pts) { sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; }
  return mul(sum, 1 / pts.length);
}

// --------------------------------------------------------------------------
 // Iluminación y materiales
 // --------------------------------------------------------------------------
function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }

function shade(color, n, ao = 1, tint = 1) {
  const k = Math.max(0, dot(n, KEY));
  const f = Math.max(0, dot(n, FILL));
  const up = Math.max(0, n[2]);
  const i = (0.48 + 0.68 * k + 0.26 * f + 0.10 * up) * ao * tint;
  return [
    clamp255(color[0] * i + 26 * k + 3 * f),
    clamp255(color[1] * i + 10 * k + 4 * f),
    clamp255(color[2] * i + 2 * k + 14 * f + 3 * up),
  ];
}

function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function stoneMat(seed = 0) { return { kind: 'stone', seed }; }
function crystalMat(seed = 0) { return { kind: 'crystal', seed }; }

/* Moteado de piedra y bandeado sutil del cristal. */
function materialFactor(mat, p) {
  if (!mat) return 1;
  let m = 1;
  if (mat.kind === 'stone') {
    const a = hash2(Math.floor(p[0] * 27) + mat.seed, Math.floor(p[1] * 27) + Math.floor(p[2] * 27));
    const b = hash2(Math.floor(p[0] * 9) - mat.seed, Math.floor(p[1] * 9) + Math.floor(p[2] * 9));
    m += (a - 0.5) * 0.10 + (b - 0.5) * 0.08;
  } else if (mat.kind === 'crystal') {
    const band = Math.sin(p[2] * 24 + p[0] * 7 + mat.seed * 0.31);
    m += band * 0.065;
    m += (hash2(Math.floor(p[0] * 40) + mat.seed, Math.floor(p[1] * 40) + Math.floor(p[2] * 40)) - 0.5) * 0.018;
  }
  return m;
}

// --------------------------------------------------------------------------
 // Malla: triángulos con color base; el sombreado se aplica tras la rotación.
 // --------------------------------------------------------------------------
function quad(mesh, pts, color, opts = {}) {
  let n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
  if (!isFinite(n[0])) return;
  if (opts.outward) {
    const c = centroid(pts);
    if (dot(n, sub(c, opts.outward)) < 0) {
      pts = pts.slice().reverse();
      n = mul(n, -1);
    }
  }
  for (let i = 1; i < pts.length - 1; i++) {
    mesh.push({
      p: [pts[0], pts[i], pts[i + 1]],
      color,
      ao: opts.ao ?? 1,
      tint: opts.tint ?? 1,
      mat: opts.mat ?? null,
      outline: opts.outline !== false,
    });
  }
}

/* Caja biselada orientada entre p0 y p1 (idéntica a la de la ballesta). */
function bevelBox(mesh, p0, p1, w, d, bevel, color, opts = {}) {
  const zAxis = norm(sub(p1, p0));
  const upHint = opts.up ?? [0, 0, 1];
  let xAxis = cross(upHint, zAxis);
  if (len(xAxis) < 1e-4) xAxis = cross([1, 0, 0], zAxis);
  xAxis = norm(xAxis);
  const yAxis = norm(cross(zAxis, xAxis));
  const mid = mul(add(p0, p1), 0.5);
  const half = len(sub(p1, p0)) / 2;
  const hw = w / 2, hd = d / 2;
  const b = Math.min(bevel, hw * 0.34, hd * 0.34, half * 0.34);
  const ex = hw - b, ey = hd - b, ez = half - b;
  const T = (x, y, z) => add(mid, add(add(mul(xAxis, x), mul(yAxis, y)), mul(zAxis, z)));
  const mat = opts.mat ?? stoneMat(opts.seed ?? 0);
  const oo = { outward: mid, ao: opts.ao ?? 1, mat, outline: opts.outline !== false };
  const bt = opts.bevelTint ?? 1.035;

  for (const sx of [-1, 1]) {
    quad(mesh, [T(sx * hw, -ey, -ez), T(sx * hw, ey, -ez), T(sx * hw, ey, ez), T(sx * hw, -ey, ez)], color, oo);
  }
  for (const sy of [-1, 1]) {
    quad(mesh, [T(-ex, sy * hd, -ez), T(ex, sy * hd, -ez), T(ex, sy * hd, ez), T(-ex, sy * hd, ez)], color, oo);
  }
  for (const sz of [-1, 1]) {
    quad(mesh, [T(-ex, -ey, sz * half), T(ex, -ey, sz * half), T(ex, ey, sz * half), T(-ex, ey, sz * half)], color, oo);
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    quad(mesh, [T(sx * hw, sy * ey, -ez), T(sx * ex, sy * hd, -ez), T(sx * ex, sy * hd, ez), T(sx * hw, sy * ey, ez)],
      color, { ...oo, tint: bt });
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    quad(mesh, [T(sx * hw, -ey, sz * ez), T(sx * ex, -ey, sz * half), T(sx * ex, ey, sz * half), T(sx * hw, ey, sz * ez)],
      color, { ...oo, tint: bt });
  }
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    quad(mesh, [T(-ex, sy * hd, sz * ez), T(ex, sy * hd, sz * ez), T(ex, sy * hd, sz * half), T(-ex, sy * hd, sz * half)],
      color, { ...oo, tint: bt });
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    quad(mesh, [T(sx * hw, sy * ey, sz * ez), T(sx * ex, sy * hd, sz * ez), T(sx * ex, sy * ey, sz * half)],
      color, { ...oo, tint: bt });
  }
}

function cone(mesh, base, dir, radius, height, color, opts = {}) {
  const z = norm(dir);
  let u = cross([0, 0, 1], z);
  if (len(u) < 1e-4) u = cross([1, 0, 0], z);
  u = norm(u);
  const v = cross(z, u);
  const seg = opts.seg ?? 8;
  const ring = Array.from({ length: seg }, (_, i) => {
    const a = (i / seg) * Math.PI * 2;
    return add(base, add(mul(u, Math.cos(a) * radius), mul(v, Math.sin(a) * radius)));
  });
  const apex = add(base, mul(z, height));
  const mat = opts.mat ?? stoneMat(opts.seed ?? 0);
  for (let i = 0; i < seg; i++) {
    quad(mesh, [ring[i], ring[(i + 1) % seg], apex], color,
      { outward: base, ao: opts.ao ?? 1, mat, outline: opts.outline !== false });
  }
  for (let i = 0; i < seg; i++) {
    quad(mesh, [base, ring[(i + 1) % seg], ring[i]], color,
      { outward: sub(base, mul(z, 0.2)), ao: opts.ao ?? 1, mat, outline: false });
  }
}

function rivet(mesh, pos, dir, r, h, color = C.stoneLight, seed = 0) {
  cone(mesh, pos, dir, r, h, color, { seg: 8, outline: false, mat: stoneMat(seed), ao: 1.02 });
}

/* Grieta quebrada pegada a una cara plana. `normal` se pasa explícitamente
 * para controlar el lado outward en caras +X / +Y / superior. */
function crackOnFace(mesh, base, uAxis, vAxis, normal, path, width = 0.022, color = C.crack, seed = 0) {
  const n = norm(normal);
  for (let i = 0; i < path.length - 1; i++) {
    const [u0, v0] = path[i];
    const [u1, v1] = path[i + 1];
    const p0 = add(base, add(mul(uAxis, u0), mul(vAxis, v0)));
    const p1 = add(base, add(mul(uAxis, u1), mul(vAxis, v1)));
    const dir = norm(sub(p1, p0));
    const across = norm(cross(n, dir));
    const w = mul(across, width / 2);
    quad(mesh, [sub(p0, w), add(p0, w), add(p1, w), sub(p1, w)], color,
      { mat: stoneMat(seed), ao: 0.58, tint: 0.9, outline: false });
  }
}

// --------------------------------------------------------------------------
 // Modelo 3D
 // --------------------------------------------------------------------------
const PILLARS = [-1.18, 1.18].flatMap(x => [-1.18, 1.18].map(y => [x, y]));

function buildDais(m) {
  // Tres escalones de piedra: misma piedra, pero con la altura a la mitad.
  bevelBox(m, [0, 0, DAIS_Z[0]], [0, 0, DAIS_Z[1]], 1.90, 1.90, 0.06, C.stoneDark, { seed: 1, ao: 0.96 });
  bevelBox(m, [0, 0, DAIS_Z[1]], [0, 0, DAIS_Z[2]], 1.52, 1.52, 0.05, C.stone, { seed: 2 });
  bevelBox(m, [0, 0, DAIS_Z[2]], [0, 0, DAIS_Z[3]], 0.94, 0.94, 0.04, C.stoneLight, { seed: 3 });

  // Grietas en la cara superior del escalón intermedio.
  crackOnFace(m, [0, 0, DAIS_TOP + 0.002], [1, 0, 0], [0, 1, 0], [0, 0, 1],
    [[-0.58, 0.28], [-0.40, 0.14], [-0.45, -0.02], [-0.22, -0.16], [-0.26, -0.34]], 0.018, C.crack, 4);
  crackOnFace(m, [0, 0, DAIS_TOP + 0.002], [1, 0, 0], [0, 1, 0], [0, 0, 1],
    [[0.18, 0.42], [0.24, 0.22], [0.44, 0.10], [0.38, -0.08], [0.55, -0.22]], 0.016, C.crack, 5);

  // Perlas cian sobre el anillo: repiten el acento del cristal (estilo CoC).
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    rivet(m, [Math.cos(a) * 0.34, Math.sin(a) * 0.34, DAIS_TOP + 0.005], [0, 0, 1],
      0.035, 0.028, C.cyan, 20 + i);
  }
}

function buildPillars(m) {
  PILLARS.forEach(([px, py], idx) => {
    const s = idx * 17;
    // Zapata ancha y bien asentada (proporción chunky).
    bevelBox(m, [px, py, 0.02], [px, py, 0.20], 0.66, 0.66, 0.07, C.stoneDark, { seed: s + 1, ao: 0.95 });
    // Fuste inferior y superior: el superior más estrecho y claro.
    bevelBox(m, [px, py, 0.20], [px, py, 0.84], 0.48, 0.48, 0.06, C.stone, { seed: s + 2 });
    bevelBox(m, [px, py, 0.84], [px, py, 1.36], 0.42, 0.42, 0.06, C.stoneLight, { seed: s + 3 });
    // Remate partido en dos alturas: aspecto desgastado, no un cubo perfecto.
    bevelBox(m, [px - 0.11, py, 1.32], [px - 0.11, py, 1.46], 0.46, 0.46, 0.045, C.stone, { seed: s + 4 });
    bevelBox(m, [px + 0.12, py, 1.32], [px + 0.12, py, 1.38], 0.44, 0.44, 0.04, C.stoneDark, { seed: s + 5 });

    // Grietas en las dos caras que ve la cámara (+X y +Y).
    crackOnFace(m, [px + 0.246, py, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0],
      [[-0.11, 0.78], [-0.02, 0.66], [0.07, 0.61], [0.01, 0.49], [0.10, 0.40], [0.04, 0.29]],
      0.024, C.crack, s + 6);
    crackOnFace(m, [px, py + 0.246, 0], [-1, 0, 0], [0, 0, 1], [0, 1, 0],
      [[0.10, 0.74], [0.02, 0.63], [0.09, 0.55], [-0.03, 0.44], [0.03, 0.32]],
      0.022, C.crack, s + 7);
    crackOnFace(m, [px + 0.216, py, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0],
      [[-0.06, 1.30], [0.03, 1.19], [-0.02, 1.10], [0.07, 1.01]],
      0.020, C.crack, s + 8);
    // Grieta corta en la zapata, hacia el frente.
    crackOnFace(m, [px, py + 0.336, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0],
      [[-0.16, 0.16], [-0.07, 0.11], [0.02, 0.13], [0.11, 0.06]],
      0.018, C.crack, s + 9);
  });
}

/* Octaedro de 6 caras: dos pirámides unidas por un ecuador. Caras con tonos
 * distintos y una cara frontal más clara para que se lea el brillo cenital. */
function crystalShard(m, cx, cy, zMid, radius, height, seed = 0) {
  const seg = 6;
  const ring = Array.from({ length: seg }, (_, i) => {
    const a = (i / seg) * Math.PI * 2 + Math.PI / 6;
    return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, zMid];
  });
  const top = zMid + height * 0.66;
  const bottom = zMid - height * 0.55;
  let bright = null;
  for (let i = 0; i < seg; i++) {
    const a = ring[i], b = ring[(i + 1) % seg];
    const facet = (i + seed) % seg;
    const tint = facet === 1 ? 1.20 : facet === 2 ? 1.08 : facet === 4 ? 0.76 : facet === 5 ? 0.86 : 1;
    quad(m, [a, b, [cx, cy, top]], C.cyan,
      { outward: [cx, cy, zMid], mat: crystalMat(seed + i), outline: true, ao: 1.02, tint });
    quad(m, [b, a, [cx, cy, bottom]], C.cyanDeep,
      { outward: [cx, cy, zMid], mat: crystalMat(seed + i + 30), outline: true, ao: 0.94, tint });
    if (facet === 1) bright = [a, b, [cx, cy, top]];
  }
  // Destello interior: cara clara pegada a la faceta que mira a la cámara.
  if (bright) {
    const [a, b, apex] = bright;
    const n = norm(cross(sub(b, a), sub(apex, a)));
    const off = mul(n, 0.006);
    const center = [cx, cy, zMid];
    const shrink = (p, k) => add(add(center, mul(sub(p, center), k)), off);
    const p0 = shrink(a, 0.66);
    const p1 = shrink(b, 0.66);
    const p2 = shrink([cx, cy, top], 0.72);
    quad(m, [p0, p1, p2], C.cyanLight,
      { mat: crystalMat(seed + 99), outline: false, ao: 1.08, tint: 1.05 });
  }
}

function buildCrystal(m) {
  // Zócalo hexagonal que separa el cristal de la piedra. Baja con la base.
  cone(m, [0, 0, 0.34 - BASE_DROP], [0, 0, 1], 0.44, 0.09, C.stoneDark, { seg: 6, seed: 40 });
  cone(m, [0, 0, 0.43 - BASE_DROP], [0, 0, 1], 0.34, 0.06, C.cyanDeep, { seg: 6, seed: 41 });
  crystalShard(m, 0, 0, CRYSTAL_Z, 0.30, 1.06, 0);
  // Dos astillas menores: acompañan al cristal principal sin robarle protagonismo.
  crystalShard(m, -0.44, 0.30, 0.62 - BASE_DROP, 0.09, 0.30, 11);
  crystalShard(m, 0.46, 0.22, 0.66 - BASE_DROP, 0.075, 0.26, 23);
}

function buildCore() {
  const m = [];
  buildDais(m);
  buildPillars(m);
  buildCrystal(m);
  return m;
}

// --------------------------------------------------------------------------
 // Framebuffer con z-buffer, sombra de contacto y salida PNG
 // --------------------------------------------------------------------------
class Framebuffer {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.color = new Uint8Array(w * h * 4);
    this.depth = new Float32Array(w * h).fill(Infinity);
  }
  blend(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = (y * this.w + x) * 4;
    const sa = a / 255, da = this.color[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa <= 0) return;
    this.color[i] = (r * sa + this.color[i] * da * (1 - sa)) / oa;
    this.color[i + 1] = (g * sa + this.color[i + 1] * da * (1 - sa)) / oa;
    this.color[i + 2] = (b * sa + this.color[i + 2] * da * (1 - sa)) / oa;
    this.color[i + 3] = oa * 255;
  }
}

function edge(a, b, px, py) {
  return (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
}

function drawTri(fb, A, B, Cc, col, mat) {
  const area = edge(A, B, Cc.x, Cc.y);
  if (Math.abs(area) < 1e-9) return;
  const sign = area > 0 ? 1 : -1;
  const inv = 1 / area;
  const x0 = Math.max(0, Math.floor(Math.min(A.x, B.x, Cc.x)));
  const x1 = Math.min(fb.w - 1, Math.ceil(Math.max(A.x, B.x, Cc.x)));
  const y0 = Math.max(0, Math.floor(Math.min(A.y, B.y, Cc.y)));
  const y1 = Math.min(fb.h - 1, Math.ceil(Math.max(A.y, B.y, Cc.y)));
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const w0 = edge(B, Cc, px, py), w1 = edge(Cc, A, px, py), w2 = edge(A, B, px, py);
      if (w0 * sign < 0 || w1 * sign < 0 || w2 * sign < 0) continue;
      const z = (w0 * A.z + w1 * B.z + w2 * Cc.z) * inv;
      const i = y * fb.w + x;
      if (z >= fb.depth[i]) continue;
      fb.depth[i] = z;
      let r = col[0], g = col[1], b = col[2];
      if (mat) {
        const wx = (w0 * A.wx + w1 * B.wx + w2 * Cc.wx) * inv;
        const wy = (w0 * A.wy + w1 * B.wy + w2 * Cc.wy) * inv;
        const wz = (w0 * A.wz + w1 * B.wz + w2 * Cc.wz) * inv;
        const f = materialFactor(mat, [wx, wy, wz]);
        r *= f; g *= f; b *= f;
      }
      const o = i * 4;
      fb.color[o] = r < 0 ? 0 : r > 255 ? 255 : r | 0;
      fb.color[o + 1] = g < 0 ? 0 : g > 255 ? 255 : g | 0;
      fb.color[o + 2] = b < 0 ? 0 : b > 255 ? 255 : b | 0;
      fb.color[o + 3] = 255;
    }
  }
}

function softEllipse(fb, cx, cy, rx, ry, alpha, color = [20, 18, 26]) {
  const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(fb.w - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(fb.h - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const r2 = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (r2 >= 1) continue;
      const a = alpha * Math.pow(1 - r2, 1.55);
      fb.blend(x, y, color[0], color[1], color[2], a * 255);
    }
  }
}

function project(p, target, cx, cy) {
  const d = sub(p, target);
  return {
    x: cx + dot(d, RIGHT) * PPU,
    y: cy - dot(d, UP) * PPU,
    z: -dot(d, VIEW),
    wx: p[0], wy: p[1], wz: p[2],
  };
}

function drawCoreShadow(fb, cx, cy) {
  softEllipse(fb, cx - 20 * SS, cy + 8 * SS, 126 * SS, 50 * SS, 0.12, [26, 22, 34]);
  softEllipse(fb, cx - 4 * SS, cy + 4 * SS, 100 * SS, 38 * SS, 0.18, [18, 16, 26]);
  softEllipse(fb, cx + 2 * SS, cy + 1 * SS, 74 * SS, 27 * SS, 0.22, [12, 10, 18]);
  // Contacto duro bajo cada pilar y bajo el zócalo central.
  for (const [x, y] of PILLARS) {
    const p = project([x, y, 0], [0, 0, 0], cx, cy);
    softEllipse(fb, p.x + 1 * SS, p.y + 2 * SS, 22 * SS, 10 * SS, 0.26, [10, 9, 16]);
  }
  softEllipse(fb, cx, cy, 34 * SS, 14 * SS, 0.24, [10, 9, 16]);
}

/* Contorno nítido de 1 px solo en la silueta (calculado tras el downsample). */
function addOutline(img) {
  const src = img.data.slice();
  const w = img.w, h = img.h;
  const [or, og, ob] = C.outline;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] > 180) continue;
      let hit = false;
      for (let dy = -1; dy <= 1 && !hit; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const j = ((y + dy) * w + (x + dx)) * 4;
          if (src[j + 3] > 200) { hit = true; break; }
        }
      }
      if (!hit) continue;
      img.data[i] = or; img.data[i + 1] = og; img.data[i + 2] = ob;
      img.data[i + 3] = 255;
    }
  }
}

function render(mesh, target, anchor, { shadow = false } = {}) {
  const fb = new Framebuffer(CELL * SS, CELL * SS);
  const cx = anchor[0] * SS, cy = anchor[1] * SS;
  if (shadow) drawCoreShadow(fb, cx, cy);
  for (const t of mesh) {
    const n = norm(cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0])));
    if (!isFinite(n[0]) || len(n) < 1e-7) continue;
    const col = shade(t.color, n, t.ao, t.tint);
    drawTri(fb,
      project(t.p[0], target, cx, cy),
      project(t.p[1], target, cx, cy),
      project(t.p[2], target, cx, cy),
      col, t.mat);
  }
  const out = downsample(fb, CELL * SS, CELL * SS, SS);
  addOutline(out);
  return out;
}

function downsample(fb, w, h, factor) {
  const ow = w / factor, oh = h / factor;
  const out = new Uint8Array(ow * oh * 4);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      let a = 0, r = 0, g = 0, b = 0;
      for (let sy = 0; sy < factor; sy++) {
        for (let sx = 0; sx < factor; sx++) {
          const i = ((y * factor + sy) * w + x * factor + sx) * 4;
          const al = fb.color[i + 3] / 255;
          a += al; r += fb.color[i] * al; g += fb.color[i + 1] * al; b += fb.color[i + 2] * al;
        }
      }
      const n = factor * factor;
      const o = (y * ow + x) * 4;
      out[o + 3] = Math.round((a / n) * 255);
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
    }
  }
  return { data: out, w: ow, h: oh };
}

/* Resplandor radial cian. Se hornea como PNG y Phaser solo anima su alfa. */
function makeGlow() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / c;
      if (d >= 1) continue;
      const halo = Math.pow(1 - d, 1.9) * 0.58;
      const hot = Math.pow(Math.max(0, 1 - d / 0.18), 1.5) * 0.40;
      const i = (y * size + x) * 4;
      data[i] = 104; data[i + 1] = 228; data[i + 2] = 255;
      data[i + 3] = Math.round(Math.min(1, halo + hot) * 255);
    }
  }
  return { data, w: size, h: size };
}

// --------------------------------------------------------------------------
 // PNG RGBA8 (filtro 0) + utilidades de composición y verificación
 // --------------------------------------------------------------------------
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
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
function blit(dst, src, ox, oy) {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4;
      const sa = src.data[si + 3] / 255;
      if (sa <= 0) continue;
      const dx = x + ox, dy = y + oy;
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
function boundingBox(img) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (img.data[(y * img.w + x) * 4 + 3] > 8) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return [x0, y0, x1, y1];
}
function preview(img, label, step = 6) {
  const chars = ' .:-=+*#%@';
  const lines = [];
  for (let y = 0; y < img.h; y += step) {
    let line = '';
    for (let x = 0; x < img.w; x += step) {
      let a = 0, l = 0, n = 0;
      for (let sy = 0; sy < step && y + sy < img.h; sy++) {
        for (let sx = 0; sx < step && x + sx < img.w; sx++) {
          const i = ((y + sy) * img.w + x + sx) * 4;
          const al = img.data[i + 3] / 255;
          if (al > 0.15) { a++; l += (img.data[i] * 0.3 + img.data[i + 1] * 0.59 + img.data[i + 2] * 0.11) / 255; }
          n++;
        }
      }
      const cov = a / n;
      const lum = a ? l / a : 0;
      line += cov < 0.08 ? ' ' : chars[Math.max(1, Math.min(chars.length - 1, Math.round(lum * (chars.length - 1))))];
    }
    lines.push(line.replace(/\s+$/, ''));
  }
  console.log(`\n--- ${label} (${img.w}x${img.h}) ---`);
  console.log(lines.join('\n'));
}

function compositePreview(core, glow) {
  const W = 512, H = 512;
  const dst = { w: W, h: H, data: new Uint8Array(W * H * 4) };
  for (let i = 0; i < W * H; i++) {
    dst.data[i * 4] = 43; dst.data[i * 4 + 1] = 42; dst.data[i * 4 + 2] = 48;
    dst.data[i * 4 + 3] = 255;
  }
  const ox = (W - CELL) / 2, oy = (H - CELL) / 2;
  // Resplandor centrado en el cristal: ANCHOR.y - GLOW_LIFT px de arte.
  const gy = oy + ANCHOR[1] - GLOW_LIFT - glow.h / 2;
  const gx = ox + ANCHOR[0] - glow.w / 2;
  blit(dst, glow, gx, gy);
  blit(dst, core, ox, oy);
  return dst;
}

// --------------------------------------------------------------------------
 // Horneado
 // --------------------------------------------------------------------------
const started = Date.now();
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PREVIEW_DIR, { recursive: true });

const coreMesh = buildCore();
const core = render(coreMesh, [0, 0, 0], ANCHOR, { shadow: true });
const glow = makeGlow();

fs.writeFileSync(path.join(OUT, 'core.png'), encodePNG(core));
fs.writeFileSync(path.join(OUT, 'core-glow.png'), encodePNG(glow));

const meta = {
  generator: 'tools/core-art/generate.mjs',
  cell: CELL, pad: PAD, supersampling: SS, ppm: PPU / SS,
  elevationDeg: 30, azimuthDeg: 45,
  anchor: { x: ANCHOR[0], y: ANCHOR[1] },
  artScale: ART_SCALE,
  glow: { lift: GLOW_LIFT, size: GLOW_SIZE },
  bbox: boundingBox(core),
};
fs.writeFileSync(path.join(OUT, 'core-art.json'), JSON.stringify(meta, null, 2) + '\n');
fs.writeFileSync(path.join(PREVIEW_DIR, 'preview.png'), encodePNG(compositePreview(core, glow)));

preview(core, 'CORE', 6);
console.log(`\nHorneado en ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log(`ancla=${ANCHOR.join(',')}  artScale=${ART_SCALE}  bbox=${meta.bbox.join('..')}`);
const margin = Math.min(meta.bbox[0], meta.bbox[1], CELL - 1 - meta.bbox[2], CELL - 1 - meta.bbox[3]);
console.log(`margen=${margin}px`);
if (margin < PAD) console.warn('AVISO: el modelo toca el borde de la celda; reduce PPU o sube CELL.');
