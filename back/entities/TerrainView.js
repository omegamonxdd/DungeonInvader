import { ENTRANCE_X, ENTRANCE_X_MAX, ENTRANCE_Y_MAX, ENTRANCE_Y_MIN } from '../config/world.js';
import { iso } from '../systems/iso.js';
import { EMPTY, DIRT, CORE, HEIGHTS, heightAt, noise } from '../systems/map.js';
import {
  DIRT_VARIANTS, FACE_LEFT, FACE_RIGHT, TILE_TEXTURE, dirtKey, coreStoneKey,
} from '../systems/textures.js';

/* Capa visual del terreno.
 * Cada casilla es una imagen con textura horneada; el orden de dibujo es
 * isométrico: profundidad = x + y (de atrás hacia delante).
 * Las caras laterales solo se dibujan si el vecino es más bajo, igual que
 * en el render legacy.
 */

// Los bloques elevados (tierra/núcleo) se adelantan dentro de su diagonal para
// que tapen el suelo de un edificio situado justo detrás. Debe ser mayor que
// cualquier capa interna del edificio (+0.05 como máximo) y menor que su
// etiqueta de recursos (+0.2).
const BLOCK_DEPTH_BIAS = 0.1;

export class TerrainView {
  constructor(scene, map) {
    this.scene = scene;
    this.map = map;
    this.tiles = [];
  }

  build() {
    const size = this.map.length;
    const { originX, originY } = TILE_TEXTURE;

    const addTile = (x, y, key) => {
      const p = iso(x, y);
      return this.scene.add.image(p.x, p.y, key)
        .setOrigin(originX, originY)
        .setDepth(this.depthFor(x, y));
    };

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        this.tiles[y * size + x] = addTile(x, y, this.textureFor(x, y));
      }
    }

    // La columna exterior de la entrada (x=41) queda fuera del mapa 41×41:
    // se pinta el mismo suelo para que las tropas no floten sobre el vacío.
    for (let y = ENTRANCE_Y_MIN; y <= ENTRANCE_Y_MAX; y++) {
      for (let x = ENTRANCE_X + 1; x <= ENTRANCE_X_MAX; x++) {
        addTile(x, y, 'floor');
      }
    }
  }

  // Una excavación o relleno cambia la textura de la casilla y las caras
  // laterales visibles de sus dos vecinas traseras (02-terreno.js).
  refresh(x, y) {
    const size = this.map.length;
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const { originX, originY } = TILE_TEXTURE;
    const update = (cx, cy) => {
      if (cx < 0 || cy < 0 || cx >= size || cy >= size) return;
      const p = iso(cx, cy);
      this.tiles[cy * size + cx]
        .setTexture(this.textureFor(cx, cy))
        .setPosition(p.x, p.y)
        .setOrigin(originX, originY)
        .setDepth(this.depthFor(cx, cy));
    };
    update(x, y);
    update(x, y - 1);
    update(x - 1, y);
  }

  depthFor(x, y) {
    const size = this.map.length;
    if (x < 0 || y < 0 || x >= size || y >= size) return x + y;
    const raised = HEIGHTS[this.map[y][x]] > 0;
    return x + y + (raised ? BLOCK_DEPTH_BIAS : 0);
  }

  faceMask(x, y, height) {
    const left = heightAt(this.map, x, y + 1) < height ? FACE_LEFT : 0;
    const right = heightAt(this.map, x + 1, y) < height ? FACE_RIGHT : 0;
    return left | right;
  }

  textureFor(x, y) {
    const id = this.map[y][x];

    if (id === DIRT) {
      const variant = Math.min(DIRT_VARIANTS - 1, Math.floor(noise(x, y) * DIRT_VARIANTS));
      return dirtKey(variant, this.faceMask(x, y, HEIGHTS[DIRT]));
    }
    if (id === CORE) {
      return coreStoneKey(this.faceMask(x, y, HEIGHTS[CORE]));
    }
    if (id === EMPTY) return 'floor';
    return 'floor';
  }
}
