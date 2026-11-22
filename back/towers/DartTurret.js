import { TURRET } from '../config/defenses.js';
import { TURRET_TEX } from '../systems/turretTextures.js';
import { DefenseTower } from './DefenseTower.js';

/* Lanzadardos de nivel 1: mismas anclas y atlas que la ballesta
 * (tools/turret-art/). El cooldown es más corto, por eso el destello y la
 * recuperación terminan antes. */
export class DartTurret extends DefenseTower {
  constructor(scene, x, y, level = 1) {
    super(scene, x, y, level, TURRET, TURRET_TEX, [
      TURRET.fireMs * 0.32,
      TURRET.fireMs * 0.9,
    ]);
  }
}
