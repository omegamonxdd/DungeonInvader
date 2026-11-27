/* ==========================================================
 * BALANCE 04 — OBRAS (CONSTRUCTORES Y TIEMPOS)
 * ----------------------------------------------------------
 * Tiempos en SEGUNDOS REALES. escalaTiempo multiplica todos:
 * 0.05 = pruebas al 5 % (volver a 1 al terminar).
 * Espejo de js/balance/04-obras.js (legacy, no se toca).
 * ========================================================== */

export const obras = {
  limiteConstructores: 3,
  limiteSlotsLaboratorio: 2,
  toposDecorativos: 5,
  escalaTiempo: 1,

  tiemposConstruccion: {
    ballista: 10, turret: 30, catapult: 150,
    // PROVISIONAL: tiempos pendientes de ajuste final por el usuario.
    'altar-electrico': 300, 'altar-igneo': 300,
    rift: 3, lab: 300, incubator: 300,
    'vault-coins': 10, 'vault-crystals': 10, 'vault-rubies': 10, mine: 3, workshop: 3, 'mine-rubies': 3, // TODO balance
    banner: 10, bannerslime: 30,
    bomb: 3, rocktrap: 45, electro: 60,
    'rag-altar': 60,
  },

  tiemposMejora: {
    core:        { 2: 60, 3: 300, 4: 600 },
    entrance:    { 2: 120, 3: 300 },
    ballista:    { 2: 45, 3: 150, 4: 240, 5: 480 },
    turret:      { 2: 90, 3: 150, 4: 270 },
    catapult:    { 2: 290 },
    'altar-electrico': { 2: 180 },
    'altar-igneo':     { 2: 180 },
    rift:        { 2: 45, 3: 150, 4: 300 },
    lab:         { 2: 360, 3: 750 },
    incubator:   { 2: 360 },
    'vault-coins':    { 2: 30, 3: 270, 4: 600 },
    'vault-crystals': { 2: 30, 3: 270, 4: 600 },
    'vault-rubies':   { 2: 300 },
    mine:        { 2: 10, 3: 30, 4: 60, 5: 180 },
    workshop:    { 2: 10, 3: 30, 4: 60, 5: 180 },
    'mine-rubies': { 2: 240, 3: 480},
    banner:      { 2: 25, 3: 50, 4: 160, 5: 270, 6: 480 },
    bannerslime: { 2: 60, 3: 120 },
    bomb:        { 2: 10, 3: 30, 4: 45 },
    rocktrap:    { 2: 90, 3: 150 },
    electro:     { 2: 120 },
  },

  tiemposMutacion: {
    esqueleto:  { 2: 30, 3: 90, 4: 180 },
    slime:      { 2: 45, 3: 120, 4: 240 },
    golem:      { 2: 120, 3: 240, 4: 360 },
    murcielago: { 2: 60, 3: 120, 4: 180 },
    armadura:   { 2: 180, 3: 360 },
    arana:      { 2: 210, 3: 420, 4: 630 },
  },

  tiemposMejoraRag: {
    2: 180,
    3: 240,
    4: 300,
    5: 360,
  },

  porDefecto: { construccion: 30, mejora: 60 },
  avisos: { minS: 3, maxS: 7200 },
};
