/* ==========================================================
 * SERIALIZACIÓN DEL PROGRESO
 * ----------------------------------------------------------
 * Regla de oro: se guarda SOLO la fuente de verdad (recursos, nivel,
 * posición, trabajo en curso, tropas y terreno). Nunca se guarda vida,
 * daño, rango ni ningún número derivado: al cargar se recalculan desde
 * balance/. Así, cuando se añadan niveles de edificios o de tropas, una
 * partida antigua carga sin conversiones y usa los valores nuevos.
 * ========================================================== */

import { BALANCE } from '../balance/index.js';
import { DIG_LIMITS } from '../config/interaction.js';
import { specFor } from '../systems/structureSpecs.js';
import { BALANCE_VERSION, DEFAULT_SLOT, SNAPSHOT_VERSION } from './config.js';
import { emptySnapshot, migrate } from './migrations.js';

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const int = (v, fallback = 0) => Math.round(num(v, fallback));
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/* ---------- Lectura del estado vivo ------------------------------------- */

function structureRecord(def) {
  return {
    id: String(def.id),
    kind: def.kind,
    level: int(def.level, 1),
    x: int(def.x, 0),
    y: int(def.y, 0),
    w: int(def.w || def.size, 1),
    h: int(def.h || def.size, 1),
    placed: Boolean(def.placed),
    shelved: Boolean(def.shelved),
    movable: def.movable !== false,
    resource: def.resource || null,
    costKey: def.costKey || null,
    limitKind: def.limitKind || null,
    work: def.work
      ? {
        kind: def.work.kind === 'upgrade' ? 'upgrade' : 'build',
        to: int(def.work.to, 1),
        start: num(def.work.start, Date.now()),
        end: num(def.work.end, Date.now()),
      }
      : null,
    pending: num(def.pending, 0),
  };
}

/** Construye un snapshot limpio a partir de los sistemas de MainScene. */
export function buildSnapshot(ctx, slot = DEFAULT_SLOT) {
  const { terrain, structures = [], resources, army } = ctx;
  const rows = (terrain?.map || []).map(row => row.join(''));
  const base = emptySnapshot();

  return {
    ...base,
    version: SNAPSHOT_VERSION,
    balanceVersion: BALANCE_VERSION,
    savedAt: new Date().toISOString(),
    slot,
    resources: {
      coins: Math.max(0, int(resources?.coins, 0)),
      crystals: Math.max(0, int(resources?.crystals, 0)),
    },
    terrain: {
      size: rows.length || null,
      rows,
      digLimit: int(terrain?.digLimit, DIG_LIMITS[1] || 100),
      digCount: int(terrain?.digCount, 0),
      coreShelved: Boolean(terrain?.coreShelved),
    },
    // Las estructuras en modo Mover (placed=false y no guardadas) aún no
    // forman parte de la base: se descartan para no resurrectear fantasmas.
    structures: structures
      .filter(def => def && def.id && (def.placed || def.shelved || def.kind === 'core' || def.kind === 'entrance'))
      .map(structureRecord),
    army: {
      counts: { ...(army?.counts || {}) },
      levels: { ...(army?.levels || {}) },
    },
    stats: { ...base.stats, ...(ctx.stats || {}) },
    settings: { ...(ctx.settings || {}) },
    orphans: Array.isArray(ctx.orphans) ? ctx.orphans : [],
    extra: { ...(ctx.extra || {}) },
  };
}

/* ---------- Normalización al cargar ------------------------------------- */

function normalizeStructure(rec) {
  if (!rec || typeof rec !== 'object' || !rec.kind || !rec.id) return null;
  const kind = String(rec.kind);
  const spec = specFor(kind);
  if (!spec) return null; // se conserva en `orphans` desde normalizeSnapshot

  const maxLevel = int(spec.maxLevel || BALANCE.estructuras.maxNivel[kind], 1);
  const level = clamp(int(rec.level, 1), 1, Math.max(1, maxLevel));
  const work = rec.work && typeof rec.work === 'object'
    ? {
      kind: rec.work.kind === 'upgrade' ? 'upgrade' : 'build',
      to: clamp(int(rec.work.to, level + 1), 1, Math.max(1, maxLevel)),
      start: num(rec.work.start, Date.now()),
      end: num(rec.work.end, Date.now()),
    }
    : null;

  return {
    id: String(rec.id),
    kind,
    level,
    x: int(rec.x, 0),
    y: int(rec.y, 0),
    w: int(rec.w || spec.size, spec.size || 1),
    h: int(rec.h || spec.size, spec.size || 1),
    placed: Boolean(rec.placed),
    shelved: Boolean(rec.shelved),
    movable: rec.movable !== false,
    resource: rec.resource || null,
    costKey: rec.costKey || null,
    limitKind: rec.limitKind || null,
    work,
    pending: Math.max(0, num(rec.pending, 0)),
  };
}

/**
 * Aplica migraciones y sanea el documento. Los niveles se limitan al máximo
 * ACTUAL del balance: si mañana hay nivel 5, un guardado en nivel 3 sigue
 * siendo válido y podrá seguir mejorando sin tocar el guardado.
 */
export function normalizeSnapshot(raw) {
  const doc = migrate(raw);
  const out = { ...doc };

  out.resources = {
    coins: Math.max(0, int(doc.resources?.coins, BALANCE.recursos.inicio.coins)),
    crystals: Math.max(0, int(doc.resources?.crystals, BALANCE.recursos.inicio.crystals)),
  };

  const size = int(doc.terrain?.size, 0);
  const rows = Array.isArray(doc.terrain?.rows)
    ? doc.terrain.rows.filter(r => typeof r === 'string').map(r => r.replace(/[^012]/g, ''))
    : [];
  out.terrain = {
    size,
    rows: size > 0 ? rows.filter(r => r.length === size).slice(0, size) : [],
    digLimit: Math.max(0, int(doc.terrain?.digLimit, DIG_LIMITS[1] || 100)),
    digCount: Math.max(0, int(doc.terrain?.digCount, 0)),
    coreShelved: Boolean(doc.terrain?.coreShelved),
  };

  const seen = new Set();
  const structures = [];
  const orphans = Array.isArray(doc.orphans) ? [...doc.orphans] : [];
  for (const rec of Array.isArray(doc.structures) ? doc.structures : []) {
    const clean = normalizeStructure(rec);
    if (!clean) {
      orphans.push(rec);
      continue;
    }
    if (seen.has(clean.id)) continue; // ids duplicados: el primero gana
    seen.add(clean.id);
    structures.push(clean);
  }
  out.structures = structures;
  out.orphans = orphans;

  const counts = {};
  const levels = {};
  for (const [id, rawCount] of Object.entries(doc.army?.counts || {})) {
    const n = clamp(int(rawCount, 0), 0, 100000);
    if (n > 0) counts[id] = n;
    const def = BALANCE.tropas.tipos[id];
    const max = int(def?.maxNivel, 1);
    levels[id] = clamp(int(doc.army?.levels?.[id], 1), 1, Math.max(1, max));
  }
  // Tropas que solo existen como nivel (por ejemplo durante una mutación).
  for (const [id, rawLevel] of Object.entries(doc.army?.levels || {})) {
    if (levels[id] !== undefined) continue;
    const def = BALANCE.tropas.tipos[id];
    levels[id] = clamp(int(rawLevel, 1), 1, Math.max(1, int(def?.maxNivel, 1)));
  }
  out.army = { counts, levels };

  out.stats = { ...emptySnapshot().stats, ...(doc.stats || {}) };
  out.settings = { ...(doc.settings || {}) };
  out.extra = { ...(doc.extra || {}) };
  out.savedAt = typeof doc.savedAt === 'string' ? doc.savedAt : null;
  out.slot = typeof doc.slot === 'string' && doc.slot ? doc.slot : DEFAULT_SLOT;
  return out;
}

/** Compara dos snapshots por contenido (ignora la marca de tiempo). */
export function sameProgress(a, b) {
  if (!a || !b) return false;
  const key = s => {
    const { savedAt, ...rest } = s;
    return JSON.stringify(rest);
  };
  return key(a) === key(b);
}

/** Marca de tiempo numérica para resolver conflictos last-write-wins. */
export function savedAtMs(snapshot) {
  const t = Date.parse(snapshot?.savedAt || '');
  return Number.isFinite(t) ? t : 0;
}
