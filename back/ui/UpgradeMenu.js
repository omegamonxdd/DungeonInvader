/* ==========================================================
 * MEJORAS PENDIENTES — port de js/ui/24-mejoras.js del legacy
 * ----------------------------------------------------------
 * Botón bajo los recursos + panel lateral derecho con dos pestañas:
 *   · Edificios: lo que se puede mejorar con el nivel de núcleo actual y lo
 *     que se puede construir porque aún queda cupo.
 *   · Tropas: mutaciones permitidas por el nivel del laboratorio.
 * Clic en una fila: centra/selecciona el edificio y abre su ventana, abre la
 * etiqueta del menú Construir o abre la mutación del laboratorio.
 *
 * La UI se consulta cada 300 ms (como en el legacy) y solo se redibuja cuando
 * cambian los datos. El botón y el panel viven en index.html; el CSS ya
 * existente en front/css/hud/04-mejoras.css se reutiliza sin cambios.
 * ========================================================== */

import {
  BALANCE, buildCost, buildTime, structureLimit, upgradeCost, upgradeTime,
} from '../balance/index.js';
import { effectiveLimit } from '../systems/WorkController.js';
import { TROOP_ART } from '../enemies/troopArt.js';
import { fmtDur } from '../systems/WorkController.js';
import { nameOf, specFor } from '../systems/structureSpecs.js';
import { SLOTS } from '../config/buildSlots.js';
import { drawBuildIcon } from './buildIcons.js';

const ORDER = ['defensas', 'militar', 'recursos', 'estandartes', 'trampas'];
const BUILDABLES = [...SLOTS].sort((a, b) => ORDER.indexOf(a.cat) - ORDER.indexOf(b.cat));
const RES_NAMES = { coins: 'monedas', crystals: 'cristales', rubies: 'rubíes' };
const byId = id => document.getElementById(id);

const CLOSE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>';
const CORE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/></svg>';
const DOOR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V9a7 7 0 0 1 14 0v12"/><path d="M3 21h18"/><path d="M9 21v-7a3 3 0 0 1 6 0v7"/></svg>';

const costText = cost => {
  const parts = ['coins', 'crystals', 'rubies'].filter(r => (cost?.[r] || 0) > 0);
  return parts.length ? parts.map(r => `${cost[r]} ${RES_NAMES[r]}`).join(' + ') : 'Gratis';
};
const levels = (a, b) => `Nivel ${a} <span class="stat-arrow">»</span> ${b}`;

export class UpgradeMenu {
  constructor(deps = {}) {
    this.deps = deps;
    this.ui = deps.ui || {};
    this.structures = deps.structures || [];
    this.works = deps.works || null;
    this.resources = deps.resources || null;
    this.army = deps.army || null;
    this.invasion = deps.invasion || null;
    this.editor = deps.editor || null;
    this.move = deps.move || null;
    this.select = deps.select || (() => {});
    this.focus = deps.focus || (() => {});

    this.els = {
      btn: byId('upg-btn'), badge: byId('upg-badge'), panel: byId('upg-panel'),
      sub: byId('upg-sub'), list: byId('upg-list'), close: byId('upg-close'),
      tabBuildings: byId('upg-tab-edificios'), tabTroops: byId('upg-tab-tropas'),
    };
    this.open = false;
    this.tab = 'edificios';
    this.key = '';

    this.bind();
    this.refresh(true);
    // El refresh periódico es el mismo contrato del legacy (24-mejoras.js:180).
    this.timer = setInterval(() => this.refresh(false), 300);
  }

  get coreLevel() { return this.works?.coreLevel() || 1; }

  bind() {
    this.els.btn?.addEventListener('click', () => this.setOpen(!this.open));
    this.els.close?.addEventListener('click', () => this.setOpen(false));
    for (const tab of [this.els.tabBuildings, this.els.tabTroops]) {
      tab?.addEventListener('click', () => this.setTab(tab.dataset.tab));
    }
    this.els.list?.addEventListener('click', e => this.onClick(e));
  }

  /* ---------- Datos ------------------------------------------------------ */

  countOf(limitKind) {
    return this.structures.filter(d => d.placed && (d.limitKind || d.kind) === limitKind).length;
  }

  data() {
    const core = this.coreLevel;
    const reductions = this.deps?.extra?.fusionReductions || {};
    const up = [];

    for (const def of this.structures) {
      if (!def.placed || def.work) continue;
      const lvl = def.level || 1;
      const cap = this.works?.capOf(def) ?? this.works?.maxLevelOf(def) ?? lvl;
      if (lvl >= cap) continue;
      const cost = upgradeCost(def.kind, lvl + 1);
      up.push({
        id: def.id,
        name: nameOf(def),
        slot: specFor(def)?.slot || (def.kind === 'core' ? 'core' : def.kind === 'entrance' ? 'entrance' : null),
        from: lvl, to: lvl + 1,
        cost: costText(cost),
        poor: !this.resources?.canAfford(cost),
        time: fmtDur(upgradeTime(def.kind, lvl + 1)),
      });
    }

    // Igual que el legacy: si hay varias estructuras iguales se numeran.
    const totals = {};
    const seen = {};
    for (const row of up) totals[row.name] = (totals[row.name] || 0) + 1;
    for (const row of up) {
      if (totals[row.name] > 1) {
        seen[row.name] = (seen[row.name] || 0) + 1;
        row.name = `${row.name} #${seen[row.name]}`;
      }
    }

    const build = [];
    BUILDABLES.forEach((slot, i) => {
      const limitKind = slot.limitKind || slot.kind;
      const n = this.countOf(limitKind);
      const lim = effectiveLimit(limitKind, core, reductions);
      if (n >= lim) return;
      const cost = buildCost(slot.costKey);
      build.push({
        i, name: slot.name, slot: slot.id, n, lim,
        cost: costText(cost),
        poor: !this.resources?.canAfford(cost),
        time: fmtDur(buildTime(slot.kind)),
      });
    });

    const lab = this.structures.find(d => d.kind === 'lab' && d.placed) || null;
    const troops = [];
    if (lab && this.army?.labLevel?.()) {
      for (const id of this.army.mutableTypes()) {
        const def = BALANCE.tropas.tipos[id];
        if (!this.army.unlocked(id)) continue;
        const from = this.army.levelOf(id);
        if (from >= (def.maxNivel || 1)) continue;
        const req = this.army.labRequired(id, from + 1);
        if (this.army.labLevel() < req) continue;
        const cost = this.army.mutateCost(id, from + 1);
        troops.push({
          id, name: TROOP_ART[id]?.name || id, from, to: from + 1, req,
          cost: costText(cost),
          poor: !this.resources?.canAfford(cost),
          time: fmtDur(this.army.mutateTime(id, from + 1)),
        });
      }
    }
    // `lab` es una def con su vista de Phaser: meterla en `d` haría fallar
    // el JSON.stringify() de refresh() por referencias circulares.
    return { up, build, troops, hasLab: Boolean(lab), labId: lab?.id || null };
  }

  /* ---------- Render ----------------------------------------------------- */

  iconHtml(slot, troopId) {
    if (troopId) {
      const art = TROOP_ART[troopId] || {};
      return `<span class="upg-ic" aria-hidden="true"><span class="troop-dot" ` +
        `style="--troop-hi:${art.hi || '#d9c7a0'};--troop-lo:${art.lo || '#7d7054'};background:${art.color || '#999'}"></span></span>`;
    }
    if (slot === 'core') return `<span class="upg-ic" aria-hidden="true">${CORE_SVG}</span>`;
    if (slot === 'entrance') return `<span class="upg-ic" aria-hidden="true">${DOOR_SVG}</span>`;
    return `<span class="upg-ic" aria-hidden="true"><canvas width="80" height="80" data-up-icon="${slot || ''}"></canvas></span>`;
  }

  row(attr, icon, name, sub) {
    return `<button class="upg-row" type="button" role="listitem" ${attr}>` +
      icon + `<span class="upg-txt"><span class="upg-name">${name}</span>` +
      `<span class="upg-sub">${sub}</span></span></button>`;
  }

  html(d) {
    if (this.tab === 'tropas') {
      if (!d.hasLab) return '<p class="army-empty">Construye un laboratorio de mutación para mutar tropas.</p>';
      if (!d.troops.length) return '<p class="army-empty">No hay mutaciones disponibles con el nivel actual del laboratorio.</p>';
      return '<div class="army-label">Mutaciones disponibles</div>' + d.troops.map(t =>
        this.row(`data-troop="${t.id}"`, this.iconHtml(null, t.id), t.name,
          `${levels(t.from, t.to)} · Lab. ${t.req} · <span class="${t.poor ? 'upg-poor' : ''}">${t.cost}</span> · ${t.time}`),
      ).join('');
    }

    if (!d.up.length && !d.build.length) {
      return `<p class="army-empty">No falta nada con el núcleo Nivel ${this.coreLevel}.</p>`;
    }
    let out = '';
    if (d.up.length) {
      out += '<div class="army-label">Mejorar</div>' + d.up.map(u =>
        this.row(`data-up="${u.id}"`, this.iconHtml(u.slot), u.name,
          `${levels(u.from, u.to)} · <span class="${u.poor ? 'upg-poor' : ''}">${u.cost}</span> · ${u.time}`),
      ).join('');
    }
    if (d.build.length) {
      out += '<div class="army-label">Construir</div>' + d.build.map(b =>
        this.row(`data-build="${b.i}"`, this.iconHtml(b.slot), b.name,
          `${b.n}/${b.lim} · <span class="${b.poor ? 'upg-poor' : ''}">${b.cost}</span> · ${b.time}`),
      ).join('');
    }
    return out;
  }

  drawIcons() {
    for (const canvas of this.els.list?.querySelectorAll('canvas[data-up-icon]') || []) {
      drawBuildIcon(canvas, canvas.dataset.upIcon);
    }
  }

  refresh(force = false) {
    if (!this.els.btn) return;
    if (this.open && (this.invasion?.active || this.editor?.active)) this.setOpen(false);
    if (this.invasion?.active || this.editor?.active) return;

    const d = this.data();
    const buildings = d.up.length + d.build.length;
    const troops = d.troops.length;
    this.els.badge.textContent = buildings + troops;
    this.els.badge.hidden = buildings + troops === 0;

    const key = JSON.stringify([d, this.tab, this.coreLevel]);
    if (!force && key === this.key) return;
    this.key = key;
    this.els.sub.textContent = `Núcleo Nivel ${this.coreLevel}`;
    if (this.els.tabBuildings) this.els.tabBuildings.textContent = `Edificios (${buildings})`;
    if (this.els.tabTroops) this.els.tabTroops.textContent = `Tropas (${troops})`;
    if (this.open) {
      this.els.list.innerHTML = this.html(d);
      this.drawIcons();
    }
  }

  setOpen(open) {
    this.open = Boolean(open) && !this.invasion?.active && !this.editor?.active;
    this.els.panel?.classList.toggle('open', this.open);
    document.body.classList.toggle('upg-open', this.open); // oculta el botón del editor
    this.els.btn?.classList.toggle('gold', this.open);
    this.els.btn?.setAttribute('aria-expanded', String(this.open));
    if (this.open) this.refresh(true);
    return this.open;
  }

  close() {
    return this.open ? this.setOpen(false) : false;
  }

  setTab(tab) {
    this.tab = tab === 'tropas' ? 'tropas' : 'edificios';
    for (const el of [this.els.tabBuildings, this.els.tabTroops]) {
      const on = el?.dataset.tab === this.tab;
      el?.classList.toggle('active', on);
      el?.setAttribute('aria-selected', String(on));
    }
    if (this.els.list) this.els.list.scrollTop = 0;
    this.refresh(true);
  }

  /* ---------- Acciones de las filas ------------------------------------- */

  busy() {
    return Boolean(
      this.move?.active || this.ui?.infoUI?.open || this.invasion?.active || this.editor?.active,
    );
  }

  goTo(def) {
    this.ui?.setBuildOpen?.(false);
    this.select(def);
    this.focus(def.id);
  }

  onClick(e) {
    const row = e.target.closest?.('.upg-row');
    if (!row || this.busy()) return;
    const d = this.data();

    if (row.dataset.up) {
      const def = this.structures.find(x => x.id === row.dataset.up);
      if (!def || def.work || def.level >= (this.works?.capOf(def) ?? def.level)) {
        this.refresh(true);
        return;
      }
      this.goTo(def);
      this.ui?.openPanel?.('upgrade');
    } else if (row.dataset.build) {
      const slot = BUILDABLES[+row.dataset.build];
      if (!slot) return;
      this.select(null);
      this.ui?.setBuildOpen?.(true);
      this.ui?.setBuildCategory?.(slot.cat);
      this.setOpen(false);
    } else if (row.dataset.troop) {
      const t = d.troops.find(x => x.id === row.dataset.troop);
      const lab = d.labId && this.structures.find(x => x.id === d.labId);
      if (!t || !lab) { this.refresh(true); return; }
      this.goTo(lab);
      // Como en el legacy: la fila de la tropa abre directamente su ventana
      // de mutación (estadísticas actuales » siguientes) antes de aplicarla.
      this.ui?.openTroopUpgrade?.(t.id);
      this.setOpen(false);
    }
  }
}
