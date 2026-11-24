/* ==========================================================
 * RECURSOS DE LA APP
 * ----------------------------------------------------------
 * Ya no existe un "dinero suelto": todos los recursos viven dentro de
 * estructuras que almacenan (el núcleo, como reserva inicial, y los
 * almacenes de cada recurso). Los gastos se reparten proporcionalmente
 * entre esos almacenes y la producción se deposita en ellos.
 *
 * Un guardado antiguo puede traer más dinero del que cabe (p. ej.
 * 5500/5000): se conserva como excedente, pero mientras esté por encima
 * del límite no se puede volver a añadir nada hasta que baje.
 * ========================================================== */

import { BALANCE, levelRow } from '../balance/index.js';
import { devResources } from '../config/devResources.js';
import { pausedByWork } from './structureSpecs.js';

const RESOURCES = ['coins', 'crystals'];
const isRes = kind => RESOURCES.includes(kind);
const safeNum = v => Math.max(0, Math.floor(Number(v) || 0));

export class Resources {
  constructor(deps = {}) {
    this.structures = deps.structures || [];
    this.getCoreLevel = deps.getCoreLevel || (() => 1);
    // Reserva usada solo antes de que exista la escena (tests / boot).
    this._buffer = { coins: 0, crystals: 0 };
  }

  get coins() { return this.get('coins'); }
  set coins(v) { this._set('coins', v); }
  get crystals() { return this.get('crystals'); }
  set crystals(v) { this._set('crystals', v); }

  /** Almacenes válidos para un recurso: núcleo + los vaults de ese tipo. */
  stores(kind) {
    const coreLevel = this.getCoreLevel();
    const coreCap = levelRow(BALANCE.nucleo.niveles, coreLevel)?.storage ?? 0;
    const out = [];
    for (const def of this.structures) {
      if (!def?.placed || def.shelved) continue;
      if (def.kind === 'core') {
        out.push({
          def,
          key: kind === 'coins' ? 'stored' : 'storedCrystals',
          cap: coreCap,
        });
      } else if (def.kind === 'vault' && (def.resource || 'coins') === kind) {
        out.push({ def, key: 'stored', cap: def.storage || 0 });
      }
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

  /** Capacidad total (núcleo + almacenes) de un recurso. */
  capacity(coreLevel = 1, structures = [], kind = null) {
    const core = levelRow(BALANCE.nucleo.niveles, coreLevel)?.storage ?? 0;
    const vaults = (structures || []).reduce((sum, def) => {
      if (def?.kind !== 'vault' || !def.placed || def.shelved || pausedByWork(def)) return sum;
      if (kind && (def.resource || 'coins') !== kind) return sum;
      return sum + (def.storage || 0);
    }, 0);
    if (!kind) return core * RESOURCES.length + vaults;
    return core + vaults;
  }

  /** Elimina el excedente cuando el total supera la capacidad de almacenes. */
  clampToCapacity(coreLevel = this.getCoreLevel(), structures = this.structures) {
    if (devResources() !== null || !this.structures.length) return false;
    let changed = false;
    for (const kind of RESOURCES) {
      const cap = this.capacity(coreLevel, structures, kind);
      const total = this.get(kind);
      if (total > cap) {
        this._withdraw(kind, total - cap);
        changed = true;
      }
    }
    return changed;
  }

  canAfford(cost) {
    if (devResources() !== null) return true;
    return (cost?.coins || 0) <= this.get('coins')
      && (cost?.crystals || 0) <= this.get('crystals');
  }

  /** Cobro atómico, repartido proporcionalmente entre los almacenes. */
  pay(cost) {
    if (!this.canAfford(cost)) return false;
    if (devResources() !== null) return true;
    for (const kind of RESOURCES) {
      const amount = safeNum(cost?.[kind]);
      if (amount) this._withdraw(kind, amount);
    }
    return true;
  }

  /** Ingreso con límite: devuelve lo que realmente se pudo guardar. */
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

  /** Fija un total (load de snapshots): permite excedente temporal. */
  _set(kind, value) {
    if (!isRes(kind) || devResources() !== null) return;
    const target = safeNum(value);
    if (!this.structures.length) {
      this._buffer[kind] = target;
      return;
    }
    const current = this.get(kind);
    if (target > current) this._deposit(kind, target - current, true);
    else if (target < current) this._withdraw(kind, current - target);
  }

  _deposit(kind, amount, ignoreCap) {
    const stores = this.stores(kind);
    if (!stores.length) return 0;
    let left = amount;
    // Primero se llena el hueco disponible de cada almacén (núcleo incluido).
    for (const s of stores) {
      if (left <= 0) break;
      const used = safeNum(s.def[s.key]);
      const space = Math.max(0, s.cap - used);
      if (space <= 0) continue;
      const put = Math.min(space, left);
      s.def[s.key] = used + put;
      left -= put;
    }
    // Un guardado antiguo puede traer excedente: se conserva en el primer
    // almacén, pero mientras siga por encima del límite no se podrá añadir
    // más (add() solo deposita donde haya hueco).
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
