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
import {
  CORE_MIN, CORE_SIZE,
  ENTRANCE_X, ENTRANCE_X_MAX, ENTRANCE_Y_MAX, ENTRANCE_Y_MIN,
} from '../config/world.js';
import { CORE, DIRT, EMPTY, createMap } from '../systems/map.js';
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
    // Obra "tomada" al copiar una base para invadirla: se conserva el
    // tratamiento de estructura en obras, pero sin fechas que la terminen.
    frozenUpgrade: def.frozenUpgrade
      ? {
        kind: def.frozenUpgrade.kind === 'build' ? 'build' : 'upgrade',
        to: int(def.frozenUpgrade.to, 1),
      }
      : null,
    pending: num(def.pending, 0),
    stored: num(def.stored, 0),
    storedCrystals: num(def.storedCrystals, 0),
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
    // Los `vault` legacy se ignoran por completo (parche de emergencia).
    structures: structures
      .filter(def => def && def.id && def.kind !== 'vault' && (def.placed || def.shelved || def.kind === 'core' || def.kind === 'entrance'))
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

/**
 * Partida nueva: mapa inicial, solo núcleo y entrada, recursos de inicio y
 * ejército vacío. Se usa al cambiar de identidad cuando el usuario no tiene
 * guardado propio, para que no herede el estado de la cuenta anterior.
 */
export function freshSnapshot(slot = DEFAULT_SLOT) {
  const map = createMap();
  const rows = map.map(row => row.join(''));
  const base = emptySnapshot();
  const structure = (id, kind, x, y, w, h, movable) => ({
    id, kind, level: 1, x, y, w, h,
    placed: true, shelved: false, movable,
    work: null, frozenUpgrade: null, pending: 0,
    stored: 0, storedCrystals: 0,
  });

  return {
    ...base,
    version: SNAPSHOT_VERSION,
    balanceVersion: BALANCE_VERSION,
    savedAt: null,
    slot,
    resources: { ...BALANCE.recursos.inicio },
    terrain: {
      size: rows.length,
      rows,
      digLimit: DIG_LIMITS[1] || 100,
      digCount: map.reduce((n, row) => n + row.filter(c => c !== DIRT).length, 0),
      coreShelved: false,
    },
    structures: [
      structure('core', 'core', CORE_MIN, CORE_MIN, CORE_SIZE, CORE_SIZE, true),
      structure('entrance', 'entrance', ENTRANCE_X, ENTRANCE_Y_MIN,
        ENTRANCE_X_MAX - ENTRANCE_X + 1, ENTRANCE_Y_MAX - ENTRANCE_Y_MIN + 1, false),
    ],
    army: { counts: {}, levels: {} },
  };
}

/* ---------- Normalización al cargar ------------------------------------- */

function normalizeStructure(rec) {
  if (!rec || typeof rec !== 'object' || !rec.kind || !rec.id) return null;
  const kind = String(rec.kind);
  const id = String(rec.id);
  // Parche de emergencia: los almacenes legacy `vault` ya no existen.
  // Se descartan para que no cuenten, no se dibujen y no se vuelvan a guardar.
  if (kind === 'vault') return null;
  // Los saves que pasaron por la conversión vault->vault-coins/vault-crystals
  // conservaron ids legacy (`vault-N`). Se purgan para no duplicar almacenes.
  if ((kind === 'vault-coins' || kind === 'vault-crystals') && /^vault-\d+$/.test(id)) return null;
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
    resource: rec.resource || spec.resource || null,
    costKey: rec.costKey || spec.slot || null,
    limitKind: rec.limitKind || spec.limitKind || null,
    work,
    frozenUpgrade: rec.frozenUpgrade && typeof rec.frozenUpgrade === 'object'
      ? {
        kind: rec.frozenUpgrade.kind === 'build' ? 'build' : 'upgrade',
        to: clamp(int(rec.frozenUpgrade.to, level + 1), 1, Math.max(1, maxLevel)),
      }
      : null,
    pending: Math.max(0, num(rec.pending, 0)),
    stored: Math.max(0, num(rec.stored, 0)),
    storedCrystals: Math.max(0, num(rec.storedCrystals, 0)),
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
  const orphans = (Array.isArray(doc.orphans) ? doc.orphans : [])
    .filter(rec => rec?.kind !== 'vault'); // emergencia: purgar vaults legacy
  for (const rec of Array.isArray(doc.structures) ? doc.structures : []) {
    const clean = normalizeStructure(rec);
    if (!clean) {
      if (rec?.kind !== 'vault') orphans.push(rec);
      continue;
    }
    if (seen.has(clean.id)) continue; // ids duplicados: el primero gana
    seen.add(clean.id);
    if (clean.kind === 'core') {
      clean.stored = Math.max(0, num(clean.stored, 0));
      clean.storedCrystals = Math.max(0, num(clean.storedCrystals, 0));
    }
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

/**
 * ¿Llega el ejército desde la entrada hasta el núcleo en este guardado?
 * Es el equivalente en frío de `TerrainState.isCoreReachable()`: se decide
 * solo con el terreno del snapshot, sin construir la escena. Sirve para
 * descartar una base bloqueada antes de copiarla en una invasión.
 */
export function snapshotHasPath(raw) {
  const snap = normalizeSnapshot(raw);
  const rows = snap.terrain.rows;
  const n = rows.length;
  if (!n || n !== snap.terrain.size || rows.some(r => r.length !== n)) return false;

  const at = (x, y) => Number(rows[y][x]);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const queue = [];
  const seen = new Set();
  const key = (x, y) => y * n + x;

  for (let y = ENTRANCE_Y_MIN; y <= ENTRANCE_Y_MAX; y++) {
    if (y < 0 || y >= n || at(ENTRANCE_X, y) !== EMPTY) continue;
    queue.push({ x: ENTRANCE_X, y });
    seen.add(key(ENTRANCE_X, y));
  }
  for (let i = 0; i < queue.length; i++) {
    const { x, y } = queue[i];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const cell = at(nx, ny);
      if (cell === CORE) return true;
      if (cell !== EMPTY) continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push({ x: nx, y: ny });
    }
  }
  return false;
}
