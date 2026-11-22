/* Punto de entrada público de la capa de base de datos.
 * El resto del juego solo debe importar desde aquí. */

export { GameService, getService, setService } from './GameService.js';
export { AuthUI } from './AuthUI.js';
export { SaveRepository } from './repository.js';
export { AuthService } from './auth.js';
export { SUPABASE_ENABLED, SNAPSHOT_VERSION, BALANCE_VERSION } from './config.js';
export { buildSnapshot, normalizeSnapshot, sameProgress } from './snapshot.js';
export { applySnapshot } from './restore.js';
export { migrate, emptySnapshot } from './migrations.js';
