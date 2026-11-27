/* ==========================================================
 * FASE 10 — EJÉRCITO, INVOCACIÓN, CRÍA Y MUTACIÓN
 * ----------------------------------------------------------
 * Estado del ejército fuera de la invasión. Sustituye al ejército fijo de la
 * Fase 8 por un registro vivo alimentado por la grieta y la incubadora.
 * Los números (espacio, niveles, requisitos de laboratorio) vienen de
 * balance/; aquí solo se validan las reglas del legacy.
 * ========================================================== */

import {
  BALANCE, levelRow, tropaAt, troopDamageAt, troopMutateCost, troopMutateTime,
  ragUpgradeCost, ragUpgradeTime,
} from '../balance/index.js';
import { TROOP_ART } from '../enemies/troopArt.js';

const T = BALANCE.tropas;
const TROOP_IDS = Object.keys(T.tipos || {});

// Orden fijo para las listas de mutación: primero las tropas de la grieta y
// después las de la incubadora, y dentro de cada grupo por nivel de desbloqueo.
// No depende del orden de la tabla de balance ni del orden en que se añadieron
// las tropas al ejército, así que sigue valiendo si entran más tropas de grieta.
const SOURCE_RANK = { rift: 0, incubator: 1 };

export function sortTroopIds(ids) {
  return [...ids].sort((a, b) => {
    const da = T.tipos[a] || {};
    const db = T.tipos[b] || {};
    const bySource = (SOURCE_RANK[da.source] ?? 2) - (SOURCE_RANK[db.source] ?? 2);
    if (bySource) return bySource;
    const byUnlock = (da.minNivel || 1) - (db.minNivel || 1);
    return byUnlock || TROOP_IDS.indexOf(a) - TROOP_IDS.indexOf(b);
  });
}

export class Army {
  constructor(deps = {}) {
    this.deps = deps;
    this.onChange = deps.onChange || (() => {});
    this.onToast = deps.onToast || (() => {});
    // El escenario de prueba de la Fase 8 sigue disponible al arrancar.
    this.counts = { ...BALANCE.invasion.ejercitoPrueba };
    this.levels = {};
    for (const id of Object.keys(this.counts)) this.levels[id] = 1;
    this.ragWork = null;
    this.mutateWork = [];
  }

  resources() { return this.deps.resources || null; }

  capacity() {
    const lvl = this.deps.entranceLevel?.() || 1;
    return BALANCE.entrada.espacioTropas[lvl] || BALANCE.entrada.espacioTropas[1];
  }

  used() {
    let n = 0;
    for (const [id, count] of Object.entries(this.counts)) {
      n += (T.tipos[id]?.space || 0) * count;
    }
    return n;
  }

  free() { return Math.max(0, this.capacity() - this.used()); }

  levelOf(id) { return this.levels[id] || 1; }

  sourceLevel(source) {
    if (source === 'rift') return this.deps.riftLevel?.() || 0;
    if (source === 'incubator') return this.deps.incubatorLevel?.() || 0;
    return 1;
  }

  unlocked(typeId) {
    const def = T.tipos[typeId];
    if (!def || def.source === 'summoned') return false;
    return this.sourceLevel(def.source) >= (def.minNivel || 1);
  }

  availableTypes(source = null) {
    return Object.keys(T.tipos).filter(id => {
      const def = T.tipos[id];
      if (def.source === 'summoned') return false;
      if (source && def.source !== source) return false;
      return this.unlocked(id);
    });
  }

  // Ids mutables (nunca invocaciones como las arañas bebé) en el orden que
  // deben mostrar el laboratorio y el panel de mejoras.
  mutableTypes() {
    return sortTroopIds(TROOP_IDS.filter(id => T.tipos[id]?.source !== 'summoned'));
  }

  canAdd(id) {
    const def = T.tipos[id];
    if (!def) return 'Tropa desconocida';
    if (def.source === 'summoned') return 'No se puede invocar';
    if (!this.unlocked(id)) {
      const building = def.source === 'incubator' ? 'incubadora' : 'grieta';
      return `Necesitas ${building} nivel ${def.minNivel}`;
    }
    if ((def.space || 0) > this.free()) return 'Sin espacio en la entrada';
    return '';
  }

  add(id) {
    const why = this.canAdd(id);
    if (why) { this.onToast(why); return false; }
    this.counts[id] = (this.counts[id] || 0) + 1;
    if (!this.levels[id]) this.levels[id] = 1;
    this.onChange();
    return true;
  }

  remove(id) {
    if (id === 'rag') return false;
    if (!this.counts[id]) return false;
    this.counts[id]--;
    if (!this.counts[id]) delete this.counts[id];
    this.onChange();
    return true;
  }

  labLevel() { return this.deps.labLevel?.() || 0; }

  labSlots() { return Math.max(0, Math.floor(BALANCE.obras.limiteSlotsLaboratorio || 2)); }
  labBusy() { return this.mutateWork.length; }
  isLabBusy() { return this.labBusy() >= this.labSlots(); }
  labWorkFor(id) { return this.mutateWork.find(w => w.troopId === id) || null; }

  labRequired(id, to) {
    return levelRow(T.labRequerido[id], to) ?? 1;
  }

  mutateCost(id, to = this.levelOf(id) + 1) {
    return troopMutateCost(id, to);
  }

  mutateTime(id, to = this.levelOf(id) + 1) {
    return troopMutateTime(id, to);
  }

  canMutate(id) {
    const def = T.tipos[id];
    if (!def) return 'Tropa desconocida';
    if (!this.unlocked(id)) {
      const building = def.source === 'incubator' ? 'incubadora' : 'grieta';
      return `Necesitas ${building} nivel ${def.minNivel}`;
    }
    if (this.labWorkFor(id)) return 'Ya está mutando';
    if (this.labBusy() >= this.labSlots()) return `Laboratorio ocupado (${this.labBusy()}/${this.labSlots()})`;
    const to = this.levelOf(id) + 1;
    if (to > (def.maxNivel || 1)) return 'Nivel máximo';
    const need = this.labRequired(id, to);
    if (this.labLevel() < need) return `Necesitas laboratorio nivel ${need}`;
    const cost = this.mutateCost(id, to);
    if (this.resources() && !this.resources().canAfford(cost)) return 'Recursos insuficientes';
    return '';
  }

  mutate(id) {
    const why = this.canMutate(id);
    if (why) { this.onToast(why); return false; }
    const to = this.levelOf(id) + 1;
    const cost = this.mutateCost(id, to);
    if (this.resources() && !this.resources().pay(cost)) {
      this.onToast('Recursos insuficientes');
      return false;
    }
    const now = Date.now();
    this.mutateWork.push({ troopId: id, to, start: now, end: now + this.mutateTime(id, to) * 1000 });
    this.onToast(`Mutando a ${TROOP_NAME(id)} · nivel ${to}`);
    this.onChange();
    return true;
  }

  hasRag() { return (this.counts.rag || 0) > 0; }
  ragLevel() { return this.levelOf('rag'); }
  isRagUpgrading() { return Boolean(this.ragWork?.end); }
  ragMaxLevel() {
    const max = T.tipos.rag?.maxNivel || 1;
    const coreLevel = this.deps.coreLevel?.() || 1;
    return coreLevel < 4 ? Math.min(max, 4) : max; // TODO balance: cap por núcleo
  }

  ragUpgradeCost(to = this.ragLevel() + 1) { return ragUpgradeCost(to); }
  ragUpgradeTime(to = this.ragLevel() + 1) { return ragUpgradeTime(to); }

  canUpgradeRag() {
    if (!this.hasRag()) return 'No tienes a Rag';
    if (this.isRagUpgrading()) return 'Rag ya se está mejorando';
    const to = this.ragLevel() + 1;
    const max = T.tipos.rag?.maxNivel || 1;
    if (to > max) return 'Nivel máximo';
    const coreLevel = this.deps.coreLevel?.() || 1;
    if (to > 4 && coreLevel < 4) return 'Necesitas núcleo nivel 4'; // TODO balance: cap por núcleo
    const cost = this.ragUpgradeCost(to);
    if (this.resources() && !this.resources().canAfford(cost)) return 'Recursos insuficientes';
    return '';
  }

  upgradeRag() {
    const why = this.canUpgradeRag();
    if (why) { this.onToast(why); return false; }
    const to = this.ragLevel() + 1;
    const cost = this.ragUpgradeCost(to);
    if (this.resources() && !this.resources().pay(cost)) {
      this.onToast('Recursos insuficientes');
      return false;
    }
    const now = Date.now();
    this.ragWork = { to, start: now, end: now + this.ragUpgradeTime(to) * 1000 };
    this.onToast(`Rag mejorando a nivel ${to}`);
    this.onChange();
    return true;
  }

  step(now = Date.now()) {
    let changed = false;
    const work = this.ragWork;
    if (work && now >= (work.end || 0)) {
      this.levels.rag = Math.max(this.levelOf('rag'), work.to || 1);
      this.ragWork = null;
      this.onToast(`Rag alcanzó el nivel ${this.levels.rag}`);
      changed = true;
    }

    if (this.mutateWork.length) {
      const survivors = [];
      for (const entry of this.mutateWork) {
        if (now >= (entry.end || 0)) {
          this.levels[entry.troopId] = Math.max(this.levelOf(entry.troopId), entry.to || 1);
          this.onToast(`${TROOP_NAME(entry.troopId)} → nivel ${this.levels[entry.troopId]}`);
          changed = true;
        } else survivors.push(entry);
      }
      if (survivors.length !== this.mutateWork.length) this.mutateWork = survivors;
    }

    if (changed) this.onChange();
    return changed;
  }

  snapshot() {
    return {
      counts: { ...this.counts },
      levels: { ...this.levels },
      ragWork: this.ragWork ? { ...this.ragWork } : null,
      mutateWork: this.mutateWork.map(w => ({ ...w })),
    };
  }
}

export function TROOP_NAME(id) {
  return TROOP_ART[id]?.name || id;
}

export function troopStatsText(id, level) {
  const row = tropaAt(id, level);
  if (!row) return '';
  return `${row.hp} vida · ${troopDamageAt(id, level)} daño`;
}
