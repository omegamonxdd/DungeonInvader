/* ==========================================================
 * FASE 8 — NAVEGACIÓN DE LA INVASIÓN
 * ----------------------------------------------------------
 * Portaje de js/invasion/16-invasion-base.js: Dijkstra en 8
 * direcciones sin cortar esquinas, con buffers reutilizables,
 * y la medida de distancia al borde del rectángulo de un edificio.
 * La cuadrícula sigue siendo la del legacy (casillas de 1×1).
 * ========================================================== */

import { ENTRANCE_X, ENTRANCE_Y_MAX, ENTRANCE_Y_MIN } from '../config/world.js';
import { DIRT, EMPTY } from '../systems/map.js';

const NB8 = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function heapPush(heap, cost, index) {
  heap.push([cost, index]);
  let k = heap.length - 1;
  while (k > 0) {
    const p = (k - 1) >> 1;
    if (heap[p][0] <= heap[k][0]) break;
    [heap[p], heap[k]] = [heap[k], heap[p]];
    k = p;
  }
}

function heapPop(heap) {
  const top = heap[0];
  const last = heap.pop();
  if (heap.length) {
    heap[0] = last;
    let k = 0;
    for (;;) {
      const l = 2 * k + 1;
      const r = l + 1;
      let m = k;
      if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
      if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
      if (m === k) break;
      [heap[m], heap[k]] = [heap[k], heap[m]];
      k = m;
    }
  }
  return top;
}

// Distancia de un punto al rectángulo [x0,x1]×[y0,y1]: 0 si está dentro.
// El alcance de las tropas se mide al borde, no al centro del edificio.
export function distToRect(px, py, r) {
  const dx = Math.max(r.x0 - px, 0, px - r.x1);
  const dy = Math.max(r.y0 - py, 0, py - r.y1);
  return Math.hypot(dx, dy);
}

const isEntranceCell = (x, y) => (
  x === ENTRANCE_X && y >= ENTRANCE_Y_MIN && y <= ENTRANCE_Y_MAX
);

export class PathFinder {
  constructor(terrain) {
    this.terrain = terrain;
    const n = terrain.n;
    // Se rellenan en cada búsqueda: nunca se asignan arrays nuevos por frame.
    this.dist = new Float64Array(n * n);
    this.prev = new Int32Array(n * n);
  }

  // `open` son las casillas de estructuras destruidas durante la simulación.
  walkable(x, y, open) {
    const t = this.terrain;
    if (!t.inBounds(x, y)) return false;
    if (open?.has(t.key(x, y)) && t.map[y][x] !== DIRT) return true;
    // Estandartes y trampas se pueden atravesar durante la simulación.
    if (this.passable?.has(t.key(x, y))) return t.map[y][x] !== DIRT;
    return t.map[y][x] === EMPTY && (!t.hasStructure(x, y) || isEntranceCell(x, y));
  }

  // goal(x, y) decide qué casillas son meta. Devuelve los centros a recorrer
  // (sin la casilla de salida) o null. Mismo algoritmo que findPath() del legacy.
  find(sx, sy, goal, open) {
    const t = this.terrain;
    if (!this.walkable(sx, sy, open)) return null;
    const n = t.n;
    const dist = this.dist.fill(Infinity);
    const prev = this.prev.fill(-1);
    const start = sy * n + sx;
    dist[start] = 0;
    const heap = [];
    heapPush(heap, 0, start);

    while (heap.length) {
      const [c, i] = heapPop(heap);
      if (c > dist[i]) continue;
      const x = i % n;
      const y = (i / n) | 0;
      if (goal(x, y)) {
        const cells = [];
        for (let k = i; k !== start && k >= 0; k = prev[k]) {
          cells.push({ x: (k % n) + 0.5, y: ((k / n) | 0) + 0.5 });
        }
        return cells.reverse();
      }
      for (const [dx, dy] of NB8) {
        const nx = x + dx;
        const ny = y + dy;
        if (!this.walkable(nx, ny, open)) continue;
        // No se cortan esquinas entre dos bloques.
        if (dx && dy && (!this.walkable(x + dx, y, open) || !this.walkable(x, y + dy, open))) continue;
        const nc = c + (dx && dy ? 1.4142 : 1);
        const ni = ny * n + nx;
        if (nc < dist[ni]) {
          dist[ni] = nc;
          prev[ni] = i;
          heapPush(heap, nc, ni);
        }
      }
    }
    return null;
  }

  // Casilla libre más cercana en espiral (para órdenes sobre suelo ocupado).
  nearestFree(x, y, open) {
    x = Math.floor(x);
    y = Math.floor(y);
    for (let r = 0; r < 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.walkable(x + dx, y + dy, open)) return { x: x + dx, y: y + dy };
        }
      }
    }
    return null;
  }
}
