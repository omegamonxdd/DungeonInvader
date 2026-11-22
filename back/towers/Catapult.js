import { CATAPULT } from '../config/defenses.js';
import { CATAPULT_TEX } from '../systems/catapultTextures.js';
import { DefenseTower } from './DefenseTower.js';

/* Catapulta de nivel 1: zócalo de piedra, armazón de madera y brazo con cazo
 * y contrapeso (tools/catapult-art/). El lanzamiento se ve breve y el retorno
 * del brazo termina mucho antes del siguiente disparo. */
export class Catapult extends DefenseTower {
  constructor(scene, x, y, level = 1) {
    super(scene, x, y, level, CATAPULT, CATAPULT_TEX, [
      CATAPULT.fireMs * 0.22,
      CATAPULT.fireMs * 0.62,
    ]);
  }
}
