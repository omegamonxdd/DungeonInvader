/* ==========================================================
 * GUARDADO LOCAL (fallback sin Supabase y caché offline)
 * ----------------------------------------------------------
 * Siempre se escribe en localStorage, incluso con Supabase activo:
 * es la caché que permite jugar sin red y la copia de seguridad si
 * la nube falla. El formato es exactamente el mismo snapshot.
 * ========================================================== */

import { DEFAULT_SLOT, STORAGE_KEYS } from './config.js';
import { normalizeSnapshot, savedAtMs } from './snapshot.js';

function safeGet(key) {
  try { return globalThis.localStorage?.getItem(key) || null; }
  catch { return null; }
}
function safeSet(key, value) {
  try { globalThis.localStorage?.setItem(key, value); return true; }
  catch { return false; }
}
function safeRemove(key) {
  try { globalThis.localStorage?.removeItem(key); }
  catch { /* almacenamiento bloqueado: se ignora */ }
}

/** Identificador estable de este navegador para el modo invitado. */
export function getGuestId() {
  let id = safeGet(STORAGE_KEYS.guest);
  if (!id) {
    const uuid = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    id = `guest:${uuid}`;
    safeSet(STORAGE_KEYS.guest, id);
  }
  return id;
}

function parse(raw) {
  if (!raw) return null;
  try { return normalizeSnapshot(JSON.parse(raw)); }
  catch { return null; }
}

/** Carga el guardado local SOLO del usuario dado.
 *  La clave genérica `current` se usa únicamente cuando no hay identidad:
 *  si se mezclara, una cuenta nueva vería el progreso de la anterior. */
export function loadLocal(userId = null, slot = DEFAULT_SLOT) {
  const candidates = userId
    ? [
      STORAGE_KEYS.byUser(userId, slot),
      // Compatibilidad con guardados pre-slots: `dungeon-build:save:${userId}`
      ...(slot === DEFAULT_SLOT ? [`dungeon-build:save:${userId}`] : []),
    ]
    : [STORAGE_KEYS.current, ...STORAGE_KEYS.legacy];
  let best = null;
  for (const key of candidates) {
    const snap = parse(safeGet(key));
    if (!snap) continue;
    const snapSlot = snap.slot || DEFAULT_SLOT;
    if (snapSlot === slot && (!best || savedAtMs(snap) > savedAtMs(best))) best = snap;
  }
  return best;
}

/** Escribe el snapshot en local. Devuelve true si al menos una clave se guardó. */
export function saveLocal(snapshot, userId = null, slot = snapshot?.slot || DEFAULT_SLOT) {
  const json = JSON.stringify(snapshot);
  let ok = safeSet(STORAGE_KEYS.current, json);
  if (userId) ok = safeSet(STORAGE_KEYS.byUser(userId, slot), json) || ok;
  return ok;
}

export function loadActiveSlot(userId = null) {
  if (!userId) return DEFAULT_SLOT;
  return safeGet(STORAGE_KEYS.activeSlot(userId)) || DEFAULT_SLOT;
}

export function saveActiveSlot(userId = null, slot = DEFAULT_SLOT) {
  if (!userId) return false;
  return safeSet(STORAGE_KEYS.activeSlot(userId), slot);
}

/** Último guardado con camino al núcleo libre (para invades imposibles). */
export function loadCheckpoint(userId = null) {
  const candidates = userId
    ? [STORAGE_KEYS.checkpointByUser(userId)]
    : [STORAGE_KEYS.checkpoint];
  let best = null;
  for (const key of candidates) {
    const snap = parse(safeGet(key));
    if (snap && (!best || savedAtMs(snap) > savedAtMs(best))) best = snap;
  }
  return best;
}

export function saveCheckpoint(snapshot, userId = null) {
  const json = JSON.stringify(snapshot);
  let ok = safeSet(STORAGE_KEYS.checkpoint, json);
  if (userId) ok = safeSet(STORAGE_KEYS.checkpointByUser(userId), json) || ok;
  return ok;
}

export function clearLocal(userId = null, slot = DEFAULT_SLOT) {
  safeRemove(STORAGE_KEYS.current);
  safeRemove(STORAGE_KEYS.checkpoint);
  if (userId) {
    safeRemove(STORAGE_KEYS.byUser(userId, slot));
    safeRemove(STORAGE_KEYS.activeSlot(userId));
    safeRemove(STORAGE_KEYS.checkpointByUser(userId));
  }
}

/** Tamaño aproximado del guardado (para el panel de depuración). */
export function localSize() {
  return (safeGet(STORAGE_KEYS.current) || '').length;
}
