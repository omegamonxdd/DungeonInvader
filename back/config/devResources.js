/* ==========================================================
 * RECURSOS DE PRUEBA (SOLO DESARROLLO LOCAL)
 * ----------------------------------------------------------
 * El repo arranca siempre con BALANCE.recursos.inicio (2000 de cada).
 * Si en local se define VITE_DEV_RESOURCES (o en runtime
 * window.__DUNGEON_DEV_RESOURCES__), TODA partida —nueva o cargada—
 * mantiene esa cantidad, para probar sin preocuparse por costes.
 * Este archivo nunca debe activarse en un build de producción.
 * ========================================================== */

// Solo en dev: así un build de Pages nunca hereda un .env.local del proyecto.
const isDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
const fromEnv = isDev ? import.meta.env.VITE_DEV_RESOURCES : undefined;

export function devResources() {
  const fromWindow = isDev && typeof window !== 'undefined'
    ? window.__DUNGEON_DEV_RESOURCES__
    : undefined;
  const raw = fromWindow !== undefined ? fromWindow : fromEnv;
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}
