/* ==========================================================
 * BALANCE 02 — LÍMITES Y NIVELES DE EDIFICIOS
 * ----------------------------------------------------------
 * limitePorNucleo[kind] = { nivel de núcleo: cantidad máxima }.
 *   0 = aún no se puede construir.
 * topeNivelPorNucleo[nivel de núcleo][kind] = tope de mejora.
 *   Si el tipo no aparece, solo manda su propio maxNivel.
 * Espejo de js/balance/02-estructuras.js (legacy, no se toca).
 * ========================================================== */

export const estructuras = {
  limitePorNucleo: {
    ballista:    { 1: 2, 3: 4 },
    catapult:    { 1: 0, 3: 1 },
    turret:      { 1: 0, 2: 1, 3: 2 },
    rift:        { 1: 1 },
    'vault-coins':    { 1: 1 },
    'vault-crystals': { 1: 1 },
    banner:      { 1: 1, 2: 2 },
    bannerslime: { 1: 0, 2: 1, 3: 2 },
    bomb:        { 1: 2, 2: 3, 3: 4 },
    electro:     { 1: 0, 4: 1 },
    incubator:   { 1: 0, 3: 1 },
    rocktrap:    { 1: 0, 2: 1 },
    lab:         { 1: 0, 2: 1 },
    mine:        { 1: 1, 2: 2 },
    workshop:    { 1: 1, 2: 2 },
  },

  topeNivelPorNucleo: {
    1: { ballista: 2, turret: 1, entrance: 1, rift: 1, 'vault-coins': 2, 'vault-crystals': 2, banner: 3, bomb: 3, mine: 2, workshop: 2 },
    2: { entrance: 2, ballista: 3, turret: 2, rift: 3, banner: 4, bomb: 4, rocktrap: 2, bannerslime: 2, lab: 1, mine: 3, workshop: 3 },
    3: { entrance: 3, ballista: 4, catapult: 2, turret: 4, rift: 4, 'vault-coins': 3, 'vault-crystals': 3, banner: 5, bannerslime: 3, bomb: 4, electro: 3, incubator: 3, rocktrap: 3, lab: 2, mine: 4, workshop: 4 },
    4: { entrance: 3, ballista: 4, catapult: 2, turret: 4, rift: 4, 'vault-coins': 3, 'vault-crystals': 3, banner: 5, bannerslime: 3, bomb: 4, electro: 3, incubator: 3, rocktrap: 3, lab: 3, mine: 4, workshop: 4 },
  },

  maxNivel: {
    ballista: 4, turret: 4, catapult: 2,
    rift: 4, lab: 2, incubator: 2,
    'vault-coins': 3, 'vault-crystals': 3, mine: 4, workshop: 4,
    banner: 5, bannerslime: 3,
    bomb: 4, electro: 3, rocktrap: 3,
  },
};
