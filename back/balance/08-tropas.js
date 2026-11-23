/* ==========================================================
 * BALANCE 08 — TROPAS
 * ----------------------------------------------------------
 * space = espacio en la entrada · minNivel = nivel que la desbloquea
 * · speed = casillas/s · interval = s entre golpes · range = casillas
 * · dps = daño por segundo · damage (si se da) sustituye al derivado.
 * Todas las tropas y mutaciones son GRATIS en el prototipo.
 * Espejo de js/balance/08-tropas.js (legacy, no se toca).
 * ========================================================== */

export const tropas = {
  labRequerido: {
    esqueleto:  { 2: 1, 3: 2 },
    slime:      { 2: 1, 3: 2 },
    golem:      { 2: 1, 3: 2 },
    murcielago: { 2: 2 },
    armadura:   { 2: 2 },
    arana:      { 2: 2 },
  },
  tipos: {
    esqueleto: {
      space: 1, maxNivel: 3, minNivel: 1, source: 'rift',
      speed: 2.6, interval: 1, range: 1,
      niveles: {
        1: { hp: 35, dps: 10, damage: 10 },
        2: { hp: 43, dps: 14, damage: 14 },
        3: { hp: 55, dps: 17, damage: 17 },
      },
    },
    slime: {
      space: 1, maxNivel: 3, minNivel: 2, source: 'rift',
      speed: 2.4, interval: 1.2, range: 2.5,
      niveles: {
        1: { hp: 27, dps: 14 },
        2: { hp: 34, dps: 16 },
        3: { hp: 40, dps: 20 },
      },
    },
    golem: {
      space: 3, maxNivel: 3, minNivel: 3, source: 'rift',
      speed: 1.9, interval: 2, range: 1,
      niveles: {
        1: { hp: 180, dps: 15 },
        2: { hp: 210, dps: 17 },
        3: { hp: 275, dps: 19 },
      },
    },
    murcielago: {
      space: 1, maxNivel: 2, minNivel: 1, source: 'incubator',
      speed: 3.3, interval: 0.75, range: 1,
      flying: true, structMult: 2,
      niveles: {
        1: { hp: 27, dps: 7 },
        2: { hp: 32, dps: 9 },
      },
    },
    armadura: {
      space: 6, maxNivel: 2, minNivel: 4, source: 'rift',
      speed: 2, interval: 1.1, range: 0.9,
      niveles: {
        1: { hp: 750, dps: 16 },
        2: { hp: 875, dps: 20 },
      },
    },
    arana: {
      space: 10, maxNivel: 2, minNivel: 2, source: 'incubator',
      speed: 2.6, interval: 1.3, range: 0.9,
      danoPorCria: 50,
      niveles: {
        1: { hp: 800,  dps: 12, babies: 11 },
        2: { hp: 900, dps: 15, babies: 14 },
      },
    },
    'arana-bebe': {
      space: 0, maxNivel: 1, minNivel: 1, source: 'summoned',
      speed: 3.6, interval: 0.7, range: 0.8,
      niveles: { 1: { hp: 14, dps: 5, damage: 4 } },
    },
  },
};
