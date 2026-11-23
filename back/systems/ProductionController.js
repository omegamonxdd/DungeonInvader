/* ==========================================================
 * FASE 10 — PRODUCCIÓN PASIVA Y ALMACENAMIENTO
 * ----------------------------------------------------------
 * Mina de cristal y taller de monedas: producen en tiempo real hasta su
 * capacidad y guardan el resultado en una burbuja. Un clic sobre el edificio
 * recoge lo que quepa en núcleo + almacenes, como en el legacy.
 * ========================================================== */

import { pausedByWork, specFor } from './structureSpecs.js';

export class ProductionController {
  constructor({ structures, resources, getCoreLevel, onChange = () => {} }) {
    this.structures = structures;
    this.resources = resources;
    this.getCoreLevel = getCoreLevel;
    this.onChange = onChange;
  }

  producers() {
    return this.structures.filter(def => {
      const spec = specFor(def);
      // Mina/taller en mejora no producen; el resto de estructuras sigue
      // activo con su nivel actual mientras se mejora.
      return spec?.producer && def.placed && !pausedByWork(def);
    });
  }

  step(dt) {
    for (const def of this.producers()) {
      const spec = specFor(def);
      const rate = spec.producer.rate(def.level || 1);
      const cap = spec.producer.cap(def.level || 1);
      def.pendingRes = spec.producer.resource;
      def.pending = Math.min(cap, (def.pending || 0) + rate * dt / 3600);
      def.view?.setBubble?.(def.pending >= 1 ? `+${Math.floor(def.pending)}` : '');
    }
  }

  collect(def) {
    const spec = specFor(def);
    if (!spec?.producer || !def.pending || def.pending < 1) return false;
    const res = spec.producer.resource;
    const total = Math.floor(def.pending);
    if (total <= 0) return false;
    let left = total;

    // Los recursos se guardan primero en los almacenes de ese mismo tipo;
    // solo el exceso pasa a los recursos del núcleo.
    for (const vault of this.structures) {
      if (left <= 0) break;
      if (vault.kind !== 'vault' || !vault.placed || vault.shelved || pausedByWork(vault)) continue;
      if ((vault.resource || 'coins') !== res) continue;
      const room = Math.max(0, (vault.storage || 0) - (vault.stored || 0));
      if (room <= 0) continue;
      const put = Math.min(room, left);
      vault.stored = (vault.stored || 0) + put;
      vault.view?.setBubble?.(vault.stored >= 1 ? `+${Math.floor(vault.stored)}` : '');
      left -= put;
    }
    if (left > 0) this.resources.add(res, left);

    def.pending = Math.max(0, def.pending - total);
    if (def.pending < 1) def.pending = 0;
    def.view?.setBubble?.(def.pending >= 1 ? `+${Math.floor(def.pending)}` : '');
    this.onChange();
    return true;
  }

  collectAll() {
    let n = 0;
    for (const def of this.producers()) if (this.collect(def)) n++;
    return n;
  }
}
