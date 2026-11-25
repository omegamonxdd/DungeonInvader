/* ==========================================================
 * FASE 10 — FÁBRICA DE ESTRUCTURAS
 * ----------------------------------------------------------
 * Crea el registro lógico (def) y su vista Phaser para cualquier tipo del
 * catálogo. Ballesta, lanzadardos y catapulta usan su clase con sprite 2.5D
 * horneado; el resto usa StructureView. El factory es el único sitio que
 * convergen menú Mover, obras y editor.
 * ========================================================== */

import { Ballista } from '../towers/Ballista.js';
import { DartTurret } from '../towers/DartTurret.js';
import { Catapult } from '../towers/Catapult.js';
import { StructureView, needsGenericView } from '../entities/StructureView.js';
import { specFor, maxHpOf } from './structureSpecs.js';

export class StructureFactory {
  constructor(scene, structures) {
    this.scene = scene;
    this.structures = structures;
    this.seq = 1;
  }

  nextId(kind) {
    // El núcleo y la entrada tienen id fijo; el resto lleva contador.
    let id;
    do { id = `${kind}-${this.seq++}`; }
    while (this.structures.some(d => d.id === id));
    return id;
  }

  makeView(def) {
    if (def.kind === 'ballista') return new Ballista(this.scene, def.x, def.y, def.level || 1);
    if (def.kind === 'turret') return new DartTurret(this.scene, def.x, def.y, def.level || 1);
    if (def.kind === 'catapult') return new Catapult(this.scene, def.x, def.y, def.level || 1);
    if (needsGenericView(def.kind)) return new StructureView(this.scene, def);
    return null;
  }

  create(kind, x, y, options = {}) {
    const spec = specFor(kind);
    if (!spec) return null;

    const level = options.level || 1;
    const attack = spec.attack ? spec.attack(level) : null;
    const trap = spec.trap || null;
    const resource = options.resource
      || spec.resource
      || (kind === 'mine' ? 'crystals' : kind === 'workshop' ? 'coins' : null);

    const def = {
      id: options.id || this.nextId(kind),
      kind,
      name: spec.name,
      kindName: spec.name,
      level,
      x, y,
      w: spec.size,
      h: spec.size,
      size: spec.size,
      height: spec.height,
      category: spec.category,
      depth: x + y + spec.size,
      placed: options.placed !== false,
      movable: options.movable !== undefined ? options.movable : spec.movable,
      costKey: options.costKey || spec.slot || kind,
      limitKind: options.limitKind || spec.limitKind || kind,
      resource,
      range: spec.range ? spec.range(level) : (attack?.range ?? null),
      minRange: attack?.minRange || null,
      act: trap?.type === 'bomb' ? trap.activation(level) : null,
      hp: maxHpOf({ kind, level }),
      damage: attack?.damage ?? null,
      splash: attack?.splash ?? null,
      hiddenInInvasion: Boolean(spec.hiddenInInvasion),
      targetable: Boolean(spec.targetable),
      source: spec.source || null,
      storage: spec.storage ? spec.storage(level) : null,
      stored: spec.storage ? 0 : null,
      storedCrystals: kind === 'core' ? 0 : null,
      producer: spec.producer
        ? { resource: spec.producer.resource, rate: spec.producer.rate(level), cap: spec.producer.cap(level) }
        : null,
      guard: spec.guard || null,
      trap: trap || null,
      pending: 0,
      shelved: false,
      moving: false,
      view: null,
    };
    def.view = this.makeView(def);
    this.structures.push(def);
    return def;
  }

  destroy(def) {
    const i = this.structures.indexOf(def);
    if (i >= 0) this.structures.splice(i, 1);
    if (def.view) def.view.destroy();
  }
}
