/* ==========================================================
 * BALANCE 04 — OBRAS (CONSTRUCTORES Y TIEMPOS)
 * ----------------------------------------------------------
 * Tiempos en SEGUNDOS REALES. escalaTiempo multiplica todos:
 * 0.05 = pruebas al 5 % (volver a 1 al terminar).
 * Espejo de js/balance/04-obras.js (legacy, no se toca).
 * ========================================================== */

export const obras = {
  limiteConstructores: 3,
  toposDecorativos: 5,
  escalaTiempo: 1,

  tiemposConstruccion: {
    ballista: 3, turret: 3, catapult: 3,
    rift: 3, lab: 3, incubator: 3,
    vault: 3, mine: 3, workshop: 3,
    banner: 3, bannerslime: 3,
    bomb: 10, rocktrap: 3, electro: 3,
  },

  tiemposMejora: {
    core:        { 2: 3, 3: 3 },
    entrance:    { 2: 3, 3: 3 },
    ballista:    { 2: 3, 3: 3 },
    turret:      { 2: 3, 3: 3, 4: 3 },
    catapult:    { 2: 3 },
    rift:        { 2: 3, 3: 3, 4: 3 },
    lab:         { 2: 3 },
    incubator:   { 2: 3 },
    vault:       { 2: 3, 3: 3 },
    mine:        { 2: 3, 3: 3, 4: 3 },
    workshop:    { 2: 3, 3: 3, 4: 3 },
    banner:      { 2: 3, 3: 3, 4: 3, 5: 3 },
    bannerslime: { 2: 3, 3: 3 },
    bomb:        { 2: 3, 3: 3, 4: 3 },
    rocktrap:    { 2: 3, 3: 3 },
    electro:     { 2: 3 },
  },

  porDefecto: { construccion: 30, mejora: 60 },
  avisos: { minS: 3, maxS: 3600 },
};
