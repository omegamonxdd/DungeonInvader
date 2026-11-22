/* ==========================================================
 * APLICACIÓN DE UN GUARDADO AL JUEGO VIVO
 * ----------------------------------------------------------
 * No reconstruye la escena: reutiliza los sistemas que ya existen en
 * MainScene (fábrica, terreno, recursos, ejército, obras…). Todas las
 * estadísticas se recalculan desde balance/ con `derive()`, de modo que
 * los niveles nuevos se aprovechan automáticamente.
 * ========================================================== */

import { DIG_LIMITS } from '../config/interaction.js';
import { ENTRANCE_Y_MAX, ENTRANCE_Y_MIN } from '../config/world.js';
import { DIRT } from '../systems/map.js';
import { specFor } from '../systems/structureSpecs.js';
import { normalizeSnapshot } from './snapshot.js';

/** Recalcula todo lo que es función del nivel (nunca se guarda). */
function derive(def) {
  const spec = specFor(def);
  if (!spec) return;
  const lvl = def.level || 1;
  const atk = spec.attack ? spec.attack(lvl) : null;

  def.category = spec.category;
  def.height = spec.height;
  def.hp = spec.hp ? spec.hp(lvl) : def.hp;
  def.range = spec.range ? spec.range(lvl) : (atk?.range ?? def.range ?? null);
  def.minRange = atk?.minRange ?? null;
  def.damage = atk?.damage ?? null;
  def.splash = atk?.splash ?? null;
  def.storage = spec.storage ? spec.storage(lvl) : null;
  def.stored = spec.storage ? (def.stored || 0) : null;
  def.producer = spec.producer
    ? {
      resource: spec.producer.resource,
      rate: spec.producer.rate(lvl),
      cap: spec.producer.cap(lvl),
    }
    : null;
  def.guard = spec.guard || null;
  def.trap = spec.trap || null;
  def.act = spec.trap?.type === 'bomb' ? spec.trap.activation(lvl) : null;
  def.depth = def.x + def.y + (def.size || 1);
}

function syncView(def) {
  const v = def.view;
  if (!v) return;
  if (typeof v.placeAt === 'function') v.placeAt(def.x, def.y, 0);
  if (typeof v.clearFloating === 'function') v.clearFloating();
  if (typeof v.setVisible === 'function') v.setVisible(def.placed && !def.shelved);
  if (typeof v.setWorking === 'function') v.setWorking(Boolean(def.work));
  if (typeof v.setResource === 'function') v.setResource(def.resource);
  if (typeof v.setBubble === 'function') {
    v.setBubble(def.pending >= 1 ? `+${Math.floor(def.pending)}` : '');
  }
  if (typeof v.baseDepth === 'number' && typeof def.depth === 'number') {
    v.baseDepth = def.depth + 0.03;
    v.headDepth = def.depth + 0.04;
    v.base?.setDepth?.(v.baseDepth);
    v.head?.setDepth?.(v.headDepth);
  }
}

function restoreTerrain(snap, ctx) {
  const terrain = ctx.terrain;
  if (!terrain) return;
  const rows = snap.terrain.rows;
  if (rows.length === terrain.n && rows.every(r => r.length === terrain.n)) {
    for (let y = 0; y < terrain.n; y++) {
      for (let x = 0; x < terrain.n; x++) terrain.map[y][x] = Number(rows[y][x]);
    }
  }
  const maxDig = Math.max(...Object.values(DIG_LIMITS), DIG_LIMITS[1] || 100);
  terrain.digLimit = Math.min(maxDig, Math.max(
    DIG_LIMITS[1] || 100,
    snap.terrain.digLimit || DIG_LIMITS[1] || 100,
  ));
  // El contador se deriva del mapa: así nunca se desincroniza tras una
  // excavación, un relleno o un guardado del editor.
  terrain.digCount = 0;
  for (let y = 0; y < terrain.n; y++) {
    for (let x = 0; x < terrain.n; x++) if (terrain.map[y][x] !== DIRT) terrain.digCount++;
  }
  terrain.coreShelved = Boolean(snap.terrain.coreShelved);
}

function restoreStructures(snap, ctx) {
  const { structures = [], factory } = ctx;
  if (!factory) return;
  const records = new Map(snap.structures.map(r => [r.id, r]));

  for (const def of [...structures]) {
    if (records.has(def.id) || def.kind === 'core' || def.kind === 'entrance') continue;
    factory.destroy(def);
  }

  for (const rec of snap.structures) {
    let def = structures.find(d => d.id === rec.id);
    if (!def) {
      def = factory.create(rec.kind, rec.x, rec.y, {
        id: rec.id,
        level: rec.level,
        placed: rec.placed && !rec.shelved,
        resource: rec.resource,
        costKey: rec.costKey,
        limitKind: rec.limitKind,
      });
      if (!def) continue;
    }

    const spec = specFor(rec.kind);
    const size = spec?.size || rec.w || 1;
    def.level = rec.level;
    def.x = rec.x;
    def.y = rec.y;
    def.w = size;
    // La entrada ocupa 3 casillas en vertical (lo asigna MainScene al crearla).
    def.h = def.kind === 'entrance' ? (ENTRANCE_Y_MAX - ENTRANCE_Y_MIN + 1) : size;
    def.size = size;
    def.placed = Boolean(rec.placed) && !rec.shelved;
    def.shelved = Boolean(rec.shelved);
    def.movable = rec.movable !== false;
    def.resource = rec.resource || def.resource;
    def.costKey = rec.costKey || def.costKey;
    def.limitKind = rec.limitKind || def.limitKind;
    def.work = rec.work ? { ...rec.work } : null;
    def.pending = rec.pending || 0;
    derive(def);
    syncView(def);
  }

  // La entrada no se mueve nunca; el núcleo puede estar guardado en el editor.
  if (ctx.editor?._syncCorePlacement) ctx.editor._syncCorePlacement();

  const terrain = ctx.terrain;
  if (terrain?.occupied) {
    terrain.occupied.clear();
    for (const def of structures) {
      if (!def.placed || def.shelved) continue;
      const w = def.w || def.size || 1;
      const h = def.h || w;
      terrain.setFootprint(def.x, def.y, w, h, true);
    }
    terrain.pathValid = terrain.isCoreReachable();
  }
}

/** Aplica un snapshot normalizado y refresca la interfaz. Devuelve el documento usado. */
export function applySnapshot(snapshot, ctx) {
  const snap = normalizeSnapshot(snapshot);

  restoreTerrain(snap, ctx);
  restoreStructures(snap, ctx);

  if (ctx.resources) {
    ctx.resources.coins = snap.resources.coins;
    ctx.resources.crystals = snap.resources.crystals;
  }
  if (ctx.army) {
    ctx.army.counts = { ...snap.army.counts };
    ctx.army.levels = { ...snap.army.levels };
    ctx.army.onChange?.();
  }
  // La simulación copia el ejército al arrancar: hay que resincronizarla.
  ctx.invasion?.reset?.();

  if (ctx.scene?.terrainView) {
    const n = ctx.terrain?.n || 0;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) ctx.scene.terrainView.refresh?.(x, y);
    }
  }
  ctx.ui?.refreshBuildItems?.();
  ctx.ui?.refreshTerrainUI?.();
  ctx.ui?.syncResources?.();
  ctx.ui?.refreshSelection?.();
  ctx.ui?.syncScene?.();
  ctx.upgrades?.refresh?.(true);
  ctx.editor?.refresh?.();

  return snap;
}
