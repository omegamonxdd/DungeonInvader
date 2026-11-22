/* ==========================================================
 * FASE 9 — RECURSOS DE LA APP
 * ----------------------------------------------------------
 * Estado vivo de monedas y cristales. Hasta la Fase 8 la interfaz
 * mostraba el punto de partida del balance como "reflejo" y nunca
 * cobraba nada; aquí pasan a ser un estado real que se gasta al
 * confirmar una construcción o al iniciar una mejora.
 * Los valores iniciales siguen viniendo de balance/01 (modo pruebas).
 * ========================================================== */

import { BALANCE, levelRow } from '../balance/index.js';
import { pausedByWork } from './structureSpecs.js';

export class Resources {
  constructor() {
    this.reset();
  }

  reset() {
    const start = BALANCE.recursos.inicio;
    this.coins = start.coins;
    this.crystals = start.crystals;
  }

  get(kind) { return this[kind] || 0; }

  canAfford(cost) {
    return (cost?.coins || 0) <= this.coins && (cost?.crystals || 0) <= this.crystals;
  }

  // Cobro atómico: o se paga entero o no se toca nada.
  pay(cost) {
    if (!this.canAfford(cost)) return false;
    this.coins -= cost?.coins || 0;
    this.crystals -= cost?.crystals || 0;
    return true;
  }

  // Ingreso libre usado por la recolección de minas/talleres y el saqueo.
  add(kind, amount) {
    const n = Math.max(0, Math.round(amount || 0));
    if (!n || !Object.prototype.hasOwnProperty.call(this, kind)) return 0;
    this[kind] += n;
    return n;
  }

  // Capacidad del núcleo más la de los almacenes de un recurso (Fase 10).
  // El núcleo da la misma capacidad a monedas y cristales; cada almacén solo
  // suma al recurso que guarda. Pasar `kind` = null devuelve la suma de todos.
  capacity(coreLevel = 1, structures = [], kind = null) {
    const core = levelRow(BALANCE.nucleo.niveles, coreLevel)?.storage ?? 0;
    const vaults = structures.reduce((sum, def) => {
      // Un almacén en mejora sigue dando capacidad con su nivel actual.
      if (def.kind !== 'vault' || !def.placed || def.shelved || pausedByWork(def)) return sum;
      if (kind && def.resource !== kind) return sum;
      return sum + (levelRow(BALANCE.edificios.almacen.capacidad, def.level || 1) ?? 0);
    }, 0);
    return core + vaults;
  }
}
