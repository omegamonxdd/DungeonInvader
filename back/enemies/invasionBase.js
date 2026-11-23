/* ==========================================================
 * BASE PRESTADA PARA INVASIONES
 * ----------------------------------------------------------
 * Al invadir se clona la base de otro jugador dentro de la escena (es la
 * copia que antes se hacía de la propia base). La base real del atacante se
 * guarda antes y se vuelve a aplicar al terminar, así que nada de lo que
 * ocurra en la simulación toca su progreso.
 *
 * Dos reglas del encargo:
 *  1. Una estructura en obras se "toma": se le quita el cronómetro y se
 *     marca como frozenUpgrade. Conserva su nivel actual y sus efectos de
 *     obra (no ataca/no produce), pero la mejora NUNCA llega a terminar.
 *  2. Si el rival se fue con el camino al núcleo bloqueado, se usa su
 *     checkpoint (último guardado con el camino libre). Sin checkpoint
 *     válido la invasión se cancela: mejor eso que un ataque imposible.
 * ========================================================== */

import { DEFAULT_SLOT } from '../database/config.js';
import { applySnapshot } from '../database/restore.js';
import {
  buildSnapshot, normalizeSnapshot, snapshotHasPath,
} from '../database/snapshot.js';

/** Quita el reloj a todas las obras de la copia y las deja congeladas. */
export function freezeOngoingWork(raw) {
  const snap = normalizeSnapshot(raw);
  snap.structures = snap.structures.map(rec => {
    if (!rec.work) return rec;
    const { kind, to } = rec.work;
    return { ...rec, work: null, frozenUpgrade: { kind, to } };
  });
  return snap;
}

/** Copia de seguridad de la base propia antes de prestar la escena. */
export function captureOwnBase(ctx) {
  return buildSnapshot(ctx, DEFAULT_SLOT);
}

/**
 * Resuelve qué base del rival se va a invadir.
 * Devuelve { ok, snapshot, usedCheckpoint } o { ok:false, reason }.
 */
export async function loadInvasionBase(service, opponentId) {
  const base = await service.loadOpponentBase(opponentId);
  if (base && snapshotHasPath(base)) {
    return { ok: true, snapshot: base, usedCheckpoint: false };
  }
  const checkpoint = await service.loadOpponentCheckpoint(opponentId);
  if (checkpoint && snapshotHasPath(checkpoint)) {
    return { ok: true, snapshot: checkpoint, usedCheckpoint: true };
  }
  return { ok: false, reason: base ? 'blocked' : 'missing' };
}

/** Mete la base rival en la escena sin tocar recursos ni ejército propios. */
export function applyInvasionBase(ctx, snapshot) {
  applySnapshot(freezeOngoingWork(snapshot), ctx, {
    withResources: false,
    withArmy: false,
  });
}

/** Devuelve la base propia y con ella sus obras y temporizadores reales. */
export function restoreOwnBase(ctx, ownSnapshot) {
  if (!ownSnapshot) return;
  applySnapshot(ownSnapshot, ctx);
}
