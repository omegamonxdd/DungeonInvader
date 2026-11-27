/* ==========================================================
 * BALANCE 08 — TROPAS
 * ----------------------------------------------------------
 * space = espacio en la entrada · minNivel = nivel que la desbloquea
 * · speed = casillas/s · interval = s entre golpes · range = casillas
 * · dps = daño por segundo · damage (si se da) sustituye al derivado.
 * Espejo de js/balance/08-tropas.js.
 * ========================================================== */

export const tropas = {
  labRequerido: {
    esqueleto:  { 2: 1, 3: 2, 4: 3 },
    slime:      { 2: 1, 3: 2, 4: 3 },
    golem:      { 2: 1, 3: 2, 4: 3 },
    murcielago: { 2: 2, 3: 3, 4: 3 },
    armadura:   { 2: 2, 3: 3 },
    arana:      { 2: 2, 3: 3, 4: 3 },
  },
  nivelBebePorNivel: { 1: 1, 2: 1, 3: 1, 4: 2 },
  tipos: {
    esqueleto: {
      space: 1, maxNivel: 4, minNivel: 1, source: 'rift',
      speed: 2.6, interval: 1, range: 1,
      niveles: {
        1: { hp: 35, dps: 10, damage: 10 },
        2: { hp: 43, dps: 14, damage: 14 },
        3: { hp: 57, dps: 17, damage: 17 },
        4: { hp: 70, dps: 20, damage: 20 },
      },
    },
    slime: {
      space: 1, maxNivel: 4, minNivel: 2, source: 'rift',
      speed: 2.4, interval: 1.2, range: 2.5,
      niveles: {
        1: { hp: 27, dps: 14 },
        2: { hp: 34, dps: 16 },
        3: { hp: 42, dps: 20 },
        4: { hp: 50, dps: 24, damage: 24 },
      },
    },
    golem: {
      space: 3, maxNivel: 4, minNivel: 3, source: 'rift',
      speed: 1.9, interval: 2, range: 1,
      niveles: {
        1: { hp: 180, dps: 15 },
        2: { hp: 210, dps: 17 },
        3: { hp: 280, dps: 19 },
        4: { hp: 350, dps: 21 },
      },
    },
    murcielago: {
      space: 1, maxNivel: 4, minNivel: 1, source: 'incubator',
      speed: 3.3, interval: 0.75, range: 1,
      flying: true, structMult: 2,
      niveles: {
        1: { hp: 29, dps: 9 },
        2: { hp: 35, dps: 11 },
        3: { hp: 42, dps: 13 },
        4: { hp: 49, dps: 15 }
      },
    },
    armadura: {
      space: 6, maxNivel: 3, minNivel: 4, source: 'rift',
      speed: 2, interval: 1.1, range: 0.9,
      niveles: {
        1: { hp: 750, dps: 16 },
        2: { hp: 850, dps: 20 },
        3: { hp: 925, dps: 24}
      },
    },
    arana: {
      space: 10, maxNivel: 4, minNivel: 2, source: 'incubator',
      speed: 2.6, interval: 1.2, range: 0.9,
      danoPorCria: 75,
      niveles: {
        1: { hp: 850,  dps: 12, babies: 12 },
        2: { hp: 900, dps: 15, babies: 15 },
        3: { hp: 950, dps: 18, babies: 18 },
        4: { hp: 1000, dps: 20, babies: 20 }
      },
    },
    'arana-bebe': {
      space: 0, maxNivel: 2, minNivel: 1, source: 'summoned',
      speed: 3.6, interval: 0.7, range: 0.8,
      // Sin `damage`: se deriva de dps × intervalo.
      niveles: {
        1: { hp: 20, dps: 7 },
        2: { hp: 25, dps: 8 },
      },
    },
    rag: {
      space: 0, maxNivel: 5, minNivel: 1, source: 'summoned', commandable: true,
      speed: 2.0, interval: 1.2, range: 1,
      niveles: {
        1: { hp: 500, dps: 15 },
        2: { hp: 580, dps: 17 },
        3: { hp: 640, dps: 19 },
        4: { hp: 720, dps: 21 },
        5: { hp: 800, dps: 23 },
      },
    },
  },
};
