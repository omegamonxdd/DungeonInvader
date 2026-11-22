/* Texturas de la ballesta.
 *
 * La implementación compartida de las tres defensas vive en defenseTextures.js.
 * Este módulo solo fija sus claves y reexpone los helpers con los nombres que
 * ya usan BootScene y towers/Ballista.js. El arte se hornea OFFLINE con cámara
 * ortográfica isométrica (tools/ballista-art/generate.mjs): 24 ángulos × 3
 * estados repartidos en 4 atlas de 6 columnas.
 */
import { BALLISTA } from '../config/defenses.js';
import { createDefenseTextures } from './defenseTextures.js';

export const BALLISTA_TEX = Object.freeze({
  headPrefix: 'ballista-head-',
  base: 'ballista-base',
  rock: 'ballista-rock',
});

export const headAtlasKey = createDefenseTextures(BALLISTA, BALLISTA_TEX).headAtlasKey;
