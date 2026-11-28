/* ==========================================================
 * FASE 10 — PRODUCCIÓN PASIVA Y ALMACENAMIENTO
 * ----------------------------------------------------------
 * Mina de cristal y taller de monedas: producen en tiempo real y guardan el
 * resultado en una burbuja limitada por la estadística "Almacenamiento" del
 * propio edificio. Un clic recoge lo que quepa en núcleo + almacenes, como en
 * el legacy. Al cargar partida se abona lo generado mientras estuvo cerrada
 * (también hasta el tope de la burbuja).
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

  /**
   * Abona la producción de una partida cerrada. `savedAt` es la marca de tiempo
   * del snapshot; se llama una sola vez al cargar la partida del jugador.
   * Devuelve el número de productores a los que se sumó algo.
   */
  applyOffline(savedAt) {
    const t = Number(savedAt);
    if (!Number.isFinite(t) || t <= 0) return 0;
    const hours = (Date.now() - t) / 3600000;
    if (hours <= 0) return 0;
    let n = 0;
    for (const def of this.producers()) {
      const spec = specFor(def);
      const rate = spec?.producer?.rate(def.level || 1) || 0;
      if (rate <= 0) continue;
      const cap = spec.producer.cap(def.level || 1);
      def.pending = Math.min(cap, (def.pending || 0) + rate * hours);
      def.view?.setBubble?.(def.pending >= 1 ? `+${Math.floor(def.pending)}` : '');
      n++;
    }
    return n;
  }

  collect(def) {
    const spec = specFor(def);
    if (!spec?.producer || !def.pending || def.pending < 1) return false;
    const res = spec.producer.resource;
    const total = Math.floor(def.pending);
    if (total <= 0) return false;

    // Todo se guarda en núcleo/almacenes. Si no cabe, el resto se queda en
    // la burbuja del productor (hasta su propio límite).
    const stored = this.resources.add(res, total);
    def.pending = Math.max(0, def.pending - stored);
    if (def.pending < 1) def.pending = 0;
    def.view?.setBubble?.(def.pending >= 1 ? `+${Math.floor(def.pending)}` : '');
    // Si los almacenes están llenos no entra nada: no avisar de una recogida
    // que no ocurrió (lo pendiente se queda en la burbuja).
    if (stored > 0) this.onChange();
    return stored > 0;
  }

  collectAll() {
    let n = 0;
    for (const def of this.producers()) if (this.collect(def)) n++;
    return n;
  }
}
