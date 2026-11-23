import { ENTRANCE_X, ENTRANCE_X_MAX, ENTRANCE_Y_MAX, ENTRANCE_Y_MIN, WORLD } from '../config/world.js';
import { DIG_LIMITS } from '../config/interaction.js';
import { CORE, DIRT, EMPTY } from './map.js';

/* Estado editable del terreno.
 * Equivale a js/core/01-config-estado.js + js/world/02-terreno.js:
 * cupo de excavación, celdas ocupadas por estructuras y validez del camino
 * hasta el núcleo (BFS en 4 direcciones desde la entrada).
 */
export class TerrainState {
  constructor(map) {
    this.map = map;
    this.n = map.length;
    this.occupied = new Set();       // llaves de celdas con estructura
    this.digCount = 0;
    for (let y = 0; y < this.n; y++) {
      for (let x = 0; x < this.n; x++) if (map[y][x] !== DIRT) this.digCount++;
    }
    this.digLimit = DIG_LIMITS[1];
    this.tool = null;                // 'dig' | 'fill' | null
    this.hover = null;
    this.pathValid = true;

    // El núcleo cuenta como estructura; la entrada registra sus 2×3 celdas
    // (la columna exterior x=41 queda fuera del mapa pero también se reserva).
    for (let y = WORLD.coreMin; y <= WORLD.coreMax; y++) {
      for (let x = WORLD.coreMin; x <= WORLD.coreMax; x++) this.occupy(x, y);
    }
    for (let y = ENTRANCE_Y_MIN; y <= ENTRANCE_Y_MAX; y++) {
      for (let x = ENTRANCE_X; x <= ENTRANCE_X_MAX; x++) this.occupy(x, y);
    }
  }

  /** Huella completa de la entrada, incluida la columna exterior x=41. */
  isEntranceCell(x, y) {
    return x >= ENTRANCE_X && x <= ENTRANCE_X_MAX
      && y >= ENTRANCE_Y_MIN && y <= ENTRANCE_Y_MAX;
  }

  key(x, y) { return y * this.n + x; }

  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.n && y < this.n; }

  occupy(x, y) { this.occupied.add(this.key(x, y)); }

  release(x, y) { this.occupied.delete(this.key(x, y)); }

  setFootprint(x, y, w, h, on) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (on) this.occupy(x + i, y + j);
        else this.release(x + i, y + j);
      }
    }
  }

  hasStructure(x, y) {
    // La columna exterior de la entrada está fuera del mapa 41×41, pero es
    // suelo reservado: nunca se puede excavar, rellenar ni construir sobre él.
    if (this.isEntranceCell(x, y)) return true;
    return this.inBounds(x, y) && (this.map[y][x] === CORE || this.occupied.has(this.key(x, y)));
  }

  cellIsFree(x, y) {
    return this.inBounds(x, y) && this.map[y][x] === EMPTY && !this.hasStructure(x, y);
  }

  footprintFree(size, x, y) {
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) if (!this.cellIsFree(x + i, y + j)) return false;
    }
    return true;
  }

  digLimitReached() { return this.digCount >= this.digLimit; }

  digCell(x, y) {
    if (this.isEntranceCell(x, y)) return false;
    if (!this.inBounds(x, y) || this.map[y][x] !== DIRT || this.hasStructure(x, y)) return false;
    if (this.digLimitReached()) return false;
    this.map[y][x] = EMPTY;
    this.digCount++;
    return true;
  }

  fillCell(x, y) {
    // La entrada (y su hueco exterior de 3 casillas) es inrellenable.
    if (this.isEntranceCell(x, y)) return false;
    if (!this.inBounds(x, y) || this.map[y][x] !== EMPTY || this.hasStructure(x, y)) return false;
    this.map[y][x] = DIRT;
    this.digCount--;
    return true;
  }

  applyCell(cell) {
    if (!cell || !this.tool) return false;
    const changed = this.tool === 'dig' ? this.digCell(cell.x, cell.y) : this.fillCell(cell.x, cell.y);
    if (changed) {
      this.pathValid = this.isCoreReachable();
      // Con el cupo agotado la herramienta se apaga, como en setTool().
      if (this.tool === 'dig' && this.digLimitReached()) this.tool = null;
    }
    return changed;
  }

  setTool(tool) {
    if (tool === 'dig' && this.digLimitReached()) tool = null;
    this.tool = tool;
    this.hover = null;
  }

  isCoreReachable() {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const queue = [];
    const seen = new Set();
    for (let y = WORLD.entranceYMin; y <= WORLD.entranceYMax; y++) {
      if (this.map[y][WORLD.entranceX] !== EMPTY) continue;
      queue.push({ x: WORLD.entranceX, y });
      seen.add(this.key(WORLD.entranceX, y));
    }
    for (let i = 0; i < queue.length; i++) {
      const { x, y } = queue[i];
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (!this.inBounds(nx, ny)) continue;
        if (this.map[ny][nx] === CORE) return true;
        if (this.map[ny][nx] !== EMPTY) continue;
        const k = this.key(nx, ny);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push({ x: nx, y: ny });
      }
    }
    return false;
  }
}
