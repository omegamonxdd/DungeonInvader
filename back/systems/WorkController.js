/* ==========================================================
 * FASE 9 — OBRAS: CONSTRUIR Y MEJORAR CON TIEMPO REAL
 * ----------------------------------------------------------
 * Port de js/buildings/26-obras.js a la app Phaser. Una obra vive en
 * `def.work = { kind: 'build' | 'upgrade', to, start, end }` con marcas
 * de Date.now(), como en el legacy: el reloj corre en tiempo real y
 * escala con BALANCE.obras.escalaTiempo (0.05 para probar).
 *
 *  · Solo puede haber `limiteConstructores` obras a la vez.
 *  · El coste de mejora se cobra al INICIAR; el de construcción al
 *    CONFIRMAR la colocación (lo llama MainScene desde MoveController).
 *  · El nivel no sube hasta que termina la obra; entonces se actualizan
 *    las estadísticas, el cupo de excavación (si es el núcleo) y la UI.
 *  · Un edificio en obras sigue activo con su nivel actual (no se mueve el
 *    movimiento, ni se apagan grietas, estandartes, trampas o almacenes).
 *    Solo se detienen las defensas y minas/talleres mientras se mejoran;
 *    ver `pausedByWork()` en `structureSpecs.js`.
 * ========================================================== */

import {
  BALANCE, buildCost, buildTime, structureLimit, upgradeCost, upgradeTime,
} from '../balance/index.js';
import { SLOTS } from '../config/buildSlots.js';
import { DIG_LIMITS } from '../config/interaction.js';
import { attackOf, nameOf, specFor } from './structureSpecs.js';

// Igual que CORE_MISSING_LABEL del legacy (26-obras.js): se usa tanto como
// motivo del botón como en el aviso al intentar mejorar el núcleo.
const CORE_MISSING_LABEL = 'Construye todos los edificios';

// 90 → "1:30", 3700 → "1 h 01 min", igual que fmtDur() del legacy.
export function fmtDur(sec) {
  const s = Math.max(0, Math.ceil(sec));
  if (s >= 3600) {
    return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')} min`;
  }
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class WorkController {
  constructor({ structures, terrain, resources, onToast = () => {}, onLevel = () => {}, onState = () => {} }) {
    this.structures = structures;
    this.terrain = terrain;
    this.resources = resources;
    this.onToast = onToast;
    this.onLevel = onLevel;
    this.onState = onState;
  }

  get limit() { return BALANCE.obras.limiteConstructores; }

  nameOf(def) { return nameOf(def); }

  coreDef() { return this.structures.find(d => d.kind === 'core'); }

  coreLevel() { return this.coreDef()?.level || 1; }

  maxLevelOf(def) {
    const spec = specFor(def);
    if (spec?.maxLevel) return spec.maxLevel;
    return BALANCE.estructuras.maxNivel[def.kind] || 1;
  }

  // Tope que permite el núcleo actual (o el tope propio si no hay fila).
  capOf(def) {
    const own = this.maxLevelOf(def);
    const cap = BALANCE.estructuras.topeNivelPorNucleo[this.coreLevel()]?.[def.kind];
    return cap === undefined ? own : Math.min(own, cap);
  }

  /* ---------- Edificios del núcleo (legacy missingBuildings/unlockingBuildings) ---- */

  // Cuenta los edificios COLOCADOS, incluidos los que están en obras: un
  // edificio en construcción (o en mejora) ya está colocado y cumple el
  // requisito de los edificios necesarios para mejorar el núcleo. Solo se
  // excluyen los guardados en el editor (`shelved`). Las ranuras con
  // `resource` (almacenes) se cuentan por separado.
  countPlaced(slot) {
    return this.structures.filter(d => d.placed && !d.shelved
      && d.kind === slot.kind
      && (!slot.resource || d.resource === slot.resource)).length;
  }

  // Edificios que faltan para poder mejorar el núcleo: todos los que tienen
  // cupo > 0 en el nivel ACTUAL deben estar colocados.
  missingBuildings() {
    const core = this.coreLevel();
    const out = [];
    for (const slot of SLOTS) {
      const lim = structureLimit(slot.limitKind, core);
      if (lim <= 0) continue;
      const have = this.countPlaced(slot);
      if (have < lim) out.push({ slot, name: slot.name, have, lim });
    }
    return out;
  }

  // Edificios que se desbloquean (o de los que se gana cupo) al subir el
  // núcleo al siguiente nivel. `first` = primera vez que se pueden construir.
  unlockingBuildings() {
    const core = this.coreLevel();
    if (core >= (BALANCE.nucleo.maxLevel || core)) return [];
    const out = [];
    for (const slot of SLOTS) {
      const cur = structureLimit(slot.limitKind, core);
      const next = structureLimit(slot.limitKind, core + 1);
      if (next > cur) out.push({ slot, name: slot.name, add: next - cur, first: cur === 0 });
    }
    return out.sort((a, b) => Number(b.first) - Number(a.first));
  }

  workOf(id) {
    const def = this.structures.find(d => d.id === id);
    return def?.work || null;
  }

  jobs() {
    const now = Date.now();
    return this.structures
      .filter(def => def.work)
      .map(def => {
        const work = def.work;
        const total = work.end - work.start;
        return {
          id: def.id,
          def,
          work,
          name: this.nameOf(def),
          left: Math.max(0, (work.end - now) / 1000),
          frac: total > 0 ? Math.min(1, Math.max(0, (now - work.start) / total)) : 1,
        };
      })
      .sort((a, b) => a.work.end - b.work.end);
  }

  activeCount() { return this.structures.reduce((n, d) => n + (d.work ? 1 : 0), 0); }

  free() { return this.limit - this.activeCount(); }

  /* ---------- Motivos de bloqueo ('' = se puede) ------------------------ */

  blockReason(def) {
    if (!def) return 'Estructura no encontrada';
    const lvl = def.level || 1;
    if (lvl >= this.maxLevelOf(def)) return 'Nivel máximo';
    if (lvl >= this.capOf(def)) return 'Nivel de núcleo muy bajo';
    if (def.work) return 'En obras';
    if (def.kind === 'core' && this.missingBuildings().length) return CORE_MISSING_LABEL;
    if (this.free() <= 0) return 'Sin constructores libres';
    if (!this.resources.canAfford(upgradeCost(def.kind, lvl + 1))) return 'Recursos insuficientes';
    return '';
  }

  // Al confirmar una colocación: hace falta un constructor y poder pagar.
  // El cobro y el aviso están aquí para que no se pueda colocar gratis.
  payBuild(def) {
    if (this.free() <= 0) {
      this.onToast(`Sin constructores libres (${this.limit}/${this.limit} ocupados)`);
      return false;
    }
    // Las ranuras de almacén/producción no comparten nombre con el `kind`:
    // el coste viaja en la def y hay que usarlo para no cobrar de gratis.
    const cost = buildCost(def.costKey || def.kind);
    const parts = [];
    if (cost?.coins) parts.push(`${cost.coins} monedas`);
    if (cost?.crystals) parts.push(`${cost.crystals} cristales`);
    if (!this.resources.pay(cost)) {
      this.onToast(`Recursos insuficientes: necesitas ${parts.join(' + ') || 'gratis'}`);
      return false;
    }
    this.onState();
    return true;
  }

  /* ---------- Iniciar obras --------------------------------------------- */

  setWork(def, kind, to, seconds) {
    const now = Date.now();
    def.work = {
      kind,
      to,
      start: now,
      end: now + Math.round(seconds * 1000),
    };
    def.view?.setWorking?.(true);
  }

  startBuild(id) {
    const def = this.structures.find(d => d.id === id);
    if (!def || def.work || this.free() <= 0) return false;
    const seconds = buildTime(def.kind);
    if (seconds > 0) {
      this.setWork(def, 'build', 1, seconds);
      this.onToast(`${this.nameOf(def)}: en construcción · ${fmtDur(seconds)}`);
    }
    this.onState();
    return true;
  }

  startUpgrade(id) {
    const def = this.structures.find(d => d.id === id);
    if (!def) return false;
    const why = this.blockReason(def);
    if (why) {
      // El legacy detalla qué edificios faltan al pulsar Mejorar el núcleo.
      this.onToast(why === CORE_MISSING_LABEL
        ? `${why}: faltan ${this.missingBuildings().map(m => m.name).join(', ')}`
        : why);
      return false;
    }

    const to = (def.level || 1) + 1;
    if (!this.resources.pay(upgradeCost(def.kind, to))) {
      this.onToast('Recursos insuficientes');
      return false;
    }

    const seconds = upgradeTime(def.kind, to);
    if (seconds <= 0) {
      this.finish(def, { kind: 'upgrade', to }); // tiempo 0 = mejora instantánea
    } else {
      this.setWork(def, 'upgrade', to, seconds);
      this.onToast(`${this.nameOf(def)}: mejorando a nivel ${to} · ${fmtDur(seconds)}`);
    }
    this.onState();
    return true;
  }

  /* ---------- Terminar obras -------------------------------------------- */

  finish(def, work) {
    def.work = null;
    def.view?.setWorking?.(false);

    if (work.kind === 'upgrade') {
      const to = Math.min(this.maxLevelOf(def), work.to);
      def.level = to;
      // Toda estructura recalcula sus estadísticas desde el catálogo al subir
      // de nivel (defensa, trampa, producción o guardias de estandarte).
      const spec = specFor(def);
      if (spec) {
        const atk = spec.attack ? spec.attack(to) : null;
        def.hp = spec.hp ? spec.hp(to) : def.hp;
        def.range = spec.range ? spec.range(to) : (atk?.range ?? def.range);
        def.minRange = atk?.minRange ?? def.minRange;
        def.damage = atk?.damage ?? def.damage;
        def.storage = spec.storage ? spec.storage(to) : def.storage;
        if (spec.producer) {
          def.producer = {
            resource: spec.producer.resource,
            rate: spec.producer.rate(to),
            cap: spec.producer.cap(to),
          };
        }
        if (spec.trap?.type === 'bomb') def.act = spec.trap.activation(to);
        def.view?.setLevel?.(to);
        def.view?.setResource?.(def.resource);
      }
      if (def.kind === 'core') {
        this.terrain.digLimit = DIG_LIMITS[to] ?? this.terrain.digLimit;
      }
      this.onToast(`${this.nameOf(def)}: nivel ${to}`);
    } else {
      this.onToast(`${this.nameOf(def)}: construido`);
    }

    this.onLevel(def);
    this.onState();
  }

  // Un solo punto de avance del reloj, llamado una vez por frame desde MainScene.
  step() {
    const now = Date.now();
    for (const def of this.structures) {
      const work = def.work;
      if (!work || now < work.end) continue;
      this.finish(def, work);
    }
  }
}
