/* ==========================================================
 * FASE 11 — CONTROLADOR DE TOPOS (ayudantes del núcleo)
 * ----------------------------------------------------------
 * Port de js/world/21b-topos.js a la app Phaser. El comportamiento
 * vive aquí; el dibujo vive en entities/TopoView.js. Números de
 * BALANCE.topos / BALANCE.obras, nunca duplicados en este archivo.
 *
 * · Paseo aleatorio por suelo excavado (radio de BALANCE.topos).
 * · Un topo 'builder' por obra de works.jobs(), martillea a distancia 1.
 * · Si la casilla bajo un topo deja de ser válida: puff y reaparece junto
 *   al núcleo. Si la obra está rodeada, el constructor se teletransporta.
 * · Pausa total en editor e invasión (según visiblesEnInvasion).
 * ========================================================== */

import { BALANCE } from '../balance/index.js';
import {
  CORE_MIN, CORE_SIZE, ENTRANCE_X, ENTRANCE_Y_MIN, ENTRANCE_Y_MAX,
} from '../config/world.js';
import { EMPTY } from './map.js';
import { TOPO_PUFF_MS, TOPO_ROSTER } from '../entities/topoArt.js';

const DT_MAX = 0.05; // mismo tope por frame que stepTopos() del legacy
const SPEED = BALANCE.topos.velocidad;
const WANDER = BALANCE.topos.radioPaseo;
const WORK_DIST = BALANCE.topos.distanciaObra;

const NB4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const NB8 = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

// Distancia de un punto al borde del rectángulo de una estructura.
function distToRect(px, py, r) {
  const dx = Math.max(r.x0 - px, 0, px - r.x1);
  const dy = Math.max(r.y0 - py, 0, py - r.y1);
  return Math.hypot(dx, dy);
}

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

/* BFS en 4 direcciones para alcanzaridad + Dijkstra en 8 direcciones sin
 * cortar esquinas. Buffers reutilizados: no se asignan arrays por frame. */
class TopoPath {
  constructor(terrain, cellOk) {
    this.n = terrain.n;
    this.cellOk = cellOk;
    this.dist = new Float64Array(this.n * this.n);
    this.prev = new Int32Array(this.n * this.n);
    this.reach = new Uint8Array(this.n * this.n);
  }

  find(sx, sy, goal) {
    const n = this.n;
    if (!this.cellOk(sx, sy)) return null;
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
        if (!this.cellOk(nx, ny)) continue;
        if (dx && dy && (!this.cellOk(x + dx, y) || !this.cellOk(x, y + dy))) continue;
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

  reachableFrom(sx, sy) {
    const n = this.n;
    const reach = this.reach.fill(0);
    if (!this.cellOk(sx, sy)) return reach;
    const queue = [sy * n + sx];
    reach[queue[0]] = 1;
    for (let i = 0; i < queue.length; i++) {
      const k = queue[i];
      const x = k % n;
      const y = (k / n) | 0;
      for (const [dx, dy] of NB4) {
        const nx = x + dx;
        const ny = y + dy;
        if (!this.cellOk(nx, ny)) continue;
        const ni = ny * n + nx;
        if (reach[ni]) continue;
        reach[ni] = 1;
        queue.push(ni);
      }
    }
    return reach;
  }
}

export class TopoController {
  constructor({ scene, terrain, structures, works, invasion, editor, onToast } = {}) {
    this.scene = scene;
    this.terrain = terrain;
    this.structures = structures;
    this.works = works;
    this.invasion = invasion;
    this.editor = editor;
    this.onToast = onToast || (() => {});

    this._topos = [];
    this._puffs = [];
    this._seq = 0;
    this._noSpaceWarned = false;
    this.path = new TopoPath(terrain, (x, y) => this.cellOk(x, y));

    const time = this.now();
    for (const type of TOPO_ROSTER) {
      const b = {
        id: ++this._seq, type, x: 0, y: 0,
        path: [], wait: 1, face: 1, anim: Math.random() * 6,
        born: time, alive: false, retry: 0,
        job: null, working: false, repath: 0, paused: false,
      };
      this._topos.push(b);
      this.placeTopo(b, time);
    }
    this.markPaused(this.isPaused());
  }

  now() {
    return this.scene?.time?.now ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());
  }

  get topos() {
    this.markPaused(this.isPaused());
    return this._topos;
  }

  get puffs() {
    this.markPaused(this.isPaused());
    return this._puffs;
  }

  // La vista consulta estos flag para ocultar topos y puffs en la pausa,
  // incluso si el llamador guardó las referencias a los arrays.
  isPaused() {
    return Boolean(this.editor?.active
      || (this.invasion?.active && !BALANCE.topos.visiblesEnInvasion));
  }

  markPaused(paused) {
    this._topos.paused = paused;
    this._puffs.paused = paused;
    for (const b of this._topos) b.paused = paused;
  }

  isEntrance(x, y) {
    return x === ENTRANCE_X && y >= ENTRANCE_Y_MIN && y <= ENTRANCE_Y_MAX;
  }

  // Equivale a walkable(x, y) && !isEntranceCell(x, y) del legacy.
  cellOk(x, y) {
    const t = this.terrain;
    return Boolean(t.inBounds(x, y) && t.map[y][x] === EMPTY
      && !t.hasStructure(x, y) && !this.isEntrance(x, y));
  }

  rectOf(def) {
    if (def?.kind === 'core') {
      return {
        x0: CORE_MIN, y0: CORE_MIN,
        x1: CORE_MIN + CORE_SIZE, y1: CORE_MIN + CORE_SIZE,
      };
    }
    if (def?.kind === 'entrance') {
      return {
        x0: ENTRANCE_X, y0: ENTRANCE_Y_MIN,
        x1: ENTRANCE_X + 1, y1: ENTRANCE_Y_MAX + 1,
      };
    }
    const x = def?.x || 0;
    const y = def?.y || 0;
    return {
      x0: x, y0: y,
      x1: x + (def?.w ?? def?.size ?? 1),
      y1: y + (def?.h ?? def?.size ?? 1),
    };
  }

  /* ---------- Aparición ------------------------------------------------- */

  spawnCell() {
    const core = {
      x0: CORE_MIN, y0: CORE_MIN,
      x1: CORE_MIN + CORE_SIZE, y1: CORE_MIN + CORE_SIZE,
    };
    const cands = [];
    const n = this.terrain.n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!this.cellOk(x, y)) continue;
        if (this._topos.some(o => o.alive
          && Math.hypot(o.x - (x + 0.5), o.y - (y + 0.5)) < 0.6)) continue;
        const d = distToRect(x + 0.5, y + 0.5, core);
        cands.push({ x, y, d });
      }
    }
    if (!cands.length) return null;
    cands.sort((a, b) => a.d - b.d);
    // Elige entre las más cercanas al núcleo; sin límite de radio porque
    // los topos pueden excavar para llegar a cualquier zona disponible.
    const near = cands.slice(0, 8);
    return near[Math.floor(Math.random() * near.length)];
  }

  placeTopo(b, time) {
    const c = this.spawnCell();
    if (!c) {
      b.alive = false;
      b.retry = 1;
      if (!this._noSpaceWarned) {
        this._noSpaceWarned = true;
        this.onToast('No hay sitio junto al núcleo para los topos');
      }
      return;
    }
    Object.assign(b, {
      x: c.x + 0.5, y: c.y + 0.5, path: [],
      wait: 0.8 + Math.random() * 1.5,
      alive: true, born: time, retry: 0,
    });
    this._puffs.push({ x: b.x, y: b.y, t0: time });
  }

  /* ---------- Paseo y obras --------------------------------------------- */

  wander(b) {
    const sx = Math.floor(b.x);
    const sy = Math.floor(b.y);
    const reach = this.path.reachableFrom(sx, sy);
    const opts = [];
    const n = this.terrain.n;
    const y0 = Math.max(0, sy - WANDER);
    const y1 = Math.min(n - 1, sy + WANDER);
    const x0 = Math.max(0, sx - WANDER);
    const x1 = Math.min(n - 1, sx + WANDER);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x === sx && y === sy) continue;
        if (!reach[y * n + x] || !this.cellOk(x, y)) continue;
        opts.push({ x, y });
      }
    }
    b.wait = 1 + Math.random() * 2;
    if (!opts.length) return;
    const goal = opts[Math.floor(Math.random() * opts.length)];
    const cells = this.path.find(sx, sy, (x, y) => x === goal.x && y === goal.y);
    if (!cells?.length) return;
    cells[cells.length - 1] = {
      x: goal.x + 0.25 + Math.random() * 0.5,
      y: goal.y + 0.25 + Math.random() * 0.5,
    };
    b.path = cells;
  }

  assignBuilders(jobs) {
    const ids = jobs.map(j => j.id);
    for (const b of this._topos) {
      if (!b.job || ids.includes(b.job)) continue;
      b.job = null;
      b.working = false;
      b.path = [];
      b.wait = 0.5 + Math.random();
    }
    for (const job of jobs) {
      if (this._topos.some(b => b.job === job.id)) continue;
      const r = this.rectOf(job.def);
      let best = null;
      let bd = Infinity;
      for (const b of this._topos) {
        if (b.type !== 'builder' || !b.alive || b.job) continue;
        const d = distToRect(b.x, b.y, r);
        if (d < bd) {
          bd = d;
          best = b;
        }
      }
      if (best) {
        best.job = job.id;
        best.path = [];
        best.repath = 0;
        best.working = false;
      }
    }
  }

  // Sin camino hasta una obra rodeada: aparece en la celda válida más cercana.
  teleportToJob(b, r, time) {
    let best = null;
    let bd = Infinity;
    const n = this.terrain.n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!this.cellOk(x, y)) continue;
        const d = distToRect(x + 0.5, y + 0.5, r);
        if (d < bd) {
          bd = d;
          best = { x, y };
        }
      }
    }
    if (!best) return;
    this._puffs.push({ x: b.x, y: b.y, t0: time });
    b.x = best.x + 0.5;
    b.y = best.y + 0.5;
    b.path = [];
    this._puffs.push({ x: b.x, y: b.y, t0: time });
  }

  prunePuffs(time) {
    while (this._puffs.length && time - this._puffs[0].t0 > TOPO_PUFF_MS) {
      this._puffs.shift();
    }
  }

  step(dt, time = this.now()) {
    const paused = this.isPaused();
    this.markPaused(paused);
    if (paused) return;

    const delta = Math.min(DT_MAX, Math.max(0, Number(dt) || 0));
    if (!delta) return;
    this.prunePuffs(time);

    const jobs = this.works?.jobs?.() || [];
    this.assignBuilders(jobs);
    const byId = new Map(jobs.map(j => [j.id, j]));

    for (const b of this._topos) {
      if (!b.alive) {                       // sin sitio: reintenta cada segundo
        b.retry -= delta;
        if (b.retry <= 0) this.placeTopo(b, time);
        continue;
      }
      if (!this.cellOk(Math.floor(b.x), Math.floor(b.y))) {
        this._puffs.push({ x: b.x, y: b.y, t0: time });
        this.placeTopo(b, time);
        continue;
      }

      const job = b.job ? byId.get(b.job) : null;
      if (b.job && !job) {
        b.job = null;
        b.working = false;
        b.path = [];
        b.wait = 0.5 + Math.random();
      }

      if (job) {
        const r = this.rectOf(job.def);
        if (distToRect(b.x, b.y, r) <= WORK_DIST) {
          b.working = true;
          b.path = [];
          const dx = (r.x0 + r.x1) / 2 - b.x;
          const dy = (r.y0 + r.y1) / 2 - b.y;
          if (dx - dy) b.face = dx - dy > 0 ? 1 : -1;
          continue;
        }
        b.working = false;
        b.repath -= delta;
        if (!b.path.length && b.repath <= 0) {
          b.repath = 1;
          const cells = this.path.find(
            Math.floor(b.x), Math.floor(b.y),
            (x, y) => this.cellOk(x, y)
              && distToRect(x + 0.5, y + 0.5, r) <= WORK_DIST - 0.2,
          );
          if (cells?.length) b.path = cells;
          else if (!cells) this.teleportToJob(b, r, time);
        }
      } else {
        b.working = false;
      }

      if (b.path.length) {
        const w = b.path[0];
        if (!this.cellOk(Math.floor(w.x), Math.floor(w.y))) {
          b.path = [];
          b.wait = 0.3;
          continue;
        }
        const dx = w.x - b.x;
        const dy = w.y - b.y;
        const d = Math.hypot(dx, dy);
        const adv = SPEED * delta;
        if (dx - dy) b.face = dx - dy > 0 ? 1 : -1;
        if (d <= adv) {
          b.x = w.x;
          b.y = w.y;
          b.path.shift();
        } else {
          b.x += dx / d * adv;
          b.y += dy / d * adv;
        }
        b.anim += delta * SPEED * 2.4;
        if (!b.path.length) b.wait = 1.5 + Math.random() * 3.5;
      } else if (!b.job) {
        b.wait -= delta;
        if (b.wait <= 0) this.wander(b);
      }
    }
  }
}
