import { CORE_SIZE, DIRT_HEIGHT, SCALE, WORLD } from './world.js';
import { BALANCE } from '../balance/index.js';

/* Interactividad (Fase 5).
 * Las reglas numéricas vienen de balance/01; aquí solo quedan los colores
 * de resaltado y las profundidades de dibujo, que son arte, no balance.
 */
export const DIG_LIMITS = BALANCE.nucleo.limiteExcavacion;
export const CLICK_TOLERANCE = BALANCE.mundo.clickTolerance;

// Altura a la que se levanta una estructura en modo Mover (07-modo-mover.js:13).
export const FLOAT_LIFT = DIRT_HEIGHT + 8 * SCALE;

// Profundidades usadas por structureAt() para desempatar (04-render.js:236-245).
export const CORE_DEPTH = WORLD.coreMin + WORLD.coreMin + CORE_SIZE;
export const ENTRANCE_DEPTH = WORLD.entranceX + WORLD.entranceYMin + 1.5;

export const INTERACTION_COLORS = Object.freeze({
  dig: 0x46dc78,
  digEdge: 0xaaffc8,
  fill: 0x5aa0ff,
  fillEdge: 0xbfe0ff,
  invalidFree: 0xff4646,
  invalidBusy: 0xff3232,
  invalidEdge: 0xffa0a0,
  validOutline: 0x78ffaa,
  invalidOutline: 0xff6e6e,
  selection: 0xffd28a,
  range: 0xffd27a,
  rangeEdge: 0xffe2a0,
});

// Capa por encima del mundo (terreno llega hasta ~80).
export const OVERLAY_DEPTH = 1000;
