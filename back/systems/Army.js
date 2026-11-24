/* ==========================================================
 * FASE 10 — EJÉRCITO, INVOCACIÓN, CRÍA Y MUTACIÓN
 * ----------------------------------------------------------
 * Estado del ejército fuera de la invasión. Sustituye al ejército fijo de la
 * Fase 8 por un registro vivo alimentado por la grieta y la incubadora.
 * Los números (espacio, niveles, requisitos de laboratorio) vienen de
 * balance/; aquí solo se validan las reglas del legacy.
 * ========================================================== */

import { BALANCE, levelRow, tropaAt, troopDamageAt } from '../balance/index.js';
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
  }

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
    if (!this.counts[id]) return false;
    this.counts[id]--;
    if (!this.counts[id]) delete this.counts[id];
    this.onChange();
    return true;
  }

  labLevel() { return this.deps.labLevel?.() || 0; }

  labRequired(id, to) {
    return levelRow(T.labRequerido[id], to) ?? 1;
  }

  canMutate(id) {
    const def = T.tipos[id];
    if (!def) return 'Tropa desconocida';
    if (!this.unlocked(id)) {
      const building = def.source === 'incubator' ? 'incubadora' : 'grieta';
      return `Necesitas ${building} nivel ${def.minNivel}`;
    }
    // No hace falta tener una copia: en el legacy la mutación sube el nivel de
    // todo el tipo en cuanto se desbloquea, antes de invocar/criar la primera.
    const to = this.levelOf(id) + 1;
    if (to > (def.maxNivel || 1)) return 'Nivel máximo';
    const need = this.labRequired(id, to);
    if (this.labLevel() < need) return `Necesitas laboratorio nivel ${need}`;
    return '';
  }

  mutate(id) {
    const why = this.canMutate(id);
    if (why) { this.onToast(why); return false; }
    this.levels[id] = this.levelOf(id) + 1;
    this.onToast(`${TROOP_NAME(id)} → nivel ${this.levels[id]}`);
    this.onChange();
    return true;
  }

  snapshot() {
    return {
      counts: { ...this.counts },
      levels: { ...this.levels },
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
