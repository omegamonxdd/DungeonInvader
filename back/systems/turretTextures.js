/* Texturas del lanzadardos.
 *
 * Misma geometría de atlas y mismas anclas que la ballesta; la implementación
 * compartida está en defenseTextures.js (tools/turret-art/generate.mjs hornea
 * el arte). Este módulo solo aporta las claves y los alias públicos.
 */
import { TURRET } from '../config/defenses.js';
import { createDefenseTextures } from './defenseTextures.js';

export const TURRET_TEX = Object.freeze({
  headPrefix: 'turret-head-',
  base: 'turret-base',
  rock: 'turret-rock',
});

export const turretHeadAtlasKey = createDefenseTextures(TURRET, TURRET_TEX).headAtlasKey;
