import { WORLD } from '../config/world.js';

/* Identificadores de celda, igual que js/core/01-config-estado.js. */
export const EMPTY = 0; // Vacío / suelo despejado
export const DIRT = 1;  // Bloque de tierra
export const CORE = 2;  // Núcleo de la mazmorra

export const HEIGHTS = Object.freeze({
  [DIRT]: WORLD.baseDirtH * WORLD.scale,
  [CORE]: WORLD.baseCoreH * WORLD.scale,
});

/* Mapa lógico 41×41. Mismo orden y mismas reglas que createMap() del legacy:
 *  - todo empieza siendo tierra,
 *  - cuadrado despejado en el centro,
 *  - núcleo 3×3,
 *  - entrada de 3 casillas en el borde este,
 *  - camino de fábrica de 3 casillas de ancho hasta la zona despejada.
 */
export function createMap() {
  const size = WORLD.mapSize;
  const grid = [];
  for (let y = 0; y < size; y++) grid.push(new Array(size).fill(DIRT));

  for (let y = WORLD.clearMin; y <= WORLD.clearMax; y++) {
    for (let x = WORLD.clearMin; x <= WORLD.clearMax; x++) grid[y][x] = EMPTY;
  }

  for (let y = WORLD.coreMin; y <= WORLD.coreMax; y++) {
    for (let x = WORLD.coreMin; x <= WORLD.coreMax; x++) grid[y][x] = CORE;
  }

  for (let y = WORLD.entranceYMin; y <= WORLD.entranceYMax; y++) {
    grid[y][WORLD.entranceX] = EMPTY;
  }

  for (let y = WORLD.entranceYMin; y <= WORLD.entranceYMax; y++) {
    for (let x = WORLD.factoryPathXMin; x <= WORLD.factoryPathXMax; x++) grid[y][x] = EMPTY;
  }

  return grid;
}

export function heightAt(map, x, y) {
  if (x < 0 || y < 0 || x >= map.length || y >= map.length) return 0;
  return HEIGHTS[map[y][x]] || 0;
}

// Ruido determinista por casilla (idéntico al del render legacy).
export function noise(x, y) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
