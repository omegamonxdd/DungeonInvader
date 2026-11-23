/* ==========================================================
 * CONFIGURACIÓN DE LA CAPA DE DATOS
 * ----------------------------------------------------------
 * Toda la configuración de Supabase vive aquí. Vite inyecta las
 * variables VITE_SUPABASE_* en import.meta.env; también se pueden
 * overridear en runtime desde window.__DUNGEON_SUPABASE__ (útil para
 * probar sin reconstruir el bundle).
 *
 * Si no hay credenciales, la capa funciona en MODO LOCAL: el progreso
 * se guarda en localStorage con el mismo formato de snapshot, así que
 * el juego nunca se rompe y el día que se configure Supabase el mismo
 * guardado se puede empujar a la nube sin convertir nada.
 * ========================================================== */

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

/* Valores por defecto de este prototipo. La URL y la publishable/anon key son
 * públicas por diseño: la seguridad la dan las políticas RLS de schema.sql.
 * Un .env con VITE_SUPABASE_* (o window.__DUNGEON_SUPABASE__) manda, para poder
 * apuntar a otro proyecto de Supabase sin reconstruir el bundle. */
const DEFAULTS = Object.freeze({
  VITE_SUPABASE_URL: 'https://tgpyeoogdhebgutjycdq.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_7BeH9LRYcfwL9c3cUoSvDA_-P3KnHHh',
});

function readEnv(name) {
  const fromWindow = typeof window !== 'undefined'
    ? window.__DUNGEON_SUPABASE__?.[name]
    : undefined;
  return String(fromWindow || env[name] || DEFAULTS[name] || '').trim();
}

export const SUPABASE_URL = readEnv('VITE_SUPABASE_URL');
export const SUPABASE_ANON_KEY = readEnv('VITE_SUPABASE_ANON_KEY');

/** true cuando hay credenciales suficientes para hablar con Supabase. */
export const SUPABASE_ENABLED = Boolean(
  /^https?:\/\//i.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20,
);

/** Nombre de la tabla de partidas. Un jugador puede tener varias "ranuras". */
export const SAVES_TABLE = 'saves';
export const DEFAULT_SLOT = 'main';

/** Claves localStorage. Prefijo único para no chocar con otros prototipos. */
export const STORAGE_KEYS = Object.freeze({
  guest: 'dungeon-build:guest',
  current: 'dungeon-build:save:current',
  byUser: userId => `dungeon-build:save:${userId}`,
  legacy: [
    'dungeon-build:save',
    'dungeon-build:save:v1',
  ],
});

/** Intervalo del autoguardado (ms) y del debounce tras un cambio. */
export const AUTOSAVE_MS = 15_000;
export const SAVE_DEBOUNCE_MS = 1_200;

/** Versión del formato de guardado. Subirla obliga a añadir una migración. */
export const SNAPSHOT_VERSION = 1;

export const BALANCE_VERSION = String(env.VITE_APP_VERSION || '0.1.0');
