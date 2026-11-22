import { ENTRANCE_X, ENTRANCE_Y_MAX, ENTRANCE_Y_MIN } from './world.js';
import { BALANCE } from '../balance/index.js';

/* Defensas.
 * Los números jugables (tamaño, altura, nivel y alcance) salen de
 * balance/06-defensas.js. Aquí solo quedan las medidas del arte horneado:
 * celdas, anclas, fotogramas y objetivo por defecto.
 */
const { ballista, turret, catapult } = BALANCE.defensas;

export const BALLISTA = Object.freeze({
  kind: 'ballista',
  name: 'Ballesta',
  size: ballista.size,
  height: ballista.height,
  level: 1,
  maxLevel: ballista.maxNivel,

  // Arte 2.5D horneado desde un modelo 3D con cámara isométrica real.
  // Ver tools/ballista-art/generate.mjs y ballista-art.json.
  cell: 256,                 // px por celda en base.png y en cada frame de head
  sheetPad: 4,               // margen transparente a cada lado del frame
  artScale: 0.67,            // px de mundo por px de arte
  model: Object.freeze({
    baseGround: Object.freeze({ x: 128, y: 170 }), // huella 2×2 dentro de base.png
    headPivot: Object.freeze({ x: 128, y: 128 }),  // pivote dentro de cada frame
    headLift: 83,              // px de arte entre suelo y pivote (1.55 u. × 0.866 × 62)
  }),

  range: ballista.ranges[1], // alcance de nivel 1 (balance/06-defensas.js)
  yawFrames: 24,             // 360° en pasos de 15°
  headGroupCols: 6,          // ángulos por atlas (4 atlas para no pasar de 4096 px)
  headGroups: 4,
  fireFrames: 3,             // reposo, disparo y recuperación
  fireMs: 360,

  // Sin objetivo, la cabeza mira a la entrada, igual que en el legacy.
  defaultTarget: Object.freeze({
    x: ENTRANCE_X + 0.5,
    y: (ENTRANCE_Y_MIN + ENTRANCE_Y_MAX + 1) / 2,
  }),
});

/* Lanzadardos (torreta), nivel 1.
 * Mismo pipeline y mismo esquema de anclas/atlas que la ballesta: pedestal
 * fijo + sombra y 24 ángulos × 3 estados ya renderizados desde el modelo 3D.
 * El arte se genera en tools/turret-art/ y vive en
 * front/assets/estructuras/lanzadardos/. Solo se hornea el nivel 1; los
 * niveles superiores siguen usando la misma hoja hasta que se generen.
 */
export const TURRET = Object.freeze({
  kind: 'turret',
  name: 'Lanzadardos',
  size: turret.size,
  height: turret.height,
  level: 1,
  maxLevel: turret.maxNivel,

  cell: 256,
  sheetPad: 4,
  artScale: 0.67,            // mismo px de mundo por px de arte que la ballesta
  model: Object.freeze({
    baseGround: Object.freeze({ x: 128, y: 170 }),
    headPivot: Object.freeze({ x: 128, y: 128 }),
    headLift: 56,            // 1.05 u. × 0.866 × 62 (sin el zócalo de piedra)
  }),

  range: turret.ranges[1],
  yawFrames: 24,
  headGroupCols: 6,
  headGroups: 4,
  fireFrames: 3,
  fireMs: 250,               // cooldown de nivel 1 (0.25 s)

  defaultTarget: Object.freeze({
    x: ENTRANCE_X + 0.5,
    y: (ENTRANCE_Y_MIN + ENTRANCE_Y_MAX + 1) / 2,
  }),
});

/* Catapulta (nivel 1).
 * Tercera defensa del mismo set: zócalo bajo de piedra, armazón de madera con
 * amarres y cabeza giratoria con brazo, cazo y contrapeso de roca. Comparte
 * cámara, paleta, biseles, anclas y atlas con la ballesta y el lanzadardos;
 * el arte se genera en tools/catapult-art/ y vive en
 * front/assets/estructuras/catapulta/. Solo se hornea el nivel 1 (los niveles
 * posteriores reutilizan la hoja hasta que se generen).
 */
export const CATAPULT = Object.freeze({
  kind: 'catapult',
  name: 'Catapulta',
  size: catapult.size,
  height: catapult.height,
  level: 1,
  maxLevel: catapult.maxNivel,

  cell: 256,
  sheetPad: 4,
  artScale: 0.67,            // mismo px de mundo por px de arte que las otras
  model: Object.freeze({
    baseGround: Object.freeze({ x: 128, y: 170 }),
    headPivot: Object.freeze({ x: 128, y: 128 }),
    headLift: 61,            // 1.14 u. × 0.866 × 62 (sin el zócalo de piedra)
  }),

  range: catapult.range.max, // alcance de nivel 1 (balance/06-defensas.js)
  yawFrames: 24,
  headGroupCols: 6,
  headGroups: 4,
  fireFrames: 3,
  fireMs: 900,               // el cooldown es 3 s; el brazo se desarma antes

  defaultTarget: Object.freeze({
    x: ENTRANCE_X + 0.5,
    y: (ENTRANCE_Y_MIN + ENTRANCE_Y_MAX + 1) / 2,
  }),
});
