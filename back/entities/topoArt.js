/* ==========================================================
 * FASE 11 — ARTE Y PLANTILLA DE LOS TOPOS (no es balance)
 * ----------------------------------------------------------
 * Port de js/world/21b-topos.js. El diseño pixel art se hornea una
 * sola vez en dos texturas Phaser de 96×140 (rejilla 24×35 a 4×),
 * igual que se hornean el terreno y las tropas. Aquí no hay lógica
 * ni números de juego: la cantidad y el aspecto vienen de BALANCE.
 * ========================================================== */

import { BALANCE } from '../balance/index.js';

// Un constructor por obra simultánea y el resto decorativos (balance/04).
export const TOPO_ROSTER = Object.freeze([
  ...Array(BALANCE.obras.limiteConstructores).fill('builder'),
  ...Array(BALANCE.obras.toposDecorativos).fill('normal'),
]);

export const TOPO_W = 24;
export const TOPO_H = 35;
export const TOPO_Q = 4;                       // rejilla horneada
export const TOPO_PX = BALANCE.topos.escalaPixel; // tamaño final en px (~1.5)
export const TOPO_ANCHOR = Object.freeze({ c: 11.5, r: 33.5 }); // entre los pies

export const TOPO_FADE_MS = 350;
export const TOPO_PUFF_MS = 500;
export const TOPO_DEPTH = 900; // encima de estructuras, debajo de OVERLAY_DEPTH

export const topoTextureKey = type => (type === 'builder' ? 'topo-builder' : 'topo-normal');

const TOPO_PAL = {
  O: '#241008',                               // contorno
  B: '#9b4a20', b: '#6c3115', h: '#b8612c',   // cuerpo
  C: '#cdb48a', c: '#a38a62',                 // panza
  S: '#5b6a7c', s: '#414d5c', L: '#8497ad',   // casco
  M: '#7f8996', m: '#474f5c', W: '#d3dde8',   // placa y martillo
  E: '#f4f1ea', e: '#b9b6bf', P: '#14101a',   // ojos
  K: '#b0803f', k: '#74501f', G: '#f0cc4a',   // cinturón
  D: '#8a5a2b', d: '#5c3a1b',                 // mango del martillo
};

/* Rejilla calcada del legacy (makeTopoGrid). */
function makeTopoGrid(builder) {
  const g = Array.from({ length: TOPO_H }, () => new Array(TOPO_W).fill(null));
  const CX = 11.5;
  const HW = 9.2;
  const inEll = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const put = (c, r, k) => {
    if (c >= 0 && c < TOPO_W && r >= 0 && r < TOPO_H) g[r][c] = k;
  };
  const eyeAt = (cx, x, y) => inEll(x, y, cx, 14, 3, 1.9);

  const inBody = (x, y) => {
    const dx = Math.abs(x - CX);
    if (y < 9 || y > 31.5 || dx > HW) return false;
    if (y <= 25.5) return true;
    const cdx = Math.max(0, dx - (HW - 6));
    return cdx * cdx + (y - 25.5) ** 2 <= 36;
  };

  for (let r = 0; r < TOPO_H; r++) {
    for (let c = 0; c < TOPO_W; c++) {
      const x = c + 0.5;
      const y = r + 0.5;
      const dx = x - CX;
      // Placa metálica de la espalda.
      if (dx > 2.5 && y > 5 && y < 31 && inEll(x, y, CX + 1, 19.5, 10.4, 13.5)) {
        g[r][c] = c >= 22 ? 'm' : c === 21 ? (r % 7 < 3 ? 'W' : 'M') : 'M';
      }
      // Pies.
      if (inEll(x, y, CX - 4.5, 31.5, 3.2, 2.3) || inEll(x, y, CX + 4.5, 31.5, 3.2, 2.3)) {
        g[r][c] = y > 32.6 ? 'b' : 'B';
      }
      // Cabeza y cuerpo.
      if (inBody(x, y)) {
        g[r][c] = (r === 10 || dx > 6.2 || y > 30) ? 'b' : (dx < -6.2 && y < 26) ? 'h' : 'B';
      }
      // Panza.
      if (inEll(x, y, CX, 25.5, 5.8, 6.5)) g[r][c] = (dx > 2.8 || y > 30) ? 'c' : 'C';
      // Casco.
      if (y < 10 && inEll(x, y, CX, 9.5, HW, 8.5)) {
        g[r][c] = inEll(x, y, 7.5, 4.5, 3.4, 2.2) ? 'L' : (y >= 8.5 || (dx > 5.5 && y > 5)) ? 's' : 'S';
      }
    }
  }

  // Ojos, pupilas y párpados.
  for (let r = 0; r < TOPO_H; r++) {
    for (let c = 0; c < TOPO_W; c++) {
      const x = c + 0.5;
      const y = r + 0.5;
      if (eyeAt(7, x, y) || eyeAt(16, x, y)) g[r][c] = r === 12 ? 'e' : 'E';
    }
  }
  for (const [pc, pr] of [[6, 13], [7, 13], [6, 14], [7, 14]]) {
    put(pc, pr, 'P');
    put(22 - pc, pr, 'P');
  }
  for (const [lc, lr] of [[4, 11], [5, 11], [6, 11], [7, 11], [8, 11], [8, 12], [9, 13]]) {
    put(lc, lr, 'O');
    put(22 - lc, lr, 'O');
  }

  // Boca fruncida.
  for (const c of [10, 11, 12, 13]) put(c, 17, 'O');
  put(9, 18, 'O');
  put(14, 18, 'O');

  // Constructor: cinturón, hebilla y martillo colgando a la izquierda.
  if (builder) {
    for (let r = 26; r <= 27; r++) {
      for (let c = 0; c < TOPO_W; c++) {
        if (inBody(c + 0.5, r + 0.5)) g[r][c] = r === 27 ? 'k' : 'K';
      }
    }
    for (const c of [11, 12]) for (const r of [26, 27]) put(c, r, 'G');
    for (let r = 25; r <= 29; r++) {
      put(3, r, 'd');
      put(4, r, 'D');
    }
    for (let r = 22; r <= 24; r++) {
      for (let c = 1; c <= 5; c++) put(c, r, r === 22 ? 'W' : c === 5 ? 'm' : 'M');
    }
  }

  // Contorno oscuro alrededor de todo el diseño.
  const out = g.map(row => row.slice());
  for (let r = 0; r < TOPO_H; r++) {
    for (let c = 0; c < TOPO_W; c++) {
      if (g[r][c]) continue;
      if ((r > 0 && g[r - 1][c]) || (r < TOPO_H - 1 && g[r + 1][c])
        || (c > 0 && g[r][c - 1]) || (c < TOPO_W - 1 && g[r][c + 1])) out[r][c] = 'O';
    }
  }
  return out;
}

/* Hornea `topo-normal` y `topo-builder` una sola vez por juego. */
export function ensureTopoTextures(scene) {
  for (const type of ['normal', 'builder']) {
    const key = topoTextureKey(type);
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, TOPO_W * TOPO_Q, TOPO_H * TOPO_Q);
    if (!tex) continue;
    const g = tex.context;
    g.imageSmoothingEnabled = false;
    const grid = makeTopoGrid(type === 'builder');
    for (let r = 0; r < TOPO_H; r++) {
      for (let c = 0; c < TOPO_W; c++) {
        const color = grid[r][c];
        if (!color) continue;
        g.fillStyle = TOPO_PAL[color];
        g.fillRect(c * TOPO_Q, r * TOPO_Q, TOPO_Q, TOPO_Q);
      }
    }
    tex.refresh();
  }
}
