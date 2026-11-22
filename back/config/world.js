import { BALANCE } from '../balance/index.js';

/* Medidas del mundo.
 * Los valores viven en `balance/01-mundo-y-nucleo.js`; aquí solo se derivan
 * las constantes que usa el render. No duplicar números en este archivo.
 */
const { mundo } = BALANCE;

export const WORLD = Object.freeze({
  mapSize: mundo.mapSize,
  scale: mundo.scale,
  baseTileW: mundo.baseTileW,
  baseTileH: mundo.baseTileH,
  baseDirtH: mundo.baseDirtH,
  baseCoreH: mundo.baseCoreH,
  clearMin: mundo.clearMin,
  clearMax: mundo.clearMax,
  coreMin: mundo.coreMin,
  coreMax: mundo.coreMax,
  entranceX: mundo.entranceX,
  entranceYMin: mundo.entranceYMin,
  entranceYMax: mundo.entranceYMax,
  factoryPathXMin: mundo.factoryPathXMin,
  factoryPathXMax: mundo.factoryPathXMax,
});

export const SCALE = WORLD.scale;
export const TILE_W = WORLD.baseTileW * SCALE;
export const TILE_H = WORLD.baseTileH * SCALE;
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;
export const DIRT_HEIGHT = WORLD.baseDirtH * SCALE;
export const CORE_HEIGHT = WORLD.baseCoreH * SCALE;
export const CORE_SIZE = WORLD.coreMax - WORLD.coreMin + 1;
export const CORE_MIN = WORLD.coreMin;
export const ENTRANCE_X = WORLD.entranceX;
export const ENTRANCE_Y_MIN = WORLD.entranceYMin;
export const ENTRANCE_Y_MAX = WORLD.entranceYMax;

// Cámara (balance/01).
export const ZOOM_MIN = mundo.zoomMin;
export const ZOOM_MAX = mundo.zoomMax;
export const ZOOM_STEP = mundo.zoomStep;
export const INITIAL_ZOOM_FACTOR = mundo.initialZoomFactor;
export const FRAME_OFFSET_Y = mundo.frameOffsetY;
export const CAM_SPEED = BALANCE.camara.velocidad;
export const CAM_DT_MAX = BALANCE.camara.dtMaximo;
