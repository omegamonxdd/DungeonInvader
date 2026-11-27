/* ==========================================================
 * RECURSOS DE LA APP
 * ----------------------------------------------------------
 * Ya no existe un "dinero suelto": todos los recursos viven dentro de
 * estructuras que almacenan (el núcleo, como reserva inicial, y los
 * almacenes de cada recurso). Los gastos se reparten proporcionalmente
 * entre esos almacenes y la producción se deposita en ellos.
 *
 * Un guardado antiguo puede traer más dinero del que cabe (p. ej.
 * 5500/5000): se conserva como excedente y se muestra, pero es inutilizable.
 * `usable = min(total, capacidad)` es lo gastable; canAfford/pay usan usable.
 * ========================================================== */

import { BALANCE, levelRow } from '../balance/index.js';
import { devResources } from '../config/devResources.js';
import { pausedByWork } from './structureSpecs.js';

const RESOURCES = ['coins', 'crystals', 'rubies'];
const isRes = kind => RESOURCES.includes(kind);
const safeNum = v => Math.max(0, Math.floor(Number(v) || 0));

export class Resources {
  constructor(deps = {}) {
    this.structures = deps.structures || [];
    this.getCoreLevel = deps.getCoreLevel || (() => 1);
    // Reserva usada solo antes de que exista la escena (tests / boot).
    this._buffer = { coins: 0, crystals: 0, rubies: 0 };
  }

  get coins() { return this.get('coins'); }
  set coins(v) { this._set('coins', v); }
  get crystals() { return this.get('crystals'); }
  set crystals(v) { this._set('crystals', v); }
  get rubies() { return this.get('rubies'); }
  set rubies(v) { this._set('rubies', v); }

  vaultResource(def) {
    if (!def) return null;
    if (def.kind === 'core') return 'core';
    if (def.kind === 'vault-coins' || (def.kind === 'vault' && (def.resource || 'coins') === 'coins')) return 'coins';
    if (def.kind === 'vault-crystals' || (def.kind === 'vault' && def.resource === 'crystals')) return 'crystals';
    if (def.kind === 'vault-rubies' || (def.kind === 'vault' && def.resource === 'rubies')) return 'rubies';
    return null;
  }

  isVault(def, kind = null) {
    const res = this.vaultResource(def);
    if (res === 'core') return !kind || RESOURCES.includes(kind);
    return Boolean(res && (!kind || res === kind));
  }

  coreStoreKey(kind) {
    if (kind === 'crystals') return 'storedCrystals';
    if (kind === 'rubies') return 'storedRubies';
    return 'stored';
  }

  coreCap(def, kind) {
    if (kind === 'rubies') return Math.max(0, Number(def?.storageRubies) || 0);
    return Math.max(0, Number(def?.storage) || 0);
  }

  /** Almacenes válidos para un recurso: núcleo + almacenes dedicados. */
  stores(kind, structures = this.structures) {
    const out = [];
    for (const def of structures || []) {
      if ((!def?.placed && !def?.moving) || def?.shelved) continue;
      if (def.kind === 'core') {
        out.push({ def, key: this.coreStoreKey(kind), cap: this.coreCap(def, kind) });
        continue;
      }
      if (!this.isVault(def, kind) || pausedByWork(def)) continue;
      out.push({ def, key: 'stored', cap: Math.max(0, Number(def.storage) || 0) });
    }
    return out;
  }

  get(kind) {
    const dev = devResources();
    if (dev !== null) return dev;
    if (!isRes(kind)) return 0;
    if (!this.structures.length) return this._buffer[kind] || 0;
    return this.stores(kind).reduce((n, s) => n + safeNum(s.def[s.key]), 0);
  }

  /** Capacidad total: núcleo + almacenes dedicados para un recurso. */
  capacity(_coreLevel = 1, structures = this.structures, kind = null) {
    const sumKind = res => (structures || []).reduce((sum, def) => {
      if ((!def?.placed && !def?.moving) || def?.shelved) return sum;
      if (def.kind === 'core') return sum + this.coreCap(def, res);
      if (!this.isVault(def, res) || pausedByWork(def)) return sum;
      return sum + (Number(def.storage) || 0);
    }, 0);
    if (!kind) return RESOURCES.reduce((n, res) => n + sumKind(res), 0);
    return sumKind(kind);
  }

  /** Importe gastable: el excedente heredado se conserva pero no se puede gastar. */
  usable(kind, coreLevel = this.getCoreLevel(), structures = this.structures) {
    const dev = devResources();
    if (dev !== null) return dev;
    if (!isRes(kind)) return 0;
    return Math.min(this.get(kind), this.capacity(coreLevel, structures, kind));
  }

  /** Conserva el excedente de guardados antiguos; no lo recorta automáticamente. */
  clampToCapacity() {
    return false;
  }

  canAfford(cost) {
    if (devResources() !== null) return true;
    return RESOURCES.every(kind => (Number(cost?.[kind]) || 0) <= this.usable(kind));
  }

  /** Cobro atÃ³mico, repartido proporcionalmente entre los almacenes. */
  pay(cost) {
    if (!this.canAfford(cost)) return false;
    if (devResources() !== null) return true;
    for (const kind of RESOURCES) {
      const amount = safeNum(cost?.[kind]);
      if (amount) this._withdraw(kind, amount);
    }
    return true;
  }

  /** Ingreso con lÃ­mite: devuelve lo que realmente se pudo guardar. */
  add(kind, amount) {
    const n = safeNum(amount);
    if (!n || !isRes(kind)) return 0;
    if (devResources() !== null) return n;
    if (!this.structures.length) {
      this._buffer[kind] = (this._buffer[kind] || 0) + n;
      return n;
    }
    return this._deposit(kind, n, false);
  }

  /** Fija un total (load de snapshots): deposita solo en almacenes con hueco. */
  _set(kind, value) {
    if (!isRes(kind) || devResources() !== null) return;
    const target = safeNum(value);
    if (!this.structures.length) {
      this._buffer[kind] = target;
      return;
    }
    const current = this.get(kind);
    if (target > current) this._deposit(kind, target - current, false);
    else if (target < current) this._withdraw(kind, current - target);
  }

  _deposit(kind, amount, ignoreCap) {
    const stores = this.stores(kind);
    if (!stores.length) return 0;
    let left = amount;
    for (const s of stores) {
      if (left <= 0) break;
      const used = safeNum(s.def[s.key]);
      const space = Math.max(0, s.cap - used);
      if (space <= 0) continue;
      const put = Math.min(space, left);
      s.def[s.key] = used + put;
      left -= put;
    }
    if (ignoreCap && left > 0) {
      const s = stores[0];
      s.def[s.key] = safeNum(s.def[s.key]) + left;
      left = 0;
    }
    return amount - left;
  }

  _withdraw(kind, amount) {
    const stores = this.stores(kind);
    const total = stores.reduce((n, s) => n + safeNum(s.def[s.key]), 0);
    if (!total || amount <= 0) return 0;
    const take = Math.min(total, amount);
    let left = take;
    stores.forEach((s, i) => {
      const used = safeNum(s.def[s.key]);
      const share = i === stores.length - 1
        ? left
        : Math.min(used, Math.floor(take * (used / total)));
      const out = Math.min(used, share);
      s.def[s.key] = used - out;
      left -= out;
    });
    return take;
  }

  reset() {
    for (const kind of RESOURCES) {
      if (devResources() !== null) continue;
      if (!this.structures.length) {
        this._buffer[kind] = 0;
        continue;
      }
      const current = this.get(kind);
      if (current) this._withdraw(kind, current);
    }
  }
}
