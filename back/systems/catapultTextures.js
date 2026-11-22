/* Texturas de la catapulta.
 *
 * Misma geometría de atlas y mismas anclas que la ballesta y el lanzadardos;
 * la implementación compartida está en defenseTextures.js (el arte se hornea
 * en tools/catapult-art/generate.mjs). Este módulo solo aporta las claves y
 * los alias públicos. El headLift recoge la altura del armazón, sin zócalo.
 */
import { CATAPULT } from '../config/defenses.js';
import { createDefenseTextures } from './defenseTextures.js';

export const CATAPULT_TEX = Object.freeze({
  headPrefix: 'catapult-head-',
  base: 'catapult-base',
  rock: 'catapult-rock',
});

export const catapultHeadAtlasKey = createDefenseTextures(CATAPULT, CATAPULT_TEX).headAtlasKey;
