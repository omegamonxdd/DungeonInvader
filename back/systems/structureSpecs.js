/* ==========================================================
 * FASE 10 — CATÁLOGO DE ESTRUCTURAS
 * ----------------------------------------------------------
 * Una sola definición por tipo de edificio. Todos los números vienen de
 * `balance/`; aquí solo se organizan y se conectan con el dibujo, el modo
 * Mover, las obras y la simulación de invasión.
 *
 * El contrato de cada `spec` es:
 *   name, kind, slot, limitKind, size, height, maxLevel, category,
 *   hp(level), attack?, trap?, guard?, producer?, storage?, source?,
 *   hiddenInInvasion, targetable, range(level)
 * ========================================================== */

import {
  BALANCE, defensaAt, levelRow,
} from '../balance/index.js';
import { BALLISTA } from '../config/defenses.js';

const E = BALANCE.edificios;
const T = BALANCE.trampas;
// La lista de estructuras invisibles en invasión vive en balance/01, como en
// el legacy: no se duplica aquí.
const HIDDEN_IN_INVASION = new Set(BALANCE.visibilidad.ocultasAlInvadir || []);

const hpFrom = table => lvl => levelRow(table, lvl)?.hp ?? 0;
const simple = data => ({
  targetable: false,
  movable: true,
  ...data,
  hiddenInInvasion: HIDDEN_IN_INVASION.has(data.kind),
});

const STRUCTURE_SPECS = Object.freeze({
  core: simple({
    kind: 'core', name: 'Núcleo', size: 3, height: 30, category: 'especial',
    maxLevel: BALANCE.nucleo.maxLevel,
    hp: lvl => levelRow(BALANCE.nucleo.niveles, lvl)?.hp ?? 1000,
    targetable: true, movable: true, art: 'core',
  }),
  entrance: simple({
    kind: 'entrance', name: 'Entrada', size: 1, height: 24, category: 'especial',
    maxLevel: BALANCE.entrada.maxLevel,
    targetable: false, movable: false, art: 'entrance',
  }),

  ballista: simple({
    kind: 'ballista', name: 'Ballesta', slot: 'ballista', limitKind: 'ballista',
    size: BALLISTA.size, height: BALLISTA.height, category: 'defensas',
    maxLevel: BALLISTA.maxLevel,
    hp: lvl => defensaAt('ballista', lvl)?.hp ?? 0,
    range: lvl => defensaAt('ballista', lvl)?.range ?? BALLISTA.range,
    attack: lvl => {
      const d = defensaAt('ballista', lvl);
      return {
        cooldown: d.cooldown, damage: d.damage, dps: d.dps, range: d.range,
        damageType: 'single',
        z: BALANCE.defensas.ballista.boltHeight,
        speed: BALANCE.defensas.saetaVelocidad,
        projectile: 'bolt',
      };
    },
    targetable: true, art: 'ballista',
  }),
  turret: simple({
    kind: 'turret', name: 'Lanzadardos', slot: 'turret', limitKind: 'turret',
    size: BALANCE.defensas.turret.size, height: BALANCE.defensas.turret.height,
    category: 'defensas', maxLevel: BALANCE.defensas.turret.maxNivel,
    hp: lvl => defensaAt('turret', lvl)?.hp ?? 0,
    range: lvl => defensaAt('turret', lvl)?.range ?? 6.7,
    attack: lvl => {
      const d = defensaAt('turret', lvl);
      return {
        cooldown: d.cooldown, damage: d.damage, dps: d.dps, range: d.range,
        damageType: 'single',
        z: BALANCE.defensas.turret.boltHeight,
        speed: BALANCE.defensas.turret.dartSpeed,
        projectile: 'dart',
      };
    },
    targetable: true, art: 'turret',
  }),
  catapult: simple({
    kind: 'catapult', name: 'Catapulta', slot: 'catapult', limitKind: 'catapult',
    size: BALANCE.defensas.catapult.size, height: BALANCE.defensas.catapult.height,
    category: 'defensas', maxLevel: BALANCE.defensas.catapult.maxNivel,
    hp: lvl => defensaAt('catapult', lvl)?.hp ?? 0,
    range: lvl => defensaAt('catapult', lvl)?.range?.max ?? 10,
    attack: lvl => {
      const d = defensaAt('catapult', lvl);
      const cfg = BALANCE.defensas.catapult;
      return {
        cooldown: cfg.cooldown, damage: d.damage, dps: d.dps,
        range: cfg.range.max, minRange: cfg.range.min,
        splash: cfg.splash,
        // Tipo de daño global de la catapulta: área (radio `splash`).
        damageType: cfg.splash > 0 ? 'area' : 'single',
        z: cfg.boltHeight,
        speed: cfg.stoneSpeed, projectile: 'stone',
        accuracy: cfg.accuracy, missChance: cfg.missChance,
      };
    },
    targetable: true, art: 'catapult',
  }),

  rift: simple({
    kind: 'rift', name: 'Grieta', slot: 'rift', limitKind: 'rift',
    size: E.grieta.size, height: E.grieta.height, category: 'militar',
    maxLevel: E.grieta.maxNivel, hp: hpFrom(E.grieta.hp),
    source: 'rift', targetable: true, art: 'rift',
  }),
  lab: simple({
    kind: 'lab', name: 'Laboratorio', slot: 'lab', limitKind: 'lab',
    size: E.laboratorio.size, height: E.laboratorio.height, category: 'militar',
    maxLevel: E.laboratorio.maxNivel, hp: hpFrom(E.laboratorio.hp),
    targetable: true, art: 'lab',
  }),
  incubator: simple({
    kind: 'incubator', name: 'Incubadora', slot: 'incubator', limitKind: 'incubator',
    size: E.incubadora.size, height: E.incubadora.height, category: 'militar',
    maxLevel: E.incubadora.maxNivel, hp: hpFrom(E.incubadora.hp),
    source: 'incubator', targetable: true, art: 'incubator',
  }),

  vault: simple({
    kind: 'vault', name: 'Almacén', slot: 'vault-coins', limitKind: 'vault',
    size: E.almacen.size, height: E.almacen.height, category: 'recursos',
    maxLevel: E.almacen.maxNivel, hp: hpFrom(E.almacen.hp),
    storage: lvl => levelRow(E.almacen.capacidad, lvl) ?? 0,
    targetable: true, art: 'vault',
  }),
  mine: simple({
    kind: 'mine', name: 'Mina de cristal', slot: 'prod-crystals', limitKind: 'mine',
    size: E.produccion.size, height: E.produccion.height, category: 'recursos',
    maxLevel: E.produccion.maxNivel,
    hp: lvl => levelRow(E.produccion.niveles, lvl)?.hp ?? 0,
    producer: {
      resource: 'crystals',
      rate: lvl => levelRow(E.produccion.niveles, lvl)?.rate ?? 0,
      cap: lvl => levelRow(E.produccion.niveles, lvl)?.cap ?? 0,
    },
    targetable: true, art: 'mine',
  }),
  workshop: simple({
    kind: 'workshop', name: 'Taller de monedas', slot: 'prod-coins', limitKind: 'workshop',
    size: E.produccion.size, height: E.produccion.height, category: 'recursos',
    maxLevel: E.produccion.maxNivel,
    hp: lvl => levelRow(E.produccion.niveles, lvl)?.hp ?? 0,
    producer: {
      resource: 'coins',
      rate: lvl => levelRow(E.produccion.niveles, lvl)?.rate ?? 0,
      cap: lvl => levelRow(E.produccion.niveles, lvl)?.cap ?? 0,
    },
    targetable: true, art: 'workshop',
  }),

  banner: simple({
    kind: 'banner', name: 'Estandarte de esqueletos', slot: 'banner',
    limitKind: 'banner', size: E.banderaEsqueletos.size,
    height: E.banderaEsqueletos.height, category: 'estandartes',
    maxLevel: E.banderaEsqueletos.maxNivel,
    range: () => E.banderaEsqueletos.range,
    guard: {
      troop: 'esqueleto', range: E.banderaEsqueletos.range,
      count: lvl => levelRow(E.banderaEsqueletos.niveles, lvl)?.count ?? 0,
      level: lvl => levelRow(E.banderaEsqueletos.niveles, lvl)?.skeletonLevel ?? 1,
    },
    art: 'banner',
  }),
  bannerslime: simple({
    kind: 'bannerslime', name: 'Estandarte de slimes', slot: 'bannerslime',
    limitKind: 'bannerslime', size: E.banderaSlimes.size,
    height: 48, category: 'estandartes', maxLevel: E.banderaSlimes.maxNivel,
    range: () => E.banderaSlimes.range,
    guard: {
      troop: 'slime', range: E.banderaSlimes.range,
      count: () => 1,
      level: lvl => levelRow(E.banderaSlimes.niveles, lvl)?.slimeLevel ?? 1,
    },
    art: 'bannerslime',
  }),

  bomb: simple({
    kind: 'bomb', name: 'Bomba', slot: 'bomb', limitKind: 'bomb',
    size: T.bomba.size, height: T.bomba.height, category: 'trampas',
    maxLevel: T.bomba.maxNivel,
    trap: {
      type: 'bomb',
      activation: lvl => trampaAt(lvl)?.act ?? 1,
      range: lvl => trampaAt(lvl)?.range ?? 1,
      damage: lvl => trampaAt(lvl)?.damage ?? 8,
      explosionMs: T.bomba.explosionMs,
    },
    art: 'bomb',
  }),
  electro: simple({
    kind: 'electro', name: 'Electrostal', slot: 'electro', limitKind: 'electro',
    size: T.electro.size, height: T.electro.height, category: 'trampas',
    maxLevel: T.electro.maxNivel,
    trap: {
      type: 'electro',
      range: lvl => levelRow(T.electro.niveles, lvl)?.range ?? 2,
      damage: lvl => levelRow(T.electro.niveles, lvl)?.damage ?? 10,
      chain: lvl => levelRow(T.electro.niveles, lvl)?.chain ?? 1.5,
      targets: lvl => levelRow(T.electro.niveles, lvl)?.targets ?? 2,
      cooldown: T.electro.cooldown,
      chainMs: T.electro.chainMs,
      arcMs: T.electro.arcMs,
    },
    art: 'electro',
  }),
  rocktrap: simple({
    kind: 'rocktrap', name: 'Trampa de rocas', slot: 'rocktrap', limitKind: 'rocktrap',
    size: T.rocas.size, height: T.rocas.height, category: 'trampas',
    maxLevel: T.rocas.maxNivel,
    trap: {
      type: 'rocktrap',
      damage: lvl => T.rocas.danioPorNivel[lvl] ?? T.rocas.damage,
      interval: T.rocas.interval,
      reentry: T.rocas.reentry,
    },
    art: 'rocktrap',
  }),
});

function trampaAt(lvl) {
  return levelRow(T.bomba.niveles, lvl);
}

export function specFor(kindOrDef) {
  const kind = typeof kindOrDef === 'string' ? kindOrDef : kindOrDef?.kind;
  return STRUCTURE_SPECS[kind] || null;
}

export function maxHpOf(def) {
  const spec = specFor(def);
  return spec?.hp ? (spec.hp(def.level || 1) || 0) : 0;
}

export function attackOf(def) {
  const spec = specFor(def);
  return spec?.attack ? spec.attack(def.level || 1) : null;
}

/* Una obra no inutiliza la estructura: sigue trabajando con su nivel actual
 * y solo cambia cuando la obra termina. Las únicas excepciones son:
 *   · construcciones nuevas (todavía no hay edificio operativo);
 *   · defensas en mejora (no atacan), minas/talleres en mejora (no producen)
 *     y trampas en mejora (no se activan en la invasión).
 * El movimiento NUNCA se bloquea por estar en obras: ni la barra de acciones
 * ni el editor (Recoger/Retirar) pueden quitar esa opción al jugador.
 */
export function pausedByWork(def) {
  if (!def?.work) return false;
  if (def.work.kind === 'build') return true;
  const spec = specFor(def);
  return Boolean(spec?.attack || spec?.producer || spec?.trap);
}

// Nombre corto para los avisos y el HUD de constructores.
export function nameOf(def) {
  return specFor(def)?.name || def?.id || 'Estructura';
}
