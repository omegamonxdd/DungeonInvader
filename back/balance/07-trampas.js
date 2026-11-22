/* ==========================================================
 * BALANCE 07 — TRAMPAS
 * ----------------------------------------------------------
 * bomba:  act = radio de activación · range = radio de daño ·
 *         una vez por invasión.
 * electro: cooldown 0 = una descarga por invasión; > 0 = repetible.
 * rocas:  damage = golpe de entrada · interval = golpes encima ·
 *         reentry = tiempo fuera para reiniciar.
 * Espejo de js/balance/07-trampas.js (legacy, no se toca).
 * ========================================================== */

export const trampas = {
  bomba: {
    size: 1, height: 14, maxNivel: 4, explosionMs: 750,
    niveles: {
      1: { act: 1, range: 1,    damage: 8 },
      2: { act: 1, range: 1.2,  damage: 10 },
      3: { act: 1, range: 1.3,  damage: 12 },
      4: { act: 1, range: 1.35, damage: 13 },
    },
  },
  electro: {
    size: 1, height: 34, maxNivel: 2,
    cooldown: 0, chainMs: 90, arcMs: 420,
    niveles: {
      1: { range: 2, damage: 10, targets: 2, chain: 1.5 },
      2: { range: 2, damage: 12, targets: 2, chain: 1.5 },
    },
  },
  rocas: {
    size: 2, height: 16, maxNivel: 3,
    damage: 3, interval: 1.5, reentry: 2,
    danioPorNivel: { 1: 3, 2: 4, 3: 5 },
  },
};
