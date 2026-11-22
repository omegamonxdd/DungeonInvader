/* ==========================================================================
 * GENERADOR DE ARTE DE LA BALLESTA (pipeline coc-25d-pipeline)
 * --------------------------------------------------------------------------
 * Modelo 3D estilizado -> cámara ortográfica isométrica real -> spritesheets.
 * No se usa ningún escalado/cizalla 2D de una vista lateral: cada fotograma
 * se renderiza desde la geometría con rotación real sobre el eje vertical.
 *
 * El modelo sigue la referencia de Ballesta.jpeg: trípode de madera con
 * amarres de cuerda, cureña gruesa, arco de madera con refuerzo metálico,
 * cuerda tensada y saeta roja. Todas las piezas comparten paleta, biseles,
 * grano de madera y una única luz fija de mundo (la luz NO gira con la
 * torreta: se sombrea después de rotar la geometría).
 *
 * Uso:  npm run art:ballista
 *
 * Salida en front/assets/estructuras/ballesta/:
 *   ballista-base.png          256x256, pedestal + sombra de contacto
 *   ballista-head-sheet.png    24 ángulos x 3 estados (referencia canónica)
 *   ballista-head-g0..g3.png   4 atlas de 6 ángulos x 3 estados (los usa Phaser)
 *   ballista-art.json          medidas/anclas derivadas del render
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT = path.resolve('front/assets/estructuras/ballesta');
const PREVIEW_DIR = path.resolve('tools/ballista-art');

// --- Configuración del horneado -------------------------------------------
const CELL = 256;          // px por celda a la salida
const PAD = 4;             // margen transparente por celda (anti bleeding)
const SS = 4;              // supersampling
const PPU = 62 * SS;       // px por unidad de mundo, ya multiplicado por SS
const ANGLES = 24;         // 360 / 15
const STATES = 3;          // idle, fire, recover
const GROUP = 6;           // ángulos por atlas de Phaser (evita texturas >4096)

// Cámara isométrica: azimut 45°, elevación 30°, proyección ortográfica.
const AZ = Math.PI / 4;
const EL = Math.PI / 6;
const VIEW = [Math.cos(EL) * Math.cos(AZ), Math.cos(EL) * Math.sin(AZ), Math.sin(EL)];
const RIGHT = [Math.sin(AZ), -Math.cos(AZ), 0];
const UP = [-Math.sin(EL) * Math.cos(AZ), -Math.sin(EL) * Math.sin(AZ), Math.cos(EL)];

// Altura del pivote de la cabeza sobre el suelo (unidades de mundo).
const HEAD_Z = 1.55;
// Escala de arte recomendada para Phaser (px de mundo por px de sprite).
const ART_SCALE = 0.67;
// Donde cae el origen del mundo dentro de cada imagen (en px de salida).
const BASE_GROUND = [128, 170];
const HEAD_PIVOT = [128, 128];

// Paleta común a todas las piezas (madera cálida, metal mate, cuerda y rojo).
const C = {
  wood: [204, 122, 64],
  woodLight: [236, 162, 88],
  woodDark: [158, 78, 36],
  woodDeep: [112, 48, 22],
  woodPale: [226, 176, 116],
  rope: [228, 206, 158],
  ropeDark: [184, 154, 104],
  metal: [100, 98, 108],
  metalLight: [140, 138, 148],
  metalDark: [62, 60, 70],
  red: [208, 48, 36],
  redLight: [246, 82, 64],
  redDark: [150, 28, 22],
  flash: [255, 234, 154],
  flashHot: [255, 138, 62],
  outline: [44, 26, 20],
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
function rotZ(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
}

// --------------------------------------------------------------------------
// Iluminación y materiales
// --------------------------------------------------------------------------
function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }

/* Sombreado plano por cara con luz de mundo. La madera recibe un tono cálido
 * en la clave y el metal un relleno azulado; así todas las piezas se leen
 * como un mismo set. */
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

function woodMat(axis, u, v, seed = 0) {
  return { kind: 'wood', axis: norm(axis), u: norm(u), v: norm(v), seed, freq: 15 };
}
function ropeMat(axis, u, v, seed = 0) {
  return { kind: 'rope', axis: norm(axis), u: norm(u), v: norm(v), seed, freq: 58 };
}
function metalMat(seed = 0) { return { kind: 'metal', seed }; }

/* Detalle procedural por píxel: vetas de madera suaves, fibras de cuerda y
 * ruido metálico. Devuelve un factor que modula el color ya sombreado. */
function materialFactor(mat, p) {
  if (!mat) return 1;
  let m = 1;
  if (mat.kind === 'wood') {
    const a = dot(p, mat.u) * mat.freq + mat.seed;
    const b = dot(p, mat.v) * mat.freq * 0.72 + mat.seed * 1.7;
    const grain = Math.sin(a + 0.55 * Math.sin(b * 0.6)) * 0.55
      + Math.sin(a * 2.3 + 1.9) * 0.22
      + Math.sin(a * 0.41 + b * 0.13) * 0.23;
    m += grain * 0.062;
    m += (hash2(Math.floor(dot(p, mat.u) * 72), Math.floor(dot(p, mat.axis) * 72)) - 0.5) * 0.024;
  } else if (mat.kind === 'rope') {
    const t = dot(p, mat.axis) * mat.freq + mat.seed;
    m += Math.sin(t) * 0.055;
    m += (hash2(Math.floor(p[0] * 95), Math.floor(p[1] * 95) + Math.floor(p[2] * 95)) - 0.5) * 0.022;
  } else {
    m += (hash2(Math.floor(p[0] * 64), Math.floor(p[1] * 64) + Math.floor(p[2] * 64)) - 0.5) * 0.032;
  }
  return m;
}

// --------------------------------------------------------------------------
// Malla: triángulos con color base; el sombreado se hace tras rotar la pieza.
// --------------------------------------------------------------------------
function quad(mesh, pts, color, opts = {}) {
  let n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
  if (!isFinite(n[0])) return;
  // Garantiza normales hacia fuera. Imprescindible para que la luz fija
  // ilumine las caras correctas y para que el contorno quede limpio.
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

/* Caja biselada orientada entre p0 y p1. `upHint` fija el giro de la sección
 * para que `w` sea el ancho lateral y `d` el grosor vertical. */
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
  const mat = opts.mat ?? woodMat(zAxis, xAxis, yAxis, opts.seed ?? 0);
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
  // Biseles de canto: capturan el brillo cenital y evitan aristas a 90°.
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

/* Viga barrida con sección rectangular biselada. El marco acompaña a la
 * tangente para que la pala del arco sea una tabla plana y robusta (no un
 * tubo redondo), igual que el prod de la referencia. */
function sweepBox(mesh, points, w, d, bevel, color, opts = {}) {
  const hw = w / 2, hd = d / 2;
  const b = Math.min(bevel, hw * 0.42, hd * 0.42);
  const sec = [
    [-hw + b, -hd], [hw - b, -hd], [hw, -hd + b], [hw, hd - b],
    [hw - b, hd], [-hw + b, hd], [-hw, hd - b], [-hw, -hd + b],
  ];
  const rings = points.map((p, i) => {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const t = norm(sub(next, prev));
    let xa = cross(opts.up ?? [0, 0, 1], t);
    if (len(xa) < 1e-4) xa = cross([1, 0, 0], t);
    xa = norm(xa);
    const ya = norm(cross(t, xa));
    return { p, t, xa, ya, q: sec.map(([x, y]) => add(p, add(mul(xa, x), mul(ya, y)))) };
  });
  const mat = opts.mat ?? woodMat(norm(sub(points[points.length - 1], points[0])),
    rings[0].xa, rings[0].ya, opts.seed ?? 0);
  const oo = { ao: opts.ao ?? 1, mat, outline: opts.outline !== false };
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i], B = rings[i + 1];
    for (let j = 0; j < sec.length; j++) {
      const k = (j + 1) % sec.length;
      const outward = sub(mul(add(A.q[j], B.q[k]), 0.5), mul(add(A.p, B.p), 0.5));
      quad(mesh, [A.q[j], B.q[j], B.q[k], A.q[k]], color, { ...oo, outward });
    }
  }
  if (opts.cap !== false) {
    const A = rings[0], B = rings[rings.length - 1];
    for (let j = 1; j < sec.length - 1; j++) {
      quad(mesh, [A.q[0], A.q[j], A.q[j + 1]], color, { ...oo, outward: mul(A.t, -1) });
      quad(mesh, [B.q[0], B.q[j + 1], B.q[j]], color, { ...oo, outward: B.t });
    }
  }
}

/* Tubo con volumen real. Usa transporte paralelo del marco para que la
 * sección no gire sobre sí misma en curvas (arco, cuerdas, amarres). */
function tube(mesh, points, radius, color, opts = {}) {
  const seg = opts.seg ?? 9;
  const n = points.length;
  if (n < 2) return;
  const rings = [];
  let u = null;
  for (let i = 0; i < n; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(n - 1, i + 1)];
    const t = norm(sub(next, prev));
    if (!u) {
      const ref = Math.abs(t[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      u = norm(cross(ref, t));
    } else {
      u = sub(u, mul(t, dot(u, t)));
      if (len(u) < 1e-5) {
        const ref = Math.abs(t[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
        u = norm(cross(ref, t));
      } else {
        u = norm(u);
      }
    }
    const v = cross(t, u);
    const r = radius * (opts.taper ? opts.taper(n === 1 ? 0 : i / (n - 1)) : 1);
    rings.push({
      t, u, v, r,
      pts: Array.from({ length: seg }, (_, j) => {
        const a = (j / seg) * Math.PI * 2;
        return add(points[i], add(mul(u, Math.cos(a) * r), mul(v, Math.sin(a) * r)));
      }),
    });
  }
  const axis = norm(sub(points[n - 1], points[0]));
  const mat = opts.mat ?? (opts.rope
    ? ropeMat(axis, rings[0].u, rings[0].v, opts.seed ?? 0)
    : woodMat(axis, rings[0].u, rings[0].v, opts.seed ?? 0));
  for (let i = 0; i < n - 1; i++) {
    const axisMid = mul(add(points[i], points[i + 1]), 0.5);
    for (let j = 0; j < seg; j++) {
      const k = (j + 1) % seg;
      quad(mesh, [rings[i].pts[j], rings[i].pts[k], rings[i + 1].pts[k], rings[i + 1].pts[j]], color,
        { outward: axisMid, ao: opts.ao ?? 1, mat, outline: false });
    }
  }
  if (opts.cap !== false) {
    const c0 = points[0];
    for (let j = 0; j < seg; j++) {
      const k = (j + 1) % seg;
      quad(mesh, [c0, rings[0].pts[k], rings[0].pts[j]], color,
        { outward: sub(c0, mul(rings[0].t, 0.2)), ao: opts.ao ?? 1, mat, outline: false });
    }
    const c1 = points[n - 1];
    for (let j = 0; j < seg; j++) {
      const k = (j + 1) % seg;
      quad(mesh, [c1, rings[n - 1].pts[j], rings[n - 1].pts[k]], color,
        { outward: add(c1, mul(rings[n - 1].t, 0.2)), ao: opts.ao ?? 1, mat, outline: false });
    }
  }
}

function cone(mesh, base, dir, radius, height, color, opts = {}) {
  const z = norm(dir);
  let u = cross([0, 0, 1], z);
  if (len(u) < 1e-4) u = cross([1, 0, 0], z);
  u = norm(u);
  const v = cross(z, u);
  const seg = opts.seg ?? 10;
  const ring = Array.from({ length: seg }, (_, i) => {
    const a = (i / seg) * Math.PI * 2;
    return add(base, add(mul(u, Math.cos(a) * radius), mul(v, Math.sin(a) * radius)));
  });
  const apex = add(base, mul(z, height));
  const mat = opts.mat ?? metalMat(opts.seed ?? 0);
  for (let i = 0; i < seg; i++) {
    quad(mesh, [ring[i], ring[(i + 1) % seg], apex], color,
      { outward: base, ao: opts.ao ?? 1, mat, outline: opts.outline !== false });
  }
  for (let i = 0; i < seg; i++) {
    quad(mesh, [base, ring[(i + 1) % seg], ring[i]], color,
      { outward: sub(base, mul(z, 0.2)), ao: opts.ao ?? 1, mat, outline: false });
  }
}

function helix(center, axis, radius, turns, length, steps) {
  const z = norm(axis);
  let u = cross([0, 0, 1], z);
  if (len(u) < 1e-4) u = cross([1, 0, 0], z);
  u = norm(u);
  const v = cross(z, u);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    return add(add(center, mul(z, (t - 0.5) * length)),
      add(mul(u, Math.cos(a) * radius), mul(v, Math.sin(a) * radius)));
  });
}

/* Amarre de cuerda con volumen real: hélice tubular + nudo de remate. */
function ropeWrap(mesh, center, axis, radius, turns, length, thickness, color = C.rope, opts = {}) {
  const pts = helix(center, axis, radius, turns, length, Math.max(14, Math.round(turns * 11)));
  tube(mesh, pts, thickness, color, { seg: 6, rope: true, ao: 0.96, seed: opts.seed ?? 0 });
  const end = pts[pts.length - 1];
  const dir = norm(sub(end, pts[pts.length - 3]));
  cone(mesh, end, dir, thickness * 1.55, thickness * 1.1, color, { seg: 6, outline: false, seed: opts.seed ?? 0 });
}

/* Remache semiesférico mate. */
function rivet(mesh, pos, dir, r, h, color = C.metalLight, seed = 0) {
  cone(mesh, pos, dir, r, h, color, { seg: 8, outline: false, mat: metalMat(seed), ao: 1.02 });
}

/* Punta de flecha con sección de rombo y arista central. */
function diamondHead(mesh, x0, x1, yRad, zRad, zCenter, color, opts = {}) {
  const base = [
    [x0, 0, zCenter + zRad],
    [x0, yRad, zCenter],
    [x0, 0, zCenter - zRad],
    [x0, -yRad, zCenter],
  ];
  const apex = [x1, 0, zCenter];
  const mat = opts.mat ?? metalMat(opts.seed ?? 0);
  for (let i = 0; i < 4; i++) {
    quad(mesh, [base[i], base[(i + 1) % 4], apex], color,
      { outward: [x0, 0, zCenter], mat, outline: true, ao: 1.02 });
  }
  for (let i = 0; i < 4; i++) {
    quad(mesh, [[x0, 0, zCenter], base[(i + 1) % 4], base[i]], color,
      { outward: [x0 - 0.2, 0, zCenter], mat, outline: false, ao: 0.9 });
  }
}

/* Pluma triangular extruida alrededor del eje X (aletas de la saeta).
 * `zCenter` sitúa la base de la aleta sobre el asta. */
function fin(mesh, x0, x1, angle, radial, thickness, color, opts = {}) {
  const zc = opts.zCenter ?? 0;
  const cy = Math.cos(angle), sy = Math.sin(angle);
  const r = (rad) => [0, cy * rad, sy * rad];
  const t = (side) => [0, -sy * side, cy * side];
  const pts = [
    [x0, 0.035, 0],
    [x1, 0.035, 0],
    [x1 - 0.075, radial, 0],
    [x0 + 0.075, radial * 0.82, 0],
  ].map(([x, rad, side]) => add(add([x, 0, zc], r(rad)), t(side)));
  const half = thickness / 2;
  const front = pts.map(p => add(p, t(half)));
  const back = pts.map(p => add(p, t(-half)));
  const mid = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) mid[0] += pts[i][0] / pts.length;
  const mat = opts.mat ?? metalMat(opts.seed ?? 0);
  // Dos caras grandes (una a cada lado del plano de la aleta).
  quad(mesh, front, color, { outward: add(mid, t(0.2)), mat, ao: 1.02, outline: true });
  quad(mesh, back.slice().reverse(), color, { outward: add(mid, t(-0.2)), mat, ao: 0.9, outline: true });
  // Cantos.
  for (let i = 0; i < pts.length; i++) {
    const k = (i + 1) % pts.length;
    quad(mesh, [front[i], front[k], back[k], back[i]], color,
      { outward: add(mid, [0, 0, 0]), mat, ao: 0.95, outline: false });
  }
}

/* Junta de tabla: línea oscura fina pegada a una cara plana. Aporta el
 * detalle de madera construida sin geometría que ensucie la silueta. */
function seam(mesh, p0, p1, normal, width, color = C.woodDeep, seed = 0) {
  const n = norm(normal);
  const t = norm(sub(p1, p0));
  let across = cross(n, t);
  if (len(across) < 1e-5) return;
  across = norm(across);
  const a = add(p0, mul(n, 0.003));
  const b = add(p1, mul(n, 0.003));
  const w = mul(across, width / 2);
  quad(mesh, [sub(a, w), add(a, w), add(b, w), sub(b, w)], color,
    { mat: woodMat(t, across, n, seed), outline: false, ao: 0.72 });
}

// --------------------------------------------------------------------------
// Modelo 3D: pedestal estático (trípode) y cabeza giratoria (cureña + arco)
// --------------------------------------------------------------------------
const LEG_AZ = [Math.PI / 4, Math.PI * 11 / 12, Math.PI * 19 / 12];
const FOOT_R = 0.90;
const TOP_R = 0.18;
const FOOT_Z = 0.20;
const TOP_Z = 1.18;

function buildBase() {
  const m = [];
  const legs = [];

  for (const a of LEG_AZ) {
    const dir = [Math.cos(a), Math.sin(a), 0];
    const foot = [dir[0] * FOOT_R, dir[1] * FOOT_R, FOOT_Z];
    const top = [dir[0] * TOP_R, dir[1] * TOP_R, TOP_Z];
    legs.push({ foot, top, dir });

    // Pata gruesa y biselada, con zapata ancha y tobillo de bloque.
    bevelBox(m, foot, top, 0.38, 0.38, 0.09, C.wood, { seed: a * 11, ao: 0.98 });
    const fx = dir[0] * FOOT_R, fy = dir[1] * FOOT_R;
    bevelBox(m, [fx, fy, 0.02], [fx, fy, 0.26], 0.52, 0.52, 0.09, C.woodDark, { seed: a * 11 + 1 });
    bevelBox(m, [fx, fy, 0.26], [fx, fy, 0.38], 0.40, 0.40, 0.07, C.wood, { seed: a * 11 + 2 });

    // Amarres de la pata: dos vueltas altas y una baja sobre el tobillo.
    const hi = add(foot, mul(sub(top, foot), 0.84));
    ropeWrap(m, hi, sub(top, foot), 0.245, 2.4, 0.16, 0.032, C.rope, { seed: a * 3 });
    const mid = add(foot, mul(sub(top, foot), 0.945));
    ropeWrap(m, mid, sub(top, foot), 0.245, 1.8, 0.11, 0.030, C.ropeDark, { seed: a * 3 + 1 });
  }

  // Travesaños bajos entre las tres zapatas.
  for (let i = 0; i < 3; i++) {
    const a = legs[i].foot, b = legs[(i + 1) % 3].foot;
    bevelBox(m, [a[0], a[1], 0.30], [b[0], b[1], 0.30], 0.22, 0.20, 0.05, C.woodDark,
      { seed: 20 + i, ao: 0.9 });
  }

  // Poste central de dos tramos, más ancho en la base.
  bevelBox(m, [0, 0, 0.10], [0, 0, 0.58], 0.56, 0.56, 0.08, C.wood, { seed: 30 });
  bevelBox(m, [0, 0, 0.58], [0, 0, 1.18], 0.50, 0.50, 0.07, C.wood, { seed: 31 });
  bevelBox(m, [0, 0, 0.54], [0, 0, 0.66], 0.66, 0.66, 0.06, C.woodDark, { seed: 32 });

  // Juntas verticales de tabla en las caras que ve la cámara.
  for (const sy of [-0.09, 0.09]) {
    seam(m, [-0.285, sy, 0.16], [-0.285, sy, 0.52], [-1, 0, 0], 0.018, C.woodDeep, 30);
    seam(m, [-0.255, sy, 0.64], [-0.255, sy, 1.10], [-1, 0, 0], 0.018, C.woodDeep, 31);
  }
  for (const sx of [-0.09, 0.09]) {
    seam(m, [sx, -0.285, 0.16], [sx, -0.285, 0.52], [0, -1, 0], 0.018, C.woodDeep, 32);
    seam(m, [sx, -0.255, 0.64], [sx, -0.255, 1.10], [0, -1, 0], 0.018, C.woodDeep, 33);
  }

  // Plataforma superior y placa de giro (más baja y ancha: base achaparrada).
  bevelBox(m, [0, 0, 1.16], [0, 0, 1.32], 1.10, 1.10, 0.09, C.wood, { seed: 34 });
  bevelBox(m, [0, 0, 1.32], [0, 0, 1.36], 0.84, 0.84, 0.05, C.woodDark, { seed: 35 });
  // Plato de giro: anillo metálico con disco de madera encima. La cureña
  // apoya sobre el disco; el pivote de la cabeza queda dentro de él.
  tube(m, [[0, 0, 1.33], [0, 0, 1.47]], 0.50, C.metal,
    { seg: 20, mat: metalMat(36), ao: 0.98 });
  tube(m, [[0, 0, 1.46], [0, 0, 1.58]], 0.46, C.wood, { seg: 20, seed: 37, ao: 1.0 });
  tube(m, [[0, 0, 1.56], [0, 0, 1.60]], 0.40, C.woodDark, { seg: 20, seed: 38 });

  // Amarres del poste.
  ropeWrap(m, [0, 0, 0.72], [0, 0, 1], 0.30, 3.0, 0.18, 0.034, C.rope, { seed: 40 });
  ropeWrap(m, [0, 0, 0.36], [0, 0, 1], 0.33, 2.2, 0.14, 0.032, C.ropeDark, { seed: 41 });

  // Abrazadera metálica bajo la plataforma con remaches.
  bevelBox(m, [0, 0, 1.10], [0, 0, 1.18], 0.64, 0.64, 0.05, C.metalDark,
    { seed: 42, mat: metalMat(42), ao: 0.96 });
  for (const [x, y] of [[-0.26, -0.26], [0.26, -0.26], [-0.26, 0.26], [0.26, 0.26]]) {
    rivet(m, [x, y, 1.18], [0, 0, 1], 0.048, 0.038, C.metalLight, 43);
  }

  // Cartelas diagonales que ensanchan el poste bajo la plataforma.
  for (const a of LEG_AZ) {
    const dir = [Math.cos(a), Math.sin(a), 0];
    bevelBox(m, [dir[0] * 0.20, dir[1] * 0.20, 0.94], [dir[0] * 0.48, dir[1] * 0.48, 1.20],
      0.16, 0.16, 0.04, C.woodDark, { seed: 50 + a });
  }

  // Sillín de madera bajo la cureña: reparte el peso sobre el plato y
  // evita que la cabeza parezca flotar sobre el metal. Es redondo para
  // que la cabeza gire sin cruzar esquinas.
  tube(m, [[0, 0, 1.57], [0, 0, 1.65]], 0.34, C.wood, { seg: 18, seed: 60, ao: 1.0 });
  tube(m, [[0, 0, 1.63], [0, 0, 1.665]], 0.28, C.woodDark, { seg: 18, seed: 61 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    rivet(m, [Math.cos(a) * 0.29, Math.sin(a) * 0.29, 1.655], [0, 0, 1], 0.04, 0.03, C.metalLight, 62 + i);
  }

  return m;
}

function buildHead(state) {
  const m = [];
  // Retroceso: la cabeza entera se echa hacia atrás al disparar.
  const recoil = state === 1 ? -0.16 : state === 2 ? -0.05 : 0;
  const S = p => [p[0] + recoil, p[1], p[2]];

  // --- Cureña: viga gruesa, culata ancha y morro corto.
  bevelBox(m, S([-1.05, 0, 0.20]), S([1.00, 0, 0.20]), 0.44, 0.38, 0.09, C.wood,
    { seed: 70, ao: 1.0 });
  bevelBox(m, S([-1.26, 0, 0.20]), S([-0.94, 0, 0.20]), 0.56, 0.50, 0.10, C.woodDark,
    { seed: 71 });
  bevelBox(m, S([-1.30, 0, 0.20]), S([-1.24, 0, 0.20]), 0.50, 0.44, 0.02, C.metalDark,
    { seed: 72, mat: metalMat(72) });
  bevelBox(m, S([0.96, 0, 0.20]), S([1.14, 0, 0.20]), 0.36, 0.30, 0.06, C.wood,
    { seed: 73 });
  bevelBox(m, S([1.04, 0, 0.20]), S([1.10, 0, 0.20]), 0.40, 0.34, 0.02, C.metalDark,
    { seed: 74, mat: metalMat(74) });
  ropeWrap(m, S([-0.92, 0, 0.20]), [1, 0, 0], 0.31, 2.8, 0.22, 0.034, C.rope, { seed: 75 });

  // Juntas de tabla en el costado que ve la cámara.
  for (const zz of [0.10, 0.30]) {
    seam(m, S([-0.86, -0.225, zz]), S([0.92, -0.225, zz]), [0, -1, 0], 0.016, C.woodDeep, 76);
  }

  // --- Carriles superiores: dos vigas con canal central para la saeta.
  bevelBox(m, S([-0.82, 0, 0.42]), S([0.98, 0, 0.42]), 0.42, 0.10, 0.03, C.woodDark,
    { seed: 77 });
  for (const sy of [-1, 1]) {
    bevelBox(m, S([-0.82, sy * 0.155, 0.50]), S([0.98, sy * 0.155, 0.50]), 0.13, 0.14, 0.03,
      C.woodLight, { seed: 78 + sy });
  }
  bevelBox(m, S([-0.82, 0, 0.455]), S([0.98, 0, 0.455]), 0.20, 0.02, 0.008, C.woodDeep,
    { seed: 80, outline: false, ao: 0.78 });

  // --- Tambor lateral con cubo hexagonal (pieza de la referencia).
  const drum = [-0.16, 0.30, 0.33];
  tube(m, [[drum[0], drum[1] - 0.12, drum[2]], [drum[0], drum[1] + 0.13, drum[2]]], 0.27, C.wood,
    { seg: 14, seed: 81, ao: 0.98 });
  tube(m, [[drum[0], drum[1] + 0.13, drum[2]], [drum[0], drum[1] + 0.20, drum[2]]], 0.17, C.metal,
    { seg: 6, mat: metalMat(82), ao: 0.99 });
  tube(m, [[drum[0], drum[1] + 0.19, drum[2]], [drum[0], drum[1] + 0.215, drum[2]]], 0.10, C.metalLight,
    { seg: 6, mat: metalMat(83), ao: 1.02 });

  // --- Abrazadera metálica del arco: pinza compacta y oscura con perno hex.
  const bx = 0.66;
  bevelBox(m, S([bx - 0.17, 0, 0.47]), S([bx + 0.17, 0, 0.47]), 0.50, 0.42, 0.06, C.metalDark,
    { seed: 84, mat: metalMat(84), ao: 0.98 });
  bevelBox(m, S([bx - 0.15, 0, 0.69]), S([bx + 0.15, 0, 0.69]), 0.46, 0.09, 0.02, C.metal,
    { seed: 85, mat: metalMat(85) });
  for (const sy of [-1, 1]) {
    bevelBox(m, S([bx - 0.14, sy * 0.255, 0.45]), S([bx + 0.14, sy * 0.255, 0.45]), 0.07, 0.40, 0.02,
      C.metal, { seed: 86 + sy, mat: metalMat(86 + sy) });
    for (const dz of [-0.10, 0.10]) {
      rivet(m, S([bx, sy * 0.295, 0.47 + dz]), [0, sy, 0], 0.030, 0.024, C.metalLight, 87);
    }
  }
  // Perno hexagonal en la cara cercana (la que ve la cámara).
  tube(m, [S([bx + 0.01, 0.29, 0.47]), S([bx + 0.01, 0.38, 0.47])], 0.13, C.metalLight,
    { seg: 6, mat: metalMat(88), ao: 1.02 });
  tube(m, [S([bx + 0.01, 0.38, 0.47]), S([bx + 0.01, 0.405, 0.47])], 0.08, C.metalDark,
    { seg: 6, mat: metalMat(89), ao: 0.96 });

  // --- Arco (prod): pala ancha y plana con curva pronunciada hacia delante.
  const span = 1.42;
  const bowPts = [];
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * 2 - 1;
    const at = Math.abs(t);
    bowPts.push(S([bx + 0.40 * Math.pow(at, 1.7), t * span, 0.47 + 0.11 * Math.pow(at, 1.9)]));
  }
  sweepBox(m, bowPts, 0.34, 0.30, 0.07, C.wood, { seed: 90 });
  // Refuerzo central oscuro, oculto bajo la abrazadera.
  bevelBox(m, S([bx, -0.42, 0.47]), S([bx, 0.42, 0.47]), 0.40, 0.34, 0.07, C.woodDark, { seed: 91 });

  for (const sy of [-1, 1]) {
    const tangent = norm([0.68, sy * span, 0.21]);
    const tip = S([bx + 0.40, sy * span, 0.58]);
    // Taco de punta y amarre grueso, como en la referencia.
    bevelBox(m, sub(tip, mul(tangent, 0.14)), add(tip, mul(tangent, 0.14)), 0.24, 0.24, 0.05,
      C.woodLight, { seed: 92 + sy, up: [0, 0, 1] });
    ropeWrap(m, S([bx + 0.34, sy * span * 0.90, 0.56]), tangent, 0.19, 2.8, 0.22, 0.042, C.rope,
      { seed: 93 + sy });
    cone(m, tip, tangent, 0.12, 0.14, C.woodLight, { seg: 8, seed: 94 + sy });
  }
  // Amarres de las palas junto a la abrazadera.
  for (const sy of [-1, 1]) {
    const at = 0.38;
    ropeWrap(m, S([bx + 0.40 * Math.pow(at, 1.7), sy * at * span, 0.47 + 0.11 * Math.pow(at, 1.9)]),
      [0.6, sy * 0.8, 0.2], 0.21, 2.2, 0.18, 0.042, C.rope, { seed: 95 + sy });
  }

  // --- Cuerda: tensada en reposo, liberada al disparar, a medio tensar al recargar.
  const latchX = state === 1 ? 0.66 : state === 2 ? 0.02 : -0.70;
  const latchZ = state === 1 ? 0.60 : state === 2 ? 0.64 : 0.74;
  const tipL = S([bx + 0.40, span, 0.61]);
  const tipR = S([bx + 0.40, -span, 0.61]);
  const latch = S([latchX, 0, latchZ]);
  const stringPts = [];
  for (let i = 0; i <= 12; i++) stringPts.push(add(tipL, mul(sub(latch, tipL), i / 12)));
  for (let i = 1; i <= 12; i++) stringPts.push(add(latch, mul(sub(tipR, latch), i / 12)));
  tube(m, stringPts, 0.036, C.rope, { seg: 6, rope: true, ao: 0.98, seed: 96 });
  // Bloque del fiador bajo la cuerda.
  bevelBox(m, S([latchX - 0.05, 0, latchZ - 0.10]), S([latchX + 0.05, 0, latchZ - 0.03]),
    0.13, 0.10, 0.02, C.woodDark, { seed: 97 });

  // Gatillo lateral y pasador trasero.
  bevelBox(m, S([-0.30, 0.24, 0.10]), S([-0.18, 0.24, -0.06]), 0.06, 0.12, 0.015, C.metalDark,
    { seed: 98, mat: metalMat(98) });
  rivet(m, S([-0.30, 0.26, 0.24]), [0, 1, 0], 0.05, 0.04, C.metalLight, 99);

  // --- Saeta: asta clara, punta roja de rombo y plumas rojas en abanico.
  if (state === 0) {
    const az = 0.74;
    tube(m, [S([-0.74, 0, az]), S([1.30, 0, az])], 0.062, C.woodPale,
      { seg: 9, seed: 100 });
    tube(m, [S([1.14, 0, az]), S([1.32, 0, az])], 0.082, C.metalDark,
      { seg: 9, mat: metalMat(101) });
    diamondHead(m, 1.26 + recoil, 1.78 + recoil, 0.25, 0.17, az, C.red,
      { seed: 102 });
    for (const a of [Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6]) {
      fin(m, -0.74 + recoil, -0.26 + recoil, a, 0.23, 0.028, C.red,
        { seed: 103, zCenter: az });
    }
    tube(m, [S([-0.78, 0, az]), S([-0.70, 0, az])], 0.070, C.woodDark,
      { seg: 6, seed: 104 });
  }

  // --- Destello de boca: estrella cálida sobre el eje del disparo.
  if (state === 1) {
    const fx = 1.34, fz = 0.74;
    cone(m, S([fx, 0, fz]), [1, 0, 0], 0.24, 0.36, C.flash, { seg: 7, outline: false, seed: 110 });
    cone(m, S([fx + 0.05, 0, fz]), [1, 0, 0], 0.13, 0.52, C.flashHot, { seg: 6, outline: false, seed: 111 });
    for (const a of [Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
      cone(m, S([fx, 0, fz]), [Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0.15], 0.08, 0.24,
        C.flash, { seg: 5, outline: false, seed: 112 });
    }
  }

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

/* Rasteriza un triángulo opaco con detalle procedural por píxel. */
function drawTri(fb, A, B, Cc, col, mat, bias = 0) {
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
      const z = (w0 * A.z + w1 * B.z + w2 * Cc.z) * inv + bias;
      const i = y * fb.w + x;
      if (z >= fb.depth[i]) continue;
      fb.depth[i] = z;
      let r = col[0], g = col[1], b = col[2];
      if (mat) {
        const wx = (w0 * A.wx + w1 * B.wx + w2 * Cc.wx) * inv;
        const wy = (w0 * A.wy + w1 * B.wy + w2 * Cc.wy) * inv;
        const wz = (w0 * A.wz + w1 * B.wz + w2 * Cc.wz) * inv;
        const m = materialFactor(mat, [wx, wy, wz]);
        r *= m; g *= m; b *= m;
      }
      const o = i * 4;
      fb.color[o] = r < 0 ? 0 : r > 255 ? 255 : r | 0;
      fb.color[o + 1] = g < 0 ? 0 : g > 255 ? 255 : g | 0;
      fb.color[o + 2] = b < 0 ? 0 : b > 255 ? 255 : b | 0;
      fb.color[o + 3] = 255;
    }
  }
}

/* Elipse suave con caída cuadrática: base de la sombra de contacto. */
function softEllipse(fb, cx, cy, rx, ry, alpha, color = [34, 23, 38]) {
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

const BASE_FEET = LEG_AZ.map(a => [Math.cos(a) * FOOT_R, Math.sin(a) * FOOT_R, 0]);

function drawBaseShadow(fb, cx, cy) {
  // Sombra proyectada ancha hacia la izquierda + contacto bajo la huella.
  softEllipse(fb, cx - 22 * SS, cy + 8 * SS, 116 * SS, 48 * SS, 0.13, [38, 28, 48]);
  softEllipse(fb, cx - 4 * SS, cy + 5 * SS, 86 * SS, 35 * SS, 0.19, [30, 20, 36]);
  softEllipse(fb, cx + 2 * SS, cy + 3 * SS, 64 * SS, 25 * SS, 0.24, [22, 14, 28]);
  // Contacto duro bajo cada zapata.
  for (const foot of BASE_FEET) {
    const p = project(foot, [0, 0, 0], cx, cy);
    softEllipse(fb, p.x + 1 * SS, p.y + 2 * SS, 20 * SS, 9 * SS, 0.26, [18, 12, 24]);
  }
}

/* Contorno de 1 px (a resolución de salida) solo en la silueta.
 * Se calcula después del downsample: así queda nítido y no se difumina
 * con el promedio. No expande la geometría ni ensucia las caras interiores. */
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
  if (shadow) drawBaseShadow(fb, cx, cy);

  // El sombreado se hace aquí, con la geometría ya en coordenadas de mundo.
  // Así la luz no gira con la torreta y todas las piezas comparten clave.
  for (const t of mesh) {
    const n = norm(cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0])));
    if (!isFinite(n[0]) || len(n) < 1e-7) continue;
    const col = shade(t.color, n, t.ao, t.tint);
    const p0 = project(t.p[0], target, cx, cy);
    const p1 = project(t.p[1], target, cx, cy);
    const p2 = project(t.p[2], target, cx, cy);
    drawTri(fb, p0, p1, p2, col, t.mat);
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

// --------------------------------------------------------------------------
// PNG (RGBA8, filtro 0), composición de hojas y preview de verificación
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

function blankSheet(cols, rows) {
  const pitch = CELL + PAD * 2;
  const w = cols * pitch, h = rows * pitch;
  return { w, h, data: new Uint8Array(w * h * 4) };
}
function pasteCell(sheet, col, row, img) {
  const pitch = CELL + PAD * 2;
  const ox = col * pitch + PAD, oy = row * pitch + PAD;
  for (let y = 0; y < CELL; y++) {
    const src = y * CELL * 4;
    const dst = ((oy + y) * sheet.w + ox) * 4;
    sheet.data.set(img.data.subarray(src, src + CELL * 4), dst);
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
function crop(img, x, y, w, h) {
  const data = new Uint8Array(w * h * 4);
  for (let row = 0; row < h; row++) {
    data.set(img.data.subarray(((y + row) * img.w + x) * 4, ((y + row) * img.w + x + w) * 4), row * w * 4);
  }
  return { data, w, h };
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
function preview(img, label, step = 5) {
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

/* Encuentra la rotación de mundo cuyo eje +X se proyecta en el ángulo de
 * pantalla `theta`. Así el índice de frame coincide con el ángulo que usa
 * Ballista.yawToTarget() (múltiplos de 15° desde la derecha de la pantalla). */
function yawForScreenAngle(theta) {
  let best = 0, bestErr = Infinity;
  for (let i = 0; i < 3600; i++) {
    const phi = i * 0.1 * Math.PI / 180;
    const u = AZ - phi;
    const a = Math.atan2(-Math.sin(EL) * Math.cos(u), Math.sin(u));
    const err = Math.abs(Math.atan2(Math.sin(a - theta), Math.cos(a - theta)));
    if (err < bestErr) { bestErr = err; best = phi; }
  }
  return best;
}

/* Preview de verificación: base + cabeza idle a 30° con las mismas anclas
 * que usa Phaser. Se guarda en tools/ballista-art/preview.png. */
function compositePreview(base, head) {
  const W = 384, H = 384;
  const dst = { w: W, h: H, data: new Uint8Array(W * H * 4) };
  for (let i = 0; i < W * H; i++) {
    dst.data[i * 4] = 240; dst.data[i * 4 + 1] = 237; dst.data[i * 4 + 2] = 232;
    dst.data[i * 4 + 3] = 255;
  }
  blit(dst, base, 64, 96);
  blit(dst, head, 64, 41);
  return dst;
}

// --------------------------------------------------------------------------
// Horneado
// --------------------------------------------------------------------------
const started = Date.now();
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PREVIEW_DIR, { recursive: true });

const baseMesh = buildBase();
const base = render(baseMesh, [0, 0, 0], BASE_GROUND, { shadow: true });
fs.writeFileSync(path.join(OUT, 'ballista-base.png'), encodePNG(base));

const full = blankSheet(ANGLES, STATES);
const groups = Array.from({ length: ANGLES / GROUP }, () => blankSheet(GROUP, STATES));
const frames = [];
const globalBox = { x0: CELL, y0: CELL, x1: 0, y1: 0 };

for (let state = 0; state < STATES; state++) {
  for (let a = 0; a < ANGLES; a++) {
    const theta = (a * 15 * Math.PI) / 180;
    const phi = yawForScreenAngle(theta);
    const matCache = new Map();
    const mesh = buildHead(state).map(t => {
      let mat = t.mat;
      if (mat && mat.axis) {
        let rm = matCache.get(mat);
        if (!rm) {
          rm = { ...mat, axis: rotZ(mat.axis, phi), u: rotZ(mat.u, phi), v: rotZ(mat.v, phi) };
          matCache.set(mat, rm);
        }
        mat = rm;
      }
      return {
        ...t,
        p: t.p.map(p => add(rotZ(p, phi), [0, 0, HEAD_Z])),
        mat,
      };
    });
    const img = render(mesh, [0, 0, HEAD_Z], HEAD_PIVOT);
    pasteCell(full, a, state, img);
    pasteCell(groups[Math.floor(a / GROUP)], a % GROUP, state, img);
    const bbox = boundingBox(img);
    globalBox.x0 = Math.min(globalBox.x0, bbox[0]);
    globalBox.y0 = Math.min(globalBox.y0, bbox[1]);
    globalBox.x1 = Math.max(globalBox.x1, bbox[2]);
    globalBox.y1 = Math.max(globalBox.y1, bbox[3]);
    frames.push({ angle: a, state, yawDeg: +(phi * 180 / Math.PI).toFixed(2), bbox });
  }
}

fs.writeFileSync(path.join(OUT, 'ballista-head-sheet.png'), encodePNG(full));
groups.forEach((g, i) => {
  fs.writeFileSync(path.join(OUT, `ballista-head-g${i}.png`), encodePNG(g));
});

const headLift = Math.round(HEAD_Z * UP[2] * PPU / SS);
const meta = {
  generator: 'tools/ballista-art/generate.mjs',
  cell: CELL, pad: PAD, angles: ANGLES, states: STATES, groupCols: GROUP,
  groups: groups.length, elevationDeg: 30, azimuthDeg: 45,
  baseGround: BASE_GROUND, headPivot: HEAD_PIVOT, headLift,
  artScale: ART_SCALE,
  yawDegPerFrame: frames.filter(f => f.state === 0).map(f => f.yawDeg),
  bboxes: {
    base: boundingBox(base),
    idle0: frames.find(f => f.state === 0 && f.angle === 0).bbox,
    idle30: frames.find(f => f.state === 0 && f.angle === 2).bbox,
    allHeads: globalBox,
  },
};
fs.writeFileSync(path.join(OUT, 'ballista-art.json'), JSON.stringify(meta, null, 2) + '\n');

const pitch = CELL + PAD * 2;
// Frame 22 = 330°: la flecha apunta abajo-derecha, como en la referencia.
const idleRef = crop(full, 22 * pitch + PAD, PAD, CELL, CELL);
fs.writeFileSync(path.join(PREVIEW_DIR, 'preview.png'), encodePNG(compositePreview(base, idleRef)));

preview(base, 'BASE', 5);
preview(idleRef, 'HEAD idle 330°', 4);
console.log(`\nHorneado en ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log(`headLift=${headLift}px  artScale=${ART_SCALE}  atlas=${groups.length}`);
const fitMargin = Math.min(globalBox.x0, globalBox.y0, CELL - 1 - globalBox.x1, CELL - 1 - globalBox.y1);
console.log(`bbox cabezas: x ${globalBox.x0}..${globalBox.x1}  y ${globalBox.y0}..${globalBox.y1}  margen=${fitMargin}px`);
if (fitMargin < PAD) console.warn('AVISO: la cabeza toca el borde de la celda; reduce el modelo o el PPU.');

