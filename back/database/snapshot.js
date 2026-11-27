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
import { BALANCE_VERSION, BASE2_SLOT, DEFAULT_SLOT, LAYOUT_IDS, SNAPSHOT_VERSION } from './config.js';
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
    moving: Boolean(def.moving),
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
    storedRubies: num(def.storedRubies, 0),
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
      rubies: Math.max(0, int(resources?.rubies, 0)),
    },
    terrain: {
      size: rows.length || null,
      rows,
      digLimit: int(terrain?.digLimit, DIG_LIMITS[1] || 100),
      digCount: int(terrain?.digCount, 0),
      coreShelved: Boolean(terrain?.coreShelved),
    },
    // Las estructuras en modo Mover siguen siendo parte de la base: se guardan
    // para no perder su contenido/capacidad si hay un autosave mientras se mueven.
    // Los `vault` legacy se ignoran por completo (parche de emergencia).
    structures: structures
      .filter(def => def && def.id && def.kind !== 'vault' && (def.placed || def.shelved || def.moving || def.kind === 'core' || def.kind === 'entrance'))
      .map(structureRecord),
    army: {
      counts: { ...(army?.counts || {}) },
      levels: { ...(army?.levels || {}) },
      ragWork: army?.ragWork && typeof army.ragWork === 'object'
        ? {
          to: int(army.ragWork.to, 2),
          start: num(army.ragWork.start, Date.now()),
          end: num(army.ragWork.end, Date.now()),
        }
        : null,
      mutateWork: Array.isArray(army?.mutateWork)
        ? army.mutateWork.map(w => ({
          troopId: String(w?.troopId || ''),
          to: int(w?.to, 2),
          start: num(w?.start, Date.now()),
          end: num(w?.end, Date.now()),
        }))
        : [],
    },
    stats: { ...base.stats, ...(ctx.stats || {}) },
    settings: { ...(ctx.settings || {}) },
    orphans: Array.isArray(ctx.orphans) ? ctx.orphans : [],
    extra: { ...(ctx.extra || {}) },
  };
}

export function layoutRecord(snapshot) {
  const snap = normalizeSnapshot(snapshot);
  return {
    terrain: { ...snap.terrain, rows: [...(snap.terrain.rows || [])] },
    structures: (snap.structures || []).map(s => ({
      id: s.id, x: s.x, y: s.y, w: s.w, h: s.h, placed: s.placed, shelved: s.shelved,
    })),
  };
}

export function snapshotWithLayouts(snapshot, { activeLayout = DEFAULT_SLOT, layouts = {} } = {}) {
  const snap = normalizeSnapshot(snapshot);
  const nextLayouts = { ...(snap.extra?.layouts || {}) };
  for (const id of LAYOUT_IDS) {
    if (layouts[id]) nextLayouts[id] = layouts[id];
  }
  return {
    ...snap,
    extra: {
      ...snap.extra,
      activeLayout: LAYOUT_IDS.includes(activeLayout) ? activeLayout : DEFAULT_SLOT,
      layouts: nextLayouts,
    },
  };
}

export function applyLayoutToSnapshot(snapshot, layoutId = DEFAULT_SLOT) {
  const snap = normalizeSnapshot(snapshot);
  const layout = snap.extra?.layouts?.[layoutId];
  if (!layout) return { ...snap, slot: DEFAULT_SLOT, extra: { ...snap.extra, activeLayout: layoutId } };
  const byId = new Map((layout.structures || []).map(s => [String(s.id), s]));
  return {
    ...snap,
    slot: DEFAULT_SLOT,
    terrain: {
      ...snap.terrain,
      ...(layout.terrain || {}),
      rows: Array.isArray(layout.terrain?.rows) ? [...layout.terrain.rows] : [...(snap.terrain.rows || [])],
    },
    structures: (snap.structures || []).map(def => {
      const pos = byId.get(String(def.id));
      if (!pos) {
        // Edificios nuevos/no presentes en este layout: se guardan para colocar.
        if (def.kind === 'core' || def.kind === 'entrance') return def;
        return { ...def, placed: false, shelved: true };
      }
      return { ...def, x: int(pos.x, def.x), y: int(pos.y, def.y), w: int(pos.w, def.w), h: int(pos.h, def.h), placed: Boolean(pos.placed), shelved: Boolean(pos.shelved) };
    }),
    extra: { ...snap.extra, activeLayout: layoutId },
  };
}

export function ensureLayoutState(snapshot) {
  const snap = normalizeSnapshot(snapshot);
  const activeLayout = LAYOUT_IDS.includes(snap.extra?.activeLayout) ? snap.extra.activeLayout : DEFAULT_SLOT;
  const layouts = { ...(snap.extra?.layouts || {}) };
  if (!layouts[activeLayout]) layouts[activeLayout] = layoutRecord(snap);
  if (!layouts[BASE2_SLOT] && activeLayout !== BASE2_SLOT) {
    // Base 2 por defecto: mapa limpio con mismas estructuras guardadas.
    const fresh = freshSnapshot(DEFAULT_SLOT);
    const byId = new Map(fresh.structures.map(s => [s.id, s]));
    layouts[BASE2_SLOT] = layoutRecord({
      ...snap,
      terrain: fresh.terrain,
      structures: snap.structures.map(s => {
        const base = byId.get(s.id);
        return base ? { ...s, x: base.x, y: base.y, w: base.w, h: base.h, placed: base.placed, shelved: base.shelved } : { ...s, shelved: true, placed: false };
      }),
    });
  }
  return snapshotWithLayouts(snap, { activeLayout, layouts });
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
    stored: 0, storedCrystals: 0, storedRubies: 0,
  });

  const snap = {
    ...base,
    version: SNAPSHOT_VERSION,
    balanceVersion: BALANCE_VERSION,
    savedAt: null,
    slot: DEFAULT_SLOT,
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
  const layout = {
    terrain: { ...snap.terrain, rows: [...snap.terrain.rows] },
    structures: snap.structures.map(s => ({ id: s.id, x: s.x, y: s.y, w: s.w, h: s.h, placed: s.placed, shelved: s.shelved })),
  };
  return {
    ...snap,
    extra: {
      ...snap.extra,
      activeLayout: DEFAULT_SLOT,
      layouts: { [DEFAULT_SLOT]: layout, [BASE2_SLOT]: layout },
      fusionReductions: {},
    },
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
    moving: Boolean(rec.moving),
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
    storedRubies: Math.max(0, num(rec.storedRubies, 0)),
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
    rubies: Math.max(0, int(doc.resources?.rubies, BALANCE.recursos.inicio.rubies)),
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
      clean.storedRubies = Math.max(0, num(clean.storedRubies, 0));
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
  const ragWorkRaw = doc.army?.ragWork;
  const ragWork = ragWorkRaw && typeof ragWorkRaw === 'object'
    ? {
      to: clamp(int(ragWorkRaw.to, 2), 2, 5),
      start: num(ragWorkRaw.start, Date.now()),
      end: num(ragWorkRaw.end, Date.now()),
    }
    : null;
  const labLimit = Math.max(0, int(BALANCE.obras.limiteSlotsLaboratorio, 2));
  const mutateWork = [];
  for (const rawWork of Array.isArray(doc.army?.mutateWork) ? doc.army.mutateWork : []) {
    if (mutateWork.length >= labLimit) break;
    const troopId = String(rawWork?.troopId || '');
    const def = BALANCE.tropas.tipos[troopId];
    if (!def || def.source === 'summoned') continue;
    const to = clamp(int(rawWork?.to, 2), 2, Math.max(2, int(def.maxNivel, 1)));
    const start = num(rawWork?.start, NaN);
    const end = num(rawWork?.end, NaN);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    mutateWork.push({ troopId, to, start, end });
  }
  out.army = { counts, levels, ragWork, mutateWork };

  out.stats = { ...emptySnapshot().stats, ...(doc.stats || {}) };
  out.settings = { ...(doc.settings || {}) };
  out.extra = { ...(doc.extra || {}) };
  const fusionRaw = out.extra.fusionReductions && typeof out.extra.fusionReductions === 'object'
    ? out.extra.fusionReductions : {};
  const fusionReductions = {};
  for (const [kind, rawValue] of Object.entries(fusionRaw)) {
    const value = Math.max(0, int(rawValue, 0));
    if (value > 0) fusionReductions[kind] = value;
  }
  out.extra.fusionReductions = fusionReductions;
  const layouts = {};
  const rawLayouts = doc.extra?.layouts && typeof doc.extra.layouts === 'object' ? doc.extra.layouts : {};
  for (const id of LAYOUT_IDS) {
    const l = rawLayouts[id];
    if (l && typeof l === 'object') layouts[id] = l;
  }
  out.extra = { ...out.extra, layouts, activeLayout: LAYOUT_IDS.includes(out.extra.activeLayout) ? out.extra.activeLayout : (typeof doc.slot === 'string' && LAYOUT_IDS.includes(doc.slot) ? doc.slot : DEFAULT_SLOT) };
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
