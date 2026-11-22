import { HALF_H, HALF_W } from '../config/world.js';
import { heightAt } from './map.js';

/* Selección y resolución de casillas.
 * Portado de js/world/02-terreno.js (pickCell/cellSilhouette) y de
 * js/world/04-render.js (pointInPolygon/footprintPoly/structureAt).
 */

export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) &&
        p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

export function footprintPoly(x, y, w, h = w) {
  return [
    { x: (x - y) * HALF_W, y: (x + y) * HALF_H },
    { x: (x + w - y) * HALF_W, y: (x + w + y) * HALF_H },
    { x: (x + w - y - h) * HALF_W, y: (x + w + y + h) * HALF_H },
    { x: (x - y - h) * HALF_W, y: (x + y + h) * HALF_H },
  ];
}

function cellSilhouette(map, x, y) {
  const h = heightAt(map, x, y);
  const iso = (cx, cy, z = 0) => ({ x: (cx - cy) * HALF_W, y: (cx + cy) * HALF_H - z });
  if (!h) return [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)];
  return [
    iso(x, y, h), iso(x + 1, y, h), iso(x + 1, y, 0),
    iso(x + 1, y + 1, 0), iso(x, y + 1, 0), iso(x, y + 1, h),
  ];
}

// Casilla visible bajo un punto del mundo; gana la más cercana a la cámara.
export function pickCell(map, wx, wy) {
  const a = wx / HALF_W;
  const b = wy / HALF_H;
  const gx = Math.floor((a + b) / 2);
  const gy = Math.floor((b - a) / 2);
  const p = { x: wx, y: wy };
  for (let y = gy + 3; y >= gy - 1; y--) {
    for (let x = gx + 3; x >= gx - 1; x--) {
      if (x < 0 || y < 0 || x >= map.length || y >= map.length) continue;
      if (pointInPolygon(p, cellSilhouette(map, x, y))) return { x, y };
    }
  }
  return null;
}

// Selección por base: el rombo de la huella en el suelo, no el dibujo.
// Gana la estructura con mayor profundidad isométrica (más delantera).
export function structureAt(wx, wy, structures) {
  const hits = [];
  for (const def of structures) {
    if (!def.placed) continue;
    if (!pointInPolygon({ x: wx, y: wy }, footprintPoly(def.x, def.y, def.w, def.h))) continue;
    hits.push(def);
  }
  if (!hits.length) return null;
  return hits.reduce((a, b) => (b.depth > a.depth ? b : a));
}
