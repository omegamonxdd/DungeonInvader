/* ==========================================================
 * BALANCE 01 — MUNDO, NÚCLEO, ENTRADA, RECURSOS Y CÁMARA
 * ----------------------------------------------------------
 * ÚNICA fuente de estos números en la app Phaser. Espejo exacto de
 * js/balance/01-mundo-y-nucleo.js (legacy, no se toca).
 * Edita aquí, guarda y recarga Vite. Unidades: casillas y px.
 * ========================================================== */

export const mundo = {
  mapSize: 41,
  scale: 1.5,
  baseTileW: 64,
  baseTileH: 40,
  baseDirtH: 16,
  baseCoreH: 10, // mitad de alto que antes (20): la roca del núcleo baja su altura a la mitad
  clearMin: 18,
  clearMax: 22,
  coreMin: 19,
  coreMax: 21,
  // Entrada 2×3: x=40 dentro del mapa 41×41 y x=41 fuera (3 casillas
  // exteriores en y=19..21). Las tropas entran y se quedan en esa huella.
  entranceX: 40,
  entranceXMax: 41,
  entranceYMin: 19,
  entranceYMax: 21,
  zoomMin: 0.3,
  zoomMax: 3,
  zoomStep: 1.12,
  initialZoomFactor: 0.92 / 1.5,
  frameOffsetY: 0,
  clickTolerance: 4,
  factoryPathXMin: 23,
  factoryPathXMax: 39,
};

export const nucleo = {
  maxLevel: 4,
  niveles: {
    1: { hp: 1000, storage: 2500, storageRubies: 0 },
    2: { hp: 1250, storage: 4000, storageRubies: 0 },
    3: { hp: 1500, storage: 10000, storageRubies: 0 },
    4: { hp: 2000, storage: 25000, storageRubies: 5000 },
  },
  limiteExcavacion: { 1: 100, 2: 115, 3: 150, 4: 185 },
};

export const entrada = {
  maxLevel: 4,
  espacioTropas: { 1: 20, 2: 30, 3: 50, 4: 70},
};

export const recursos = {
  // Partida nueva: 2000 de cada recurso. Para pruebas locales se puede
  // forzar otra cantidad con VITE_DEV_RESOURCES (ver config/devResources.js).
  inicio: { coins: 2000, crystals: 2000, rubies: 0 },
};

export const camara = {
  velocidad: 800, // px/s
  dtMaximo: 0.05,
};

export const topos = {
  velocidad: 1.1,
  radioPaseo: 8,
  escalaPixel: 1.5,
  distanciaObra: 1,
  visiblesEnInvasion: false,
};

export const visibilidad = {
  ocultasAlInvadir: ['bomb', 'electro'],
};
