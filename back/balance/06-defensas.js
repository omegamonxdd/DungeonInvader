/* ==========================================================
 * BALANCE 06 — DEFENSAS CON ATAQUE
 * ----------------------------------------------------------
 * cooldown = s entre disparos · dps = daño por segundo
 * (daño por impacto = dps × cooldown) · range = casillas.
 * La catapulta tiene range.min (zona muerta) y splash (radio).
 * Espejo de js/balance/06-defensas.js (legacy, no se toca).
 * ========================================================== */

export const defensas = {
  saetaVelocidad: 12,
  muerteMs: 550,

  ballista: {
    size: 2, height: 28, boltHeight: 26, maxNivel: 5,
    cooldown: 1.5,
    ranges: { 1: 4, 2: 4, 3: 4.2, 4: 4.2, 5: 4.3 },
    hp:  { 1: 500, 2: 550, 3: 580, 4: 610, 5: 675 },
    dps: { 1: 6,   2: 8,   3: 9,   4: 10,  5: 12 },
  },
  turret: {
    size: 2, height: 34, boltHeight: 28, maxNivel: 4,
    cooldown: 0.25,
    dartSpeed: 19,
    ranges: { 1: 6.7, 2: 6.75, 3: 6.8, 4: 6.85 },
    hp:  { 1: 420, 2: 470, 3: 520, 4: 580 },
    dps: { 1: 8,   2: 10,  3: 12,  4: 14 },
  },
  catapult: {
    size: 2, height: 34, boltHeight: 30, maxNivel: 2,
    cooldown: 4,
    range: { min: 4, max: 10 },
    splash: 0.6,
    stoneSpeed: 9,
    // Tiro de mortero: no busca a la tropa, cae en un punto de suelo con
    // dispersión. `missChance` fuerza un fallo claro (el punto se aparta
    // varias casillas) para que se vea que la catapulta también puede fallar.
    accuracy: 0.55,     // radio máximo de dispersión (casillas)
    missChance: 0.18,   // probabilidad de un lanzamiento desviado
    hp:  { 1: 750, 2: 800 },
    dps: { 1: 6,   2: 7 },
  },

  // PROVISIONAL: alcance, radio de cadena, altura de rayo, rayMs y costes/obras
  // pendientes de ajuste final por el usuario.
  'altar-electrico': {
    size: 2, height: 34, boltHeight: 26, maxNivel: 2,
    mode: 'chain',
    cooldown: 1.2,
    ranges: { 1: 5, 2: 5 },
    chain: 2,
    chainFactor: 0.25,
    targets: { 1: 2, 2: 3 }, // objetivo inicial + rebotes
    rayMs: 300,
    hp:  { 1: 600, 2: 660 },
    dps: { 1: 12,  2: 12 },
  },
  'altar-igneo': {
    size: 2, height: 34, boltHeight: 26, maxNivel: 2,
    mode: 'beam',
    cooldown: 0.1,
    ranges: { 1: 4, 2: 4 },
    targets: { 1: 1, 2: 2 },
    rayMs: 120,
    hp:  { 1: 600, 2: 660 },
    dps: { 1: 10,  2: 10 },
  },
};
