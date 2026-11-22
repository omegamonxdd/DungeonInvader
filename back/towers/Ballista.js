import { BALLISTA } from '../config/defenses.js';
import { BALLISTA_TEX } from '../systems/ballistaTextures.js';
import { DefenseTower } from './DefenseTower.js';

/* Ballesta de nivel 1: pedestal + sombra y 24 ángulos × 3 estados horneados
 * desde un modelo 3D con cámara isométrica real (tools/ballista-art/).
 * Toda la lógica compartida vive en DefenseTower; aquí solo el ritmo del
 * disparo (destello a los 110 ms, recuperación a los 320 ms). */
export class Ballista extends DefenseTower {
  constructor(scene, x, y, level = 1) {
    super(scene, x, y, level, BALLISTA, BALLISTA_TEX, [110, 320]);
  }
}
