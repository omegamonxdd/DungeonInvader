/* ==========================================================
 * BALANCE — PUNTO DE ENTRADA Y CONSULTA DE ESTADÍSTICAS
 * ----------------------------------------------------------
 * ÚNICA fuente de números ajustables de la app Phaser. Los archivos
 * 01…09 solo exportan datos; aquí se agrupan y se dan helpers para
 * leerlos sin repetir tablas por el resto del código.
 *
 * Uso:
 *   import { BALANCE, levelRow, defDamage, defensaAt } from '../balance/index.js';
 *
 * En consola (solo DEV): `__DUNGEON_BALANCE__` y `__DUNGEON_BALANCE__.report()`.
 * ========================================================== */

import { mundo, nucleo, entrada, recursos, camara, topos, visibilidad } from './01-mundo-y-nucleo.js';
import { estructuras } from './02-estructuras.js';
import { costes } from './03-costes.js';
import { obras } from './04-obras.js';
import { edificios } from './05-edificios.js';
import { defensas } from './06-defensas.js';
import { trampas } from './07-trampas.js';
import { tropas } from './08-tropas.js';
import { invasion } from './09-invasion.js';

export const BALANCE = {
  mundo, nucleo, entrada, recursos, camara, topos, visibilidad,
  estructuras, costes, obras, edificios, defensas, trampas, tropas, invasion,
};

/* Convención del proyecto: si el nivel pedido no existe, se usa la fila
 * del nivel más alto definido. Vale para cualquier tabla por nivel. */
export function levelRow(table, lvl) {
  if (!table) return undefined;
  if (table[lvl] !== undefined) return table[lvl];
  const keys = Object.keys(table).map(Number).filter(n => !Number.isNaN(n));
  return keys.length ? table[Math.max(...keys)] : undefined;
}

/* Daño por impacto de una defensa, sin redondear a entero (solo limpia
 * el error de coma flotante), igual que defDamage() del legacy. */
export function defDamage(dps, cooldown) {
  const d = dps * cooldown;
  return Math.round(d * 1000) / 1000;
}

/* Costes -------------------------------------------------------------- */
export const buildCost = slot => costes.construccion[slot] || {};
export const upgradeCost = (kind, toLevel) => levelRow(costes.mejora[kind], toLevel) || {};

export function formatCost(cost) {
  const parts = [];
  if (cost?.coins) parts.push(`${cost.coins} oro`);
  if (cost?.crystals) parts.push(`${cost.crystals} cristal`);
  return parts.length ? parts.join(' + ') : 'gratis';
}

/* Obras ---------------------------------------------------------------- */
export const scaled = seconds => seconds * obras.escalaTiempo;
export const buildTime = kind => scaled(levelRow(obras.tiemposConstruccion, kind) ?? obras.porDefecto.construccion);
export const upgradeTime = (kind, toLevel) => scaled(
  levelRow(obras.tiemposMejora[kind], toLevel) ?? obras.porDefecto.mejora,
);

/* Límites y niveles ---------------------------------------------------- */
export function structureLimit(kind, coreLevel) {
  const table = estructuras.limitePorNucleo[kind];
  if (!table) return 0;
  let limit = 0;
  for (const [lvl, n] of Object.entries(table)) {
    if (Number(lvl) <= coreLevel) limit = Math.max(limit, n);
  }
  return limit;
}

export function allowedMaxLevel(kind, coreLevel) {
  const own = estructuras.maxNivel[kind] ?? 1;
  const cap = estructuras.topeNivelPorNucleo[coreLevel]?.[kind];
  return cap === undefined ? own : Math.min(own, cap);
}

/* Stat de una fila por nivel ------------------------------------------- */
export const statAt = (table, lvl, key) => levelRow(table, lvl)?.[key];

export function defensaAt(kind, lvl) {
  const d = defensas[kind];
  if (!d) return null;
  const hp = levelRow(d.hp, lvl);
  const dps = levelRow(d.dps, lvl);
  const range = d.ranges ? levelRow(d.ranges, lvl) : d.range;
  return {
    hp,
    dps,
    range,
    cooldown: d.cooldown,
    damage: defDamage(dps, d.cooldown),
    size: d.size,
    height: d.height,
  };
}

export const tropaAt = (id, lvl) => levelRow(tropas.tipos[id]?.niveles, lvl);
export const trampaAt = (kind, lvl) => levelRow(trampas[kind]?.niveles, lvl);

/* Validación ----------------------------------------------------------- */
/* Devuelve avisos en español; no lanza excepciones para poder llamarla
 * desde la consola en cualquier momento. */
export function balanceReport() {
  const warn = [];
  const { minS, maxS } = obras.avisos;

  const checkTimes = (label, table, levels) => {
    if (!table) return;
    for (const [key, value] of Object.entries(table)) {
      const secs = typeof value === 'object'
        ? (levels ? value[levels] : undefined)
        : value;
      if (secs === undefined) continue;
      if (secs < minS) warn.push(`${label}.${key}: ${secs}s < ${minS}s (aviso)`);
      if (secs > maxS) warn.push(`${label}.${key}: ${secs}s > ${maxS}s (aviso)`);
    }
  };
  checkTimes('obras.tiemposConstruccion', obras.tiemposConstruccion);
  for (const [kind, table] of Object.entries(obras.tiemposMejora)) {
    checkTimes(`obras.tiemposMejora.${kind}`, table);
  }

  for (const [kind, max] of Object.entries(estructuras.maxNivel)) {
    if (defensas[kind] && !levelRow(defensas[kind].hp, max)) {
      warn.push(`defensas.${kind}: falta fila de hp para el nivel ${max}`);
    }
  }
  if (obras.escalaTiempo !== 1) {
    warn.push(`obras.escalaTiempo = ${obras.escalaTiempo} (¿modo pruebas? recuérdalo)`);
  }
  if (!nucleo.limiteExcavacion[1] || nucleo.limiteExcavacion[1] < 79) {
    warn.push('nucleo.limiteExcavacion[1]: menor que las 79 casillas iniciales');
  }
  return warn;
}

// Los helpers también cuelgan de BALANCE para poder usarlos desde la consola.
Object.assign(BALANCE, {
  levelRow, defDamage, buildCost, upgradeCost, formatCost, scaled,
  buildTime, upgradeTime, structureLimit, allowedMaxLevel, statAt,
  defensaAt, tropaAt, trampaAt, report: balanceReport,
});
