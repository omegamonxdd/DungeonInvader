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
    ballista: 10, turret: 30, catapult: 150,
    rift: 3, lab: 300, incubator: 300,
    vault: 10, mine: 3, workshop: 3,
    banner: 10, bannerslime: 30,
    bomb: 3, rocktrap: 45, electro: 60,
  },

  tiemposMejora: {
    core:        { 2: 60, 3: 300 },
    entrance:    { 2: 120, 3: 300 },
    ballista:    { 2: 45, 3: 150, 4: 240 },
    turret:      { 2: 90, 3: 150, 4: 270 },
    catapult:    { 2: 290 },
    rift:        { 2: 45, 3: 150, 4: 300 },
    lab:         { 2: 360 },
    incubator:   { 2: 360 },
    vault:       { 2: 30, 3: 270 },
    mine:        { 2: 10, 3: 30, 4: 60 },
    workshop:    { 2: 10, 3: 30, 4: 60 },
    banner:      { 2: 25, 3: 50, 4: 160, 5: 270 },
    bannerslime: { 2: 60, 3: 120 },
    bomb:        { 2: 10, 3: 30, 4: 45 },
    rocktrap:    { 2: 90, 3: 150 },
    electro:     { 2: 120 },
  },

  porDefecto: { construccion: 30, mejora: 60 },
  avisos: { minS: 3, maxS: 7200 },
};
