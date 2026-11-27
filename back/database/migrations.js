/* ==========================================================
 * MIGRACIONES DEL GUARDADO
 * ----------------------------------------------------------
 * Un snapshot es un documento autodescriptivo: lleva `version`.
 * Al cargar, se aplican las migraciones pendientes en orden y se
 * rellenan los campos nuevos con valores por defecto. Eso permite:
 *
 *   · añadir niveles de edificios/tropas en balance/ sin tocar nada aquí
 *     (solo se guarda el id y el nivel, nunca las estadísticas derivadas);
 *   · abrir una partida antigua después de cambiar el formato;
 *   · conservar datos que esta versión no entiende (`orphans`, `extra`).
 *
 * Para cambiar el formato: sube SNAPSHOT_VERSION en config.js y añade
 * una función más en MIGRATIONS con la clave del nuevo número.
 * ========================================================== */

import { SNAPSHOT_VERSION } from './config.js';

/** Values por defecto de un documento vacío (nunca guardar derived stats). */
export function emptySnapshot() {
  return {
    version: SNAPSHOT_VERSION,
    balanceVersion: null,
    savedAt: null,
    slot: 'main',
    resources: { coins: 0, crystals: 0, rubies: 0 },
    terrain: {
      size: null,
      rows: [],
      digLimit: null,
      digCount: 0,
      coreShelved: false,
    },
    structures: [],
    army: { counts: {}, levels: {}, ragWork: null, mutateWork: [] },
    stats: { invasions: 0, wins: 0, losses: 0, bestWave: 0 },
    settings: {},
    // Datos de versiones futuras o tipos desconocidos: se conservan intactos.
    orphans: [],
    extra: {},
  };
}

/* Cada migración recibe el documento ya migrado a la versión anterior y
 * devuelve el documento en la versión nueva. Deben ser puras. */
const MIGRATIONS = {
  // v0 (guardados sin versión, o localStorage del prototipo) → v1.
  1: raw => {
    const out = { ...emptySnapshot(), ...raw };
    out.version = 1;
    out.resources = { ...emptySnapshot().resources, ...(raw.resources || {}) };
    out.terrain = { ...emptySnapshot().terrain, ...(raw.terrain || {}) };
    out.army = {
      counts: { ...(raw.army?.counts || raw.troops?.counts || {}) },
      levels: { ...(raw.army?.levels || raw.troops?.levels || {}) },
      ragWork: raw.army?.ragWork || null,
      mutateWork: Array.isArray(raw.army?.mutateWork) ? raw.army.mutateWork : [],
    };
    out.structures = Array.isArray(raw.structures || raw.defs) ? (raw.structures || raw.defs) : [];
    out.stats = { ...emptySnapshot().stats, ...(raw.stats || {}) };
    out.settings = { ...(raw.settings || {}) };
    out.orphans = Array.isArray(raw.orphans) ? raw.orphans : [];
    out.extra = { ...(raw.extra || {}) };
    return out;
  },
};

/** Aplica todas las migraciones necesarias. Nunca muta el documento de entrada. */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return emptySnapshot();
  let doc = { ...raw };
  let version = Number.isFinite(Number(doc.version)) ? Number(doc.version) : 0;

  if (version > SNAPSHOT_VERSION) {
    // Viene de una versión más nueva: lo conservamos tal cual en `extra` para
    // no destruir información; el juego usará solo los campos que entiende.
    return {
      ...emptySnapshot(),
      ...doc,
      version: SNAPSHOT_VERSION,
      extra: { ...(doc.extra || {}), __fromVersion: version },
    };
  }

  for (let target = version + 1; target <= SNAPSHOT_VERSION; target++) {
    const step = MIGRATIONS[target];
    if (typeof step !== 'function') continue;
    doc = step(doc);
    version = target;
  }
  return { ...emptySnapshot(), ...doc, version: SNAPSHOT_VERSION };
}

export function currentVersion() { return SNAPSHOT_VERSION; }
