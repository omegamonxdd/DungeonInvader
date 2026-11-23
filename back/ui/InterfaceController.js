/* ==========================================================
 * FASE 7 — PUENTE DOM/CSS
 * ----------------------------------------------------------
 * Conecta la interfaz (menú Construir, barra de acciones, HUD de
 * excavación y ventana de Información/Mejorar) con la escena de Phaser.
 * Los números salen de back/balance/; los estilos, de front/css/tokens/.
 * Fase 8: añade el botón de Invasión, el panel de oleadas, el cronómetro
 * y el letrero de victoria/derrota. La lógica sigue en la escena.
 * Fase 9: recursos reales, HUD de constructores, andamios y botón Mejorar
 * que cobra, inicia la obra y sube el nivel al terminar.
 * ========================================================== */

import {
  BALANCE, buildCost, levelRow, structureLimit, tropaAt, upgradeCost, upgradeTime,
} from '../balance/index.js';
import { TROOP_ART } from '../enemies/troopArt.js';
import { nameOf, pausedByWork, specFor } from '../systems/structureSpecs.js';
import { TROOP_NAME, troopStatsText } from '../systems/Army.js';
import { fmtDur } from '../systems/WorkController.js';
import { SLOTS, CATS } from '../config/buildSlots.js';
import { drawBuildIcon } from './buildIcons.js';
import { getService } from '../database/GameService.js';

// Las ranuras son un catálogo compartido con la lógica de obras (bloqueo del
// núcleo y desbloqueos). Se reexporta para no romper importaciones antiguas.
export { SLOTS };

const SVG = {
  coin: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-1.9-.4-2.5-1.2"/></svg>',
  crystal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l6 7-6 11-6-11z"/><path d="M6 10h12"/><path d="M12 3l-2 7 2 11 2-11z"/></svg>',
  bow: '<svg viewBox="0 0 24 24"><path d="M6 4c9 0 14 5 14 14"/><path d="M6 4l14 14"/><path d="M3 21L14 10"/></svg>',
  dart: '<svg viewBox="0 0 24 24"><path d="M4 20L16 8"/><path d="M16 8l1-5 4 4z"/></svg>',
  catapult: '<svg viewBox="0 0 24 24"><path d="M3 20h18"/><path d="M7 20l4-8 4 8"/><path d="M5 7l10 7"/></svg>',
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/></svg>',
  flask: '<svg viewBox="0 0 24 24"><path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/></svg>',
  egg: '<svg viewBox="0 0 24 24"><path d="M12 3c4 0 7 6 7 11a7 7 0 0 1-14 0c0-5 3-11 7-11z"/><path d="M8.5 14l2 2 2-2 2 2"/></svg>',
  pick: '<svg viewBox="0 0 24 24"><path d="M4 9c3-4 13-4 16 0"/><path d="M12 6.5V21"/></svg>',
  skull: '<svg viewBox="0 0 24 24"><path d="M12 3a8 8 0 0 0-8 8c0 2.6 1.2 4.4 3 5.6V20h10v-3.4c1.8-1.2 3-3 3-5.6a8 8 0 0 0-8-8z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/></svg>',
  slime: '<svg viewBox="0 0 24 24"><path d="M4 19c-1-5 2-12 8-12s9 7 8 12c-3 1.5-13 1.5-16 0z"/></svg>',
  bomb: '<svg viewBox="0 0 24 24"><circle cx="11" cy="14" r="7"/><path d="M15.5 8.5L18 6"/></svg>',
  spikes: '<svg viewBox="0 0 24 24"><path d="M3 20l3-9 3 9"/><path d="M9 20l3-13 3 13"/><path d="M15 20l3-9 3 9"/></svg>',
  impact: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8.5"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg>',
  door: '<svg viewBox="0 0 24 24"><path d="M5 21V9a7 7 0 0 1 14 0v12"/><path d="M3 21h18"/><path d="M9 21v-7a3 3 0 0 1 6 0v7"/></svg>',
};

const RES_NAMES = { coins: 'monedas', crystals: 'cristales' };
const RES_ICON = { coins: SVG.coin, crystals: SVG.crystal };

const byId = id => document.getElementById(id);
const costParts = cost => ['coins', 'crystals'].filter(r => (cost?.[r] || 0) > 0).map(r => ({ res: r, n: cost[r] }));
const costText = cost => {
  const parts = costParts(cost);
  return parts.length ? parts.map(p => `${p.n} ${RES_NAMES[p.res]}`).join(' + ') : 'Gratis';
};

export class InterfaceController {
  constructor(deps) {
    this.deps = deps; // { terrain, structures, move, select, build }
    this.terrain = deps.terrain;
    this.structures = deps.structures;
    this.move = deps.move;
    this.invasion = deps.invasion;
    this.works = deps.works;
    this.resources = deps.resources;
    this.army = deps.army || null;
    this.focus = deps.focus || (() => {});

    this.buildUI = { open: false, cat: 'recursos' };
    this.infoUI = { open: false, mode: 'info' };
    this.summonUI = { open: false, mode: 'summon' };
    this.selection = null;
    this.toastTimer = 0;
    this.lastTool = undefined;
    this.lastMove = false;
    this.slots = [];
    this.costTags = [];

    this.els = {
      buildBtn: byId('build-btn'), buildBar: byId('build-bar'), buildClose: byId('build-close'),
      buildTabs: [...document.querySelectorAll('#build-tabs .build-tab')], buildItems: byId('build-items'),
      toolDig: byId('tool-dig'), toolFill: byId('tool-fill'),
      digCounter: byId('dig-counter'), pathStatus: byId('path-status'), pathText: byId('path-text'),
      actionBar: byId('action-bar'), actionTitle: byId('action-title'),
      btnInfo: byId('btn-info'), btnUpgrade: byId('btn-upgrade'), btnMove: byId('btn-move'),
      btnRetire: byId('btn-retire'),
      btnSummon: byId('btn-summon'), btnBreed: byId('btn-breed'), btnMutate: byId('btn-mutate'),
      moveHint: byId('move-hint'), moveText: byId('move-text'), toast: byId('toast'),
      infoOverlay: byId('info-overlay'), infoPanel: byId('info-panel'), infoClose: byId('info-close'),
      infoBadge: byId('info-badge'), infoTitle: byId('info-title'), infoSub: byId('info-sub'),
      infoStats: byId('info-stats'), infoFooter: byId('info-footer'), infoUpgrade: byId('info-upgrade'),
      infoMissing: byId('info-missing'), infoMissingTitle: document.querySelector('#info-missing .army-label'),
      infoMissingList: byId('info-missing-list'),
      infoWork: byId('info-work'), iwCost: byId('iw-cost'), iwTime: byId('iw-time'), iwBuilders: byId('iw-builders'),
      resIconCoins: byId('res-icon-coins'), resIconCrystals: byId('res-icon-crystals'),
      resFillCoins: byId('res-fill-coins'), resFillCrystals: byId('res-fill-crystals'),
      resTextCoins: byId('res-text-coins'), resTextCrystals: byId('res-text-crystals'),
      buildersCount: byId('bs-count'), buildersList: byId('bs-list'),
      invasionBtn: byId('invasion-btn'), invasionBtnLabel: byId('invasion-btn-label'),
      invasionPanel: byId('invasion-panel'),
      invasionItems: byId('invasion-items'), invasionStatus: byId('invasion-status'),
      lootCoins: byId('loot-coins'), lootCrystals: byId('loot-crystals'),
      invasionTarget: byId('invasion-target'),
      timer: byId('invasion-timer'), timerLabel: document.querySelector('#invasion-timer .it-label'),
      timerTime: document.querySelector('#invasion-timer .it-time'),
      victory: byId('victory-banner'), victoryBack: byId('victory-back'),
      rivalOverlay: byId('rival-overlay'), rivalList: byId('rival-list'),
      rivalEmpty: byId('rival-empty'), rivalClose: byId('rival-close'),
      rivalLocal: byId('rival-local'), rivalNote: byId('rival-note'),
      summonPanel: byId('summon-panel'), summonItems: byId('summon-items'),
      summonTitle: byId('summon-title'), summonSpace: byId('summon-space'),
      summonClose: byId('summon-close'),
      selectBox: byId('select-box'),
      canvas: document.querySelector('#game canvas'),
    };

    this.els.resIconCoins.innerHTML = SVG.coin;
    this.els.resIconCrystals.innerHTML = SVG.crystal;
    this.bsKey = '';
    this.resKey = '';

    this.createSlots();
    this.bind();
    this.setBuildCategory('recursos');
    this.refreshBuildItems();
    this.refreshTerrainUI();
    this.syncResources();
    this.syncBuilders();
    this.invasionClockKey = '';
    this.lootKey = '';
    this.rivalPickerOpen = false;
    this.rivals = [];
    this.renderInvasionItems();
  }

  get coreLevel() { return this.works?.coreLevel() || 1; }

  /* ---------- Menú Construir -------------------------------------------- */

  createSlots() {
    const list = document.createDocumentFragment();
    for (const slot of SLOTS) {
      const item = document.createElement('div');
      item.setAttribute('role', 'listitem');
      item.dataset.cat = slot.cat;

      const btn = document.createElement('button');
      btn.id = `build-${slot.id}`;
      btn.className = 'build-slot build-item';
      btn.type = 'button';
      btn.setAttribute('aria-label', `Construir ${slot.name.toLowerCase()}`);
      btn.innerHTML = `<canvas id="${slot.id}-icon" width="80" height="80" aria-hidden="true"></canvas>` +
        `<span class="build-name">${slot.name}</span><span class="build-count" id="${slot.id}-count">0/0</span>`;

      const tag = document.createElement('span');
      tag.className = 'build-cost';
      btn.appendChild(tag);
      item.appendChild(btn);
      list.appendChild(item);

      drawBuildIcon(btn.querySelector('canvas'), slot.id);
      btn.addEventListener('click', () => this.onBuildClick(slot));

      const entry = { ...slot, btn, countEl: btn.querySelector('.build-count'), costEl: tag };
      this.slots.push(entry);
      this.costTags.push(entry);
    }
    this.els.buildItems.appendChild(list);
  }

  bind() {
    this.els.buildBtn.addEventListener('click', () => this.setBuildOpen(!this.buildUI.open));
    this.els.buildClose.addEventListener('click', () => this.setBuildOpen(false));

    for (const tab of this.els.buildTabs) {
      tab.addEventListener('click', () => this.setBuildCategory(tab.dataset.cat));
    }
    for (const btn of [this.els.toolDig, this.els.toolFill]) {
      btn.addEventListener('click', () => {
        const tool = this.terrain.tool === btn.dataset.tool ? null : btn.dataset.tool;
        this.terrain.setTool(tool);
        this.refreshTerrainUI();
      });
    }

    this.els.btnInfo.addEventListener('click', () => this.openPanel('info'));
    this.els.btnUpgrade.addEventListener('click', () => this.openPanel('upgrade'));
    this.els.btnMove.addEventListener('click', () => {
      const sel = this.selection;
      if (sel && sel.movable && !this.move.active) this.move.start(sel.id);
    });
    this.els.btnSummon.addEventListener('click', () => this.openSummon('summon'));
    this.els.btnBreed.addEventListener('click', () => this.openSummon('breed'));
    this.els.btnMutate.addEventListener('click', () => this.openSummon('mutate'));
    this.els.summonClose?.addEventListener('click', () => this.closeSummon());
    this.els.summonItems?.addEventListener('click', e => this.onSummonClick(e));
    this.els.summonItems?.addEventListener('contextmenu', e => this.onSummonContext(e));

    this.els.infoClose.addEventListener('click', () => this.closePanel());
    this.els.infoOverlay.addEventListener('pointerdown', e => {
      if (e.target === this.els.infoOverlay) this.closePanel();
    });
    // Las tarjetas de edificios del núcleo se deslizan en horizontal con la
    // rueda, igual que el recuadro del legacy.
    this.els.infoMissingList?.addEventListener('wheel', e => {
      const list = this.els.infoMissingList;
      if (list.scrollWidth <= list.clientWidth) return;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!d) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? list.clientWidth : 1;
      list.scrollLeft += d * unit;
    }, { passive: false });
    // Fase 9: confirmar cobra el coste, cierra la ventana y arranca la obra.
    this.els.infoUpgrade.addEventListener('click', () => {
      if (this.invasion?.active) return;
      if (!this.infoUI.open || this.infoUI.mode !== 'upgrade' || this.els.infoUpgrade.disabled) return;
      const sel = this.selection;
      if (!sel) return;
      const id = sel.id;
      this.closePanel();
      if (this.works.startUpgrade(id)) this.syncResources();
    });

    // Fila del HUD de constructores: ir a la estructura en obras.
    this.els.buildersList.addEventListener('click', e => {
      const row = e.target.closest('[data-job]');
      if (row) this.focus(row.dataset.job);
    });

    // Fase 8: invasión. El botón vuelve a la base cuando ya terminó.
    this.els.invasionBtn.addEventListener('click', () => this.toggleInvasion());
    this.els.victoryBack.addEventListener('click', () => this.invasion.end());
    this.els.rivalClose?.addEventListener('click', () => this.closeRivalPicker());
    this.els.rivalOverlay?.addEventListener('pointerdown', e => {
      if (e.target === this.els.rivalOverlay) this.closeRivalPicker();
    });
    this.els.rivalLocal?.addEventListener('click', () => this.startInvasion(null));

    // Los atajos (E, Z/X, 1–5 y los del editor) los resuelve ShortcutController
    // en MainScene; aquí solo quedan los clics de los botones.
  }

  toggleInvasion() {
    if (!this.invasion) return false;
    if (this.invasion.active) this.confirmEndInvasion();
    else {
      const editor = this.deps?.editor || this.editor;
      if (editor?.active) {
        this.showToast('Sal del editor antes de iniciar una invasión');
        return false;
      }
      if (this.move?.active) {
        this.showToast('Termina de mover el edificio primero');
        return false;
      }
      this.setBuildOpen(false);
      this.closePanel();
      this.closeSummon();
      const service = getService();
      if (service?.repository?.remoteEnabled && !service.auth?.isGuest) {
        this.openRivalPicker();
      } else {
        // Invitado o sin Supabase: se conserva la simulación sobre la base propia.
        this.invasion.start();
      }
    }
    return true;
  }

  /* ---------- Selección de rival ---------------------------------------- */

  async openRivalPicker() {
    const overlay = this.els.rivalOverlay;
    if (!overlay) return false;
    this.rivalPickerOpen = true;
    overlay.hidden = false;
    document.body.classList.add('rival-open');
    this.els.rivalEmpty.hidden = true;
    this.els.rivalList.replaceChildren();
    if (this.els.rivalNote) this.els.rivalNote.textContent = 'Cargando rivales…';

    const rivals = await getService()?.listOpponents?.() || [];
    if (!this.rivalPickerOpen) return true;
    this.rivals = rivals;
    if (this.els.rivalNote) {
      this.els.rivalNote.textContent = 'Se invadirá una copia de su base. Tu mazmorra volverá al terminar.';
    }
    this.renderRivals();
    return true;
  }

  renderRivals() {
    const list = this.els.rivalList;
    if (!list) return;
    const frag = document.createDocumentFragment();
    for (const rival of this.rivals) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rival-item';
      btn.setAttribute('role', 'listitem');
      btn.dataset.id = rival.id;
      const name = document.createElement('span');
      name.className = 'rival-name';
      name.textContent = rival.name || 'Jugador';
      btn.appendChild(name);
      const when = Date.parse(rival.updatedAt || '');
      if (Number.isFinite(when)) {
        const date = document.createElement('span');
        date.className = 'rival-date';
        date.textContent = new Date(when).toLocaleDateString();
        btn.appendChild(date);
      }
      btn.addEventListener('click', () => this.startInvasion(rival));
      frag.appendChild(btn);
    }
    list.replaceChildren(frag);
    if (this.els.rivalEmpty) this.els.rivalEmpty.hidden = this.rivals.length > 0;
  }

  closeRivalPicker() {
    this.rivalPickerOpen = false;
    if (this.els.rivalOverlay) this.els.rivalOverlay.hidden = true;
    document.body.classList.remove('rival-open');
  }

  async startInvasion(rival) {
    if (!this.invasion || this.invasion.active) return false;
    this.closeRivalPicker();
    const ok = await this.invasion.start({
      opponentId: rival?.id || null,
      opponentName: rival?.name || '',
    });
    // Si la base elegida no se pudo cargar, se ofrece otra sin salir del modal.
    if (!ok && rival && !this.invasion.active) this.openRivalPicker();
    return ok;
  }

  // El botón rojo de abajo a la izquierda (y el atajo Q) piden confirmación
  // antes de abortar la simulación. Se reutiliza el modal de ShortcutsUI.
  confirmEndInvasion() {
    const inv = this.invasion;
    if (!inv?.active) return false;
    const options = {
      title: '¿Seguro quieres terminar la invasion?',
      text: 'La simulación se cancelará y las tropas desplegadas volverán a tu ejército.',
      okLabel: 'Terminar invasión',
      cancelLabel: 'Seguir invadiendo',
      onOk: () => inv.end(),
      stillValid: () => inv.active,
    };
    const confirm = this.shortcutsUI || this.deps?.shortcutsUI;
    if (confirm?.openConfirm) {
      confirm.openConfirm(options);
      return true;
    }
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(options.text)) inv.end();
      return true;
    }
    inv.end();
    return true;
  }

  setBuildCategory(cat) {
    if (!CATS.includes(cat)) return;
    this.buildUI.cat = cat;
    for (const tab of this.els.buildTabs) {
      const on = tab.dataset.cat === cat;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', String(on));
    }
    for (const item of this.els.buildItems.children) item.hidden = item.dataset.cat !== cat;
  }

  setBuildOpen(open) {
    const editor = this.deps?.editor || this.editor;
    if (open && (this.invasion?.active || editor?.active)) return;
    this.buildUI.open = open;
    if (!open) this.terrain.setTool(null);
    if (open) this.deps.select(null);

    this.els.buildBar.classList.toggle('open', open);
    document.body.classList.toggle('build-open', open);
    this.els.buildBtn.classList.toggle('active', open);
    this.els.buildBtn.setAttribute('aria-expanded', String(open));
    if (open) this.refreshBuildItems();
    this.refreshTerrainUI();
  }

  limitOf(slot) { return structureLimit(slot.limitKind, this.coreLevel); }

  // Los límites cuentan también los edificios guardados por el editor, como
  // countStructures() del legacy. Los dos almacenes comparten `limitKind`
  // pero se cuentan por recurso.
  countOf(slot) {
    return this.structures.filter(d => {
      if (d.kind !== slot.kind) return false;
      if (slot.kind === 'vault' && d.resource !== slot.resource) return false;
      return true;
    }).length;
  }

  unlockLevel(slot, count) {
    const table = BALANCE.estructuras.limitePorNucleo[slot.limitKind] || {};
    for (const lvl of Object.keys(table).map(Number).sort((a, b) => a - b)) {
      if (lvl > this.coreLevel && table[lvl] > count) return lvl;
    }
    return null;
  }

  limitMessage(slot, count) {
    const lv = this.unlockLevel(slot, count);
    return lv ? `Obtenible en nivel ${lv} de núcleo` : `Límite de ${slot.name.toLowerCase()} alcanzado`;
  }

  canAfford(cost) {
    return (cost?.coins || 0) <= this.resources.coins && (cost?.crystals || 0) <= this.resources.crystals;
  }

  refreshBuildItems() {
    for (const slot of this.slots) {
      const lim = this.limitOf(slot);
      const n = this.countOf(slot);
      const full = n >= lim;
      const lv = full ? this.unlockLevel(slot, n) : null;
      slot.countEl.textContent = lim === 0 && lv ? `Núcleo ${lv}` : `${n}/${lim}`;
      slot.btn.classList.toggle('locked', full);
      slot.btn.setAttribute('aria-disabled', String(full));
      slot.btn.title = full ? this.limitMessage(slot, n) : '';

      const cost = buildCost(slot.costKey);
      slot.costEl.setAttribute('aria-label', `Coste: ${costText(cost)}`);
      const parts = costParts(cost);
      slot.costEl.innerHTML = parts.length
        ? parts.map(p => `<span class="cost-${p.res}">${p.n}${RES_ICON[p.res]}</span>`).join('')
        : 'Gratis';
    }
    this.refreshCostTags();
  }

  refreshCostTags() {
    for (const slot of this.costTags) {
      slot.costEl.classList.toggle('poor', !this.canAfford(buildCost(slot.costKey)));
    }
  }

  onBuildClick(slot) {
    if (this.move.active || this.infoUI.open || this.invasion?.active) return;
    const n = this.countOf(slot);
    if (n >= this.limitOf(slot)) {
      this.showToast(this.limitMessage(slot, n));
      return;
    }
    const cost = buildCost(slot.costKey);
    if (!this.canAfford(cost)) {
      this.showToast(`Recursos insuficientes: necesitas ${costText(cost)}`);
      return;
    }
    if (this.works && this.works.free() <= 0) {
      this.showToast(`Sin constructores libres (${this.works.limit}/${this.works.limit} ocupados)`);
      return;
    }
    if (this.deps.build(slot)) this.setBuildOpen(false);
  }

  /* ---------- HUD de excavación ----------------------------------------- */

  refreshTerrainUI() {
    const t = this.terrain;
    const full = t.digLimitReached();
    this.els.digCounter.textContent = `Casillas excavadas: ${t.digCount} / ${t.digLimit}` +
      (full ? ' · límite alcanzado' : '');
    this.els.digCounter.classList.toggle('full', full);
    for (const btn of [this.els.toolDig, this.els.toolFill]) {
      if (btn.dataset.tool !== 'dig') continue;
      btn.classList.toggle('locked', full);
      btn.setAttribute('aria-disabled', String(full));
      btn.title = full ? 'Límite alcanzado: rellena una casilla excavada para recuperar cupo' : '';
    }
    this.els.pathStatus.classList.toggle('blocked', !t.pathValid);
    this.els.pathText.textContent = t.pathValid ? 'Camino Válido' : 'Núcleo Bloqueado';
  }

  /* ---------- Barra de acciones ----------------------------------------- */

  setSelection(def) {
    this.selection = def || null;
    if (this.infoUI.open) this.closePanel();
    const sel = this.selection;
    const kind = sel?.kind;
    const editor = this.deps?.editor || this.editor;
    const editing = Boolean(editor?.active);
    this.els.actionTitle.textContent = sel ? `${nameOf(sel)} · Nivel ${sel.level || 1}` : '';
    // En el editor solo hay Información (Z), Mover (X) y Recoger (C), como en
    // el legacy: sin Mejorar ni acciones únicas (Invocar/Criar/Mutar).
    this.els.btnUpgrade.hidden = editing;
    this.els.btnSummon.hidden = editing || !(kind === 'rift');
    this.els.btnMutate.hidden = editing || !(kind === 'lab');
    this.els.btnBreed.hidden = editing || !(kind === 'incubator');
    this.els.btnMove.hidden = !(sel && sel.movable);
    this.els.btnRetire.hidden = !(editing && sel && sel.movable);
    this.syncScene();
  }

  /* ---------- Invocar / criar / mutar (Fase 10) -------------------------- */

  triggerSpecial() {
    const kind = this.selection?.kind;
    if (kind === 'rift') this.openSummon('summon');
    else if (kind === 'incubator') this.openSummon('breed');
    else if (kind === 'lab') this.openSummon('mutate');
    else this.showToast('Selecciona una grieta, incubadora o laboratorio');
  }

  openSummon(mode = 'summon') {
    if (!this.army) { this.showToast('Ejército no disponible'); return false; }
    const source = mode === 'breed' ? 'incubator' : 'rift';
    const sel = this.selection;
    if (sel && mode !== 'mutate' && sel.kind !== source) return false;
    // Grietas, incubadoras y laboratorios siguen funcionando mientras se
    // mejoran: usan su nivel actual y el cambio llega al terminar la obra.
    if (pausedByWork(sel)) {
      this.showToast(`${nameOf(sel)}: en construcción`);
      return false;
    }
    this.closePanel();
    this.setBuildOpen(false);
    this.summonUI.open = true;
    this.summonUI.mode = mode;
    this.els.summonTitle.textContent = mode === 'mutate' ? 'Laboratorio de mutación'
      : mode === 'breed' ? 'Incubadora de bestias' : 'Grieta de invocación';
    this.els.actionBar.classList.remove('open');
    this.renderSummon();
    this.els.summonPanel.classList.add('open');
    document.body.classList.add('summon-open');
    this.els.summonClose?.focus();
    return true;
  }

  closeSummon() {
    if (!this.summonUI.open) return false;
    this.summonUI.open = false;
    this.els.summonPanel.classList.remove('open');
    document.body.classList.remove('summon-open');
    this.syncScene();
    return true;
  }

  /* ---------- Recuadros de tropas: nivel e información (como el legacy) --- */

  // Recuadrito del nivel actual. Con el nivel máximo se añade `.max`, que
  // enciende el fuego azul del CSS (y aclara el número para que se lea).
  troopLevelBadge(level, max) {
    const badge = document.createElement('span');
    badge.className = 'troop-lvl' + (level >= max ? ' max' : '');
    badge.textContent = String(level);
    badge.title = level >= max ? `Nivel ${level} (máximo)` : `Nivel ${level}/${max}`;
    badge.setAttribute('aria-label', badge.title);
    return badge;
  }

  // Datos de la tropa para la ventana de información. Mismas barras que en
  // Información/Mejorar: el valor se compara con el del nivel máximo.
  troopStatsFor(id, lvl, max) {
    const def = BALANCE.tropas.tipos[id] || {};
    const row = tropaAt(id, lvl) || {};
    const top = tropaAt(id, max) || row;
    const pct = (v, t) => (Number.isFinite(t) && t > 0)
      ? Math.min(100, Math.max(0, Math.round((v / t) * 1000) / 10)) : undefined;
    const damage = r => r.damage ?? Math.round((r.dps || 0) * (def.interval || 1));
    const stats = [
      {
        icon: 'heart', label: 'Vida', value: `${row.hp || 0} / ${row.hp || 0}`,
        color: 'var(--ok)', pct: pct(row.hp || 0, top.hp),
      },
      {
        icon: 'impact', label: 'Daño', value: String(damage(row)),
        color: 'var(--red)', pct: pct(damage(row), damage(top)),
      },
      {
        icon: 'clock', label: 'Intervalo', value: `${def.interval ?? 1} s`, color: 'var(--txt)',
      },
      {
        icon: 'target', label: 'Rango', value: `${def.range ?? 1} casillas`, color: 'var(--crystal)',
      },
      {
        icon: 'door', label: 'Espacio', value: `${def.space ?? 1}`, color: 'var(--gold)',
      },
    ];
    if (def.flying) stats.push({ icon: 'egg', label: 'Vuelo', value: 'Puede volar', color: 'var(--crystal)' });
    if (row.babies !== undefined) {
      stats.push({
        icon: 'egg', label: 'Crías', value: String(row.babies),
        color: 'var(--gold)', pct: pct(row.babies, top.babies),
      });
    }
    return stats;
  }

  // Reutiliza la ventana de Información del legacy con modo 'troop': mismo
  // diseño y barras, sin pie de mejora (los niveles se suben en el laboratorio).
  openTroopInfo(id) {
    const def = BALANCE.tropas.tipos[id];
    if (!def) return;
    const lvl = this.army?.levelOf(id) || 1;
    const max = def.maxNivel || 1;
    this.infoUI.open = true;
    this.infoUI.mode = 'troop';
    this.infoUI.troop = id;
    document.body.classList.add('info-open');
    this.els.infoOverlay.classList.add('open');
    this.els.infoTitle.textContent = TROOP_NAME(id);
    this.els.infoSub.textContent = `Nivel ${lvl}/${max} · ${troopStatsText(id, lvl)}`;
    const art = TROOP_ART[id] || {};
    this.els.infoBadge.innerHTML =
      `<span class="troop-dot" style="--troop-hi:${art.hi || '#d9c7a0'};--troop-lo:${art.lo || '#7d7054'};background:${art.color || '#a964ff'}"></span>`;
    this.els.infoStats.innerHTML = this.troopStatsFor(id, lvl, max).map(s => this.renderStat(s)).join('');
    this.hideMissingBox();
    this.els.infoFooter.hidden = true;
    this.els.infoWork.hidden = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.els.infoStats.querySelectorAll('.stat-fill').forEach(f => {
        f.style.width = `${f.dataset.fill}%`;
      });
    }));
    this.els.infoClose.focus();
  }

  renderSummon() {
    if (!this.army || !this.els.summonItems) return;
    const mode = this.summonUI.mode;
    const frag = document.createDocumentFragment();

    if (mode === 'mutate') {
      this.els.summonSpace.textContent = `Laboratorio nivel ${this.army.labLevel()}`;
      const ids = Object.keys(this.army.counts).filter(id => BALANCE.tropas.tipos[id]);
      if (!ids.length) {
        const empty = document.createElement('div');
        empty.className = 'summon-empty';
        empty.textContent = 'No tienes tropas para mutar.';
        frag.appendChild(empty);
      }
      for (const id of ids) {
        const art = TROOP_ART[id] || {};
        const def = BALANCE.tropas.tipos[id];
        const level = this.army.levelOf(id);
        const max = def.maxNivel || 1;
        const to = level + 1;
        const why = this.army.canMutate(id);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'build-slot build-item troop-card';
        btn.dataset.mutate = id;
        btn.disabled = Boolean(why);
        btn.title = why || `Mutar a nivel ${to}`;
        btn.innerHTML =
          `<span class="troop-dot" style="background:${art.color || '#a964ff'}"></span>` +
          `<span class="build-name">${TROOP_NAME(id)}</span>` +
          `<span class="troop-cost">${troopStatsText(id, level)}</span>` +
          `<span class="build-count">${level >= max ? 'Máx.' : `Nv ${level}/${max}`}</span>`;
        const wrap = document.createElement('div');
        wrap.className = 'troop-wrap';
        wrap.setAttribute('role', 'listitem');
        if (!this.invasion?.active) {
          const info = document.createElement('button');
          info.type = 'button';
          info.className = 'troop-info-btn';
          info.dataset.info = id;
          info.textContent = 'i';
          info.setAttribute('aria-label', `Información de ${TROOP_NAME(id)}`);
          wrap.appendChild(info);
        }
        wrap.append(btn, this.troopLevelBadge(level, max));
        frag.appendChild(wrap);
      }
    } else {
      const source = mode === 'breed' ? 'incubator' : 'rift';
      this.els.summonSpace.textContent = `Espacio ${this.army.used()}/${this.army.capacity()}`;
      const ids = this.army.availableTypes(source);
      if (!ids.length) {
        const empty = document.createElement('div');
        empty.className = 'summon-empty';
        empty.textContent = mode === 'breed'
          ? 'Aún no hay criaturas disponibles para criar.'
          : 'Aún no hay tropas disponibles para invocar.';
        frag.appendChild(empty);
      }
      for (const id of ids) {
        const art = TROOP_ART[id] || {};
        const why = this.army.canAdd(id);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'build-slot build-item troop-card';
        btn.dataset.troop = id;
        btn.disabled = Boolean(why);
        btn.title = why || (mode === 'breed' ? 'Criar' : 'Invocar');
        btn.innerHTML =
          `<span class="troop-dot" style="background:${art.color || '#a964ff'}"></span>` +
          `<span class="build-name">${TROOP_NAME(id)}</span>` +
          `<span class="troop-cost">${troopStatsText(id, this.army.levelOf(id))}</span>` +
          `<span class="build-count">x${this.army.counts[id] || 0}</span>`;
        const wrap = document.createElement('div');
        wrap.className = 'troop-wrap';
        wrap.setAttribute('role', 'listitem');
        // Durante la invasión no se muestra la "i"; solo el nivel de la tropa.
        if (!this.invasion?.active) {
          const info = document.createElement('button');
          info.type = 'button';
          info.className = 'troop-info-btn';
          info.dataset.info = id;
          info.textContent = 'i';
          info.setAttribute('aria-label', `Información de ${TROOP_NAME(id)}`);
          wrap.appendChild(info);
        }
        const level = this.army.levelOf(id);
        const max = BALANCE.tropas.tipos[id]?.maxNivel || 1;
        wrap.append(btn, this.troopLevelBadge(level, max));
        frag.appendChild(wrap);
      }
    }
    this.els.summonItems.replaceChildren(frag);
  }

  onSummonClick(e) {
    if (this.invasion?.active) return;
    const info = e.target.closest?.('[data-info]');
    if (info) {
      this.openTroopInfo(info.dataset.info);
      return;
    }
    const mutate = e.target.closest?.('[data-mutate]');
    if (mutate) {
      if (this.army.mutate(mutate.dataset.mutate)) this.renderSummon();
      return;
    }
    const troop = e.target.closest?.('[data-troop]');
    if (!troop) return;
    const id = troop.dataset.troop;
    if (this.army.add(id)) {
      this.showToast(`${TROOP_NAME(id)} ${this.summonUI.mode === 'breed' ? 'criado' : 'invocado'}`);
      this.renderSummon();
      this.invasion?.refreshArmy?.();
    }
  }

  onSummonContext(e) {
    const troop = e.target.closest?.('[data-troop]');
    if (!troop) return;
    e.preventDefault();
    if (this.army.remove(troop.dataset.troop)) {
      this.showToast(`${TROOP_NAME(troop.dataset.troop)} retirado`);
      this.renderSummon();
    }
  }

  /* Llamada en cada frame: mantiene los botones de herramienta, el aviso del
   * modo Mover y el estado del cursor sin necesidad de eventos duplicados. */
  syncScene() {
    const tool = this.terrain.tool;
    if (tool !== this.lastTool) {
      this.lastTool = tool;
      for (const btn of [this.els.toolDig, this.els.toolFill]) {
        const on = btn.dataset.tool === tool;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
      }
      this.els.canvas?.classList.toggle('tool-active', Boolean(tool));
    }

    const active = this.move.active;
    this.els.actionBar.classList.toggle('open', Boolean(this.selection) && !active && !this.infoUI.open && !this.invasion?.active);
    this.els.moveHint.classList.toggle('open', active);
    this.els.canvas?.classList.toggle('moving', active);
    if (active) {
      const name = this.move.def ? nameOf(this.move.def) : 'estructura';
      this.els.moveText.textContent = `Colocando ${name.toLowerCase()} · clic para confirmar, clic derecho o Esc para cancelar`;
      this.els.moveHint.classList.toggle('invalid', !this.move.valid);
    }
    this.lastMove = active;
    this.syncWorks();
  }

  /* ---------- Recursos y constructores (Fase 9) -------------------------- */

  fmtNumber(n) { return new Intl.NumberFormat('es-ES').format(Math.round(n)); }

  syncResources() {
    if (!this.resources) return;
    const caps = {
      coins: this.resources.capacity(this.coreLevel, this.structures, 'coins'),
      crystals: this.resources.capacity(this.coreLevel, this.structures, 'crystals'),
    };
    const key = `${this.resources.coins}|${this.resources.crystals}|${caps.coins}|${caps.crystals}`;
    if (key === this.resKey) return;
    this.resKey = key;
    for (const [res, icon, fill, text] of [
      ['coins', this.els.resIconCoins, this.els.resFillCoins, this.els.resTextCoins],
      ['crystals', this.els.resIconCrystals, this.els.resFillCrystals, this.els.resTextCrystals],
    ]) {
      const value = this.resources.get(res);
      const cap = caps[res];
      fill.style.width = cap > 0 ? `${Math.min(100, (value / cap) * 100)}%` : '0%';
      text.textContent = `${this.fmtNumber(value)} / ${this.fmtNumber(cap)}`;
      text.closest('.res-row').setAttribute('aria-valuenow', String(value));
      text.closest('.res-row').setAttribute('aria-valuemax', String(cap));
      icon.title = res === 'coins' ? 'Monedas de Mazmorra' : 'Cristales de Mazmorra';
    }
  }

  syncBuilders(jobs = []) {
    if (!this.works) return;
    const count = `${this.works.free()}/${this.works.limit} libres`;
    if (this.els.buildersCount.textContent !== count) this.els.buildersCount.textContent = count;

    const key = jobs.map(j => `${j.id}|${j.work.kind}|${j.work.to}`).join('|');
    if (key !== this.bsKey) {
      this.bsKey = key;
      const frag = document.createDocumentFragment();
      for (const job of jobs) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'bs-row';
        row.dataset.job = job.id;
        row.setAttribute('aria-label', `Ir a ${job.name}`);
        row.innerHTML =
          `<span class="bs-line"><span class="bs-name">${job.name}` +
          `${job.work.kind === 'upgrade' ? ` › Nv ${job.work.to}` : ''}` +
          `</span><span class="bs-time"></span></span>` +
          '<span class="bs-bar"><span class="bs-fill"></span></span>';
        frag.appendChild(row);
      }
      this.els.buildersList.replaceChildren(frag);
    }
    const rows = this.els.buildersList.querySelectorAll('.bs-row');
    for (let i = 0; i < rows.length; i++) {
      const job = jobs[i];
      if (!job) continue;
      rows[i].querySelector('.bs-time').textContent = fmtDur(job.left);
      rows[i].querySelector('.bs-fill').style.width = `${(job.frac * 100).toFixed(1)}%`;
    }
  }

  syncWorks() {
    const jobs = this.works?.jobs() || [];
    this.syncResources();
    this.syncBuilders(jobs);
  }

  // Al subir de nivel (al terminar la obra) se refresca el título y, si la
  // ventana sigue abierta, se vuelve a dibujar con los nuevos valores.
  refreshSelection() {
    const sel = this.selection;
    if (!sel) return;
    this.els.actionTitle.textContent = `${nameOf(sel)} · Nivel ${sel.level || 1}`;
    if (this.infoUI.open) {
      const mode = this.infoUI.mode;
      if (mode === 'troop' && this.infoUI.troop) {
        this.openTroopInfo(this.infoUI.troop);
        return;
      }
      this.closePanel();
      this.openPanel(mode);
      this.els.infoClose.focus();
    }
  }

  /* ---------- Ventana de Información / Mejorar --------------------------- */

  /* ---------- Barras de progreso de las estadísticas ----------------------
   * Reproduce el detalle estético del legacy: toda estadística que cambia con
   * el nivel lleva una barra con el avance (valor actual / valor del nivel
   * máximo). Es solo información visual: no altera ninguna regla de juego.
   * Equivale a statTop() + pctOf() de 06-estructuras-ui.js.
   */
  pctStat(stat, lvl, maxLvl) {
    if (typeof stat.at !== 'function') return stat;
    const top = stat.at(maxLvl);
    if (!Number.isFinite(top) || top <= 0 || stat.at(1) === top) return stat;
    const cur = Number.isFinite(stat.at(lvl)) ? stat.at(lvl) : 0;
    return { ...stat, pct: Math.min(100, Math.max(0, Math.round((cur / top) * 1000) / 10)) };
  }

  statHp(at, lvl, maxLvl) {
    return this.pctStat({
      icon: 'heart', label: 'Vida', value: `${at(lvl)} / ${at(lvl)}`,
      color: 'var(--ok)', at,
    }, lvl, maxLvl);
  }

  // Estadísticas genéricas de Fase 10: cada categoría lee su fila de balance.
  // `at` es la función nivel → valor que alimenta la barra; las stats planas
  // (recarga, alcance fijo, intervalos…) no la llevan, igual que en el legacy.
  statsFor(sel, lvl, maxLvl) {
    const spec = specFor(sel);
    const stats = [];
    if (!spec) return stats;
    const kind = sel?.kind;
    const add = s => stats.push(this.pctStat(s, lvl, maxLvl));

    if (kind === 'core') {
      const hpAt = l => levelRow(BALANCE.nucleo.niveles, l)?.hp ?? 0;
      const storageAt = l => levelRow(BALANCE.nucleo.niveles, l)?.storage ?? 0;
      const digAt = l => BALANCE.nucleo.limiteExcavacion[l] || BALANCE.nucleo.limiteExcavacion[1];
      add(this.statHp(hpAt, lvl, maxLvl));
      add({ icon: 'coin', label: 'Capacidad de monedas', value: storageAt(lvl), color: 'var(--gold)', at: storageAt });
      add({ icon: 'crystal', label: 'Capacidad de cristales', value: storageAt(lvl), color: 'var(--crystal)', at: storageAt });
      add({ icon: 'pick', label: 'Límite de excavación', value: digAt(lvl), color: 'var(--stone-hi)', at: digAt });
      return stats;
    }
    if (kind === 'entrance') {
      const spaceAt = l => BALANCE.entrada.espacioTropas[l] || BALANCE.entrada.espacioTropas[1];
      add({ icon: 'door', label: 'Espacio de tropas', value: spaceAt(lvl), color: 'var(--gold)', at: spaceAt });
      return stats;
    }

    // Las defensas añaden Vida dentro de su bloque para respetar el orden
    // global de estadísticas; el resto de estructuras la ponen aquí.
    if (spec.hp && !spec.attack) add(this.statHp(spec.hp, lvl, maxLvl));

    const atk = spec.attack ? spec.attack(lvl) : null;
    if (atk) {
      const atkAt = l => spec.attack(l) || {};
      const damageAt = l => atkAt(l).damage || 0;
      // El DPS real vive en balance/; el cociente es solo un fallback para
      // defensas nuevas que aún no lo declaren.
      const dpsAt = l => {
        const a = atkAt(l);
        const raw = a.dps ?? ((a.damage || 0) / (a.cooldown || 1));
        return Math.round(raw * 100) / 100;
      };
      const rangeAt = l => atkAt(l).range ?? spec.range?.(l) ?? 0;
      const typeAt = l => {
        const a = atkAt(l);
        return a.damageType || (a.splash > 0 ? 'area' : 'single');
      };
      const typeLabel = type => (type === 'area' ? 'De área' : 'Único');

      // Orden global de las defensas: Vida · Daño por segundo · Recarga ·
      // Daño por impacto · Rango · Tipo de daño. Vale para ballesta,
      // lanzadardos y catapulta (y para cualquier defensa que se añada).
      if (spec.hp) add(this.statHp(spec.hp, lvl, maxLvl));
      add({ icon: 'impact', label: 'Daño por segundo', value: dpsAt(lvl), color: 'var(--gold)', at: dpsAt });
      add({ icon: 'clock', label: 'Recarga', value: `${atk.cooldown} s`, color: 'var(--crystal)' });
      add({ icon: 'dart', label: 'Daño por impacto', value: damageAt(lvl), color: 'var(--gold)', at: damageAt });
      // Una sola stat de Rango: la catapulta muestra 4-10 casillas (zona muerta
      // + alcance); las defensas sin zona muerta muestran solo su alcance.
      add({
        icon: 'target', label: 'Rango',
        value: atk.minRange ? `${atk.minRange}-${atk.range} casillas` : `${atk.range} casillas`,
        color: 'var(--crystal)', at: rangeAt,
      });
      add({
        icon: typeAt(lvl) === 'area' ? 'bomb' : 'dart',
        label: 'Tipo de daño',
        value: typeLabel(typeAt(lvl)),
        color: 'var(--crystal)',
      });
    }

    const trap = spec.trap;
    if (trap) {
      if (trap.type === 'bomb') {
        add({ icon: 'target', label: 'Activación', value: `${trap.activation(lvl)} casillas`, color: 'var(--crystal)', at: trap.activation });
        add({ icon: 'impact', label: 'Radio de daño', value: `${trap.range(lvl)} casillas`, color: 'var(--gold)', at: trap.range });
        add({ icon: 'dart', label: 'Daño', value: trap.damage(lvl), color: 'var(--gold)', at: trap.damage });
      } else if (trap.type === 'electro') {
        add({ icon: 'target', label: 'Rango', value: `${trap.range(lvl)} casillas`, color: 'var(--crystal)', at: trap.range });
        add({ icon: 'dart', label: 'Daño', value: trap.damage(lvl), color: 'var(--gold)', at: trap.damage });
        add({ icon: 'skull', label: 'Objetivos', value: trap.targets(lvl), color: 'var(--gold)', at: trap.targets });
        add({ icon: 'impact', label: 'Cadena', value: `${trap.chain(lvl)} casillas`, color: 'var(--crystal)', at: trap.chain });
      } else if (trap.type === 'rocktrap') {
        add({ icon: 'dart', label: 'Daño al entrar', value: trap.damage(lvl), color: 'var(--gold)', at: trap.damage });
        add({ icon: 'clock', label: 'Golpes encima', value: `${trap.interval} s`, color: 'var(--crystal)' });
        add({ icon: 'clock', label: 'Reentrada', value: `${trap.reentry} s`, color: 'var(--crystal)' });
      }
    }

    if (spec.guard) {
      add({ icon: 'skull', label: 'Defensores', value: spec.guard.count(lvl), color: 'var(--gold)', at: spec.guard.count });
      add({ icon: 'skull', label: 'Nivel defensor', value: spec.guard.level(lvl), color: 'var(--crystal)', at: spec.guard.level });
      add({ icon: 'target', label: 'Radio de guardia', value: `${spec.guard.range} casillas`, color: 'var(--crystal)' });
    }

    if (spec.storage) {
      add({ icon: 'coin', label: 'Capacidad extra', value: spec.storage(lvl), color: 'var(--gold)', at: spec.storage });
    }
    if (spec.producer) {
      add({ icon: spec.producer.resource === 'coins' ? 'coin' : 'crystal', label: 'Producción por hora', value: spec.producer.rate(lvl), color: 'var(--gold)', at: spec.producer.rate });
      add({ icon: 'coin', label: 'Almacenamiento', value: spec.producer.cap(lvl), color: 'var(--crystal)', at: spec.producer.cap });
    }
    if (spec.source && !spec.attack && !spec.producer && !spec.guard && !spec.storage && !spec.trap) {
      const types = Object.entries(BALANCE.tropas.tipos)
        .filter(([, t]) => t.source === spec.source)
        .map(([, t]) => t.maxNivel || 1);
      const top = types.length ? Math.max(...types) : 0;
      add({ icon: 'egg', label: 'Tropas', value: top ? `nivel ${top}` : '—', color: 'var(--gold)', at: () => top });
    }
    if (spec.range && !atk && !spec.guard && !trap) {
      add({ icon: 'target', label: 'Rango', value: `${spec.range(lvl)} casillas`, color: 'var(--crystal)', at: spec.range });
    }
    return stats;
  }

  // `next` es la misma estadística calculada para el nivel siguiente: dibuja
  // el tramo claro y parpadeante que se ganará al mejorar (renderUpgradeStat
  // del legacy). En Información no hay `next` y solo se ve el avance actual.
  renderStat(s, next) {
    const icon = SVG[s.icon] || '';
    const changes = Boolean(next) && String(next.value) !== String(s.value);
    const value = changes ? `${s.value} <span class="stat-arrow">»</span> ${next.value}` : s.value;
    let bar = '';
    if (s.pct !== undefined) {
      const gain = next?.pct === undefined ? 0
        : Math.max(0, Math.round((next.pct - s.pct) * 10) / 10);
      bar = '<div class="stat-bar" role="progressbar" ' +
        `aria-label="${next ? 'Progreso de mejora' : 'Avance de nivel'}: ${s.label}" ` +
        `aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.pct}">` +
        `<div class="stat-fill" data-fill="${s.pct}" style="--c:${s.color};--c2:var(--gold-hi)"></div>` +
        (gain > 0 ? `<div class="stat-next" style="left:${s.pct}%;width:${gain}%"></div>` : '') +
        '</div>';
    }
    return `<div class="stat"><div class="stat-top"><span class="stat-icon" style="--c:${s.color}">${icon}</span>` +
      `<span class="stat-label">${s.label}</span><span class="stat-value">${value}</span></div>${bar}</div>`;
  }

  /* ---------- Recuadro de edificios de la mejora del núcleo ----------------
   * Espejo de `showInfoBox()` del legacy: una tarjeta por edificio con su
   * icono del menú Construir. Con faltan edificios se muestran los colocados
   * requeridos; si no, los que se desbloquean con el siguiente nivel.
   */
  hideMissingBox() {
    if (!this.els.infoMissing) return;
    this.els.infoMissing.hidden = true;
    this.els.infoMissingList.replaceChildren();
  }

  showInfoBox(title, cards) {
    if (!this.els.infoMissing) return;
    this.els.infoMissingTitle.textContent = title;
    const frag = document.createDocumentFragment();
    for (const c of cards) {
      const card = document.createElement('div');
      card.className = 'miss-card' + (c.unlock ? ' unlock' : '') + (c.isNew ? ' is-new' : '');
      card.setAttribute('role', 'listitem');
      card.title = c.title;
      if (c.isNew) {
        const tag = document.createElement('span');
        tag.className = 'miss-new';
        tag.textContent = 'Nuevo';
        card.appendChild(tag);
      }
      const canvas = document.createElement('canvas');
      canvas.className = 'miss-ic';
      canvas.width = 80;
      canvas.height = 80;
      canvas.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'miss-name';
      name.textContent = c.name;
      const count = document.createElement('span');
      count.className = 'miss-count';
      count.textContent = c.count;
      card.append(canvas, name, count);
      frag.appendChild(card);
      drawBuildIcon(canvas, c.slot.id);
    }
    this.els.infoMissingList.replaceChildren(frag);
    this.els.infoMissingList.scrollLeft = 0;
    this.els.infoMissing.hidden = false;
  }

  showMissingBox(missing) {
    this.showInfoBox('Construye antes de mejorar', missing.map(m => ({
      slot: m.slot, name: m.name, count: `${m.have}/${m.lim}`,
      title: `${m.name}: ${m.have}/${m.lim} colocados`,
    })));
  }

  showUnlockBox(unlocks) {
    this.showInfoBox('Se desbloquea al mejorar', unlocks.map(u => ({
      slot: u.slot, name: u.name, count: `x${u.add}`, isNew: u.first, unlock: true,
      title: u.first ? `${u.name}: nuevo edificio` : `${u.name}: ${u.add} más`,
    })));
  }

  openPanel(mode = 'info') {
    const sel = this.selection;
    if (!sel) return;
    const kind = sel.kind;
    const lvl = sel.level || 1;
    const max = Math.max(this.works?.maxLevelOf(sel) || 1, lvl);
    const upgrading = mode === 'upgrade';

    this.infoUI.open = true;
    this.infoUI.mode = mode;
    document.body.classList.add('info-open');
    this.els.infoOverlay.classList.add('open');
    const spec = specFor(sel);
    this.els.infoTitle.textContent = `${nameOf(sel)} · Nivel ${lvl}`;
    this.els.infoSub.textContent = upgrading
      ? `Mejora al nivel ${Math.min(lvl + 1, max)}`
      : (spec?.attack ? `Defensa · huella ${sel.size}×${sel.size} · mira a la entrada`
        : spec?.category ? `${spec.category} · huella ${sel.size}×${sel.size}` : 'Estructura de la mazmorra');
    const badge = kind === 'core' ? 'target' : kind === 'entrance' ? 'door'
      : spec?.attack ? 'bow' : spec?.producer ? 'pick' : spec?.guard ? 'skull'
        : spec?.trap ? 'impact' : spec?.storage ? 'coin' : spec?.source ? 'egg' : 'flask';
    this.els.infoBadge.innerHTML = SVG[badge] || '';

    const stats = this.statsFor(sel, lvl, max);
    const nextStats = upgrading && lvl < max ? this.statsFor(sel, lvl + 1, max) : [];
    this.els.infoStats.innerHTML = stats.map((s, i) => this.renderStat(s, nextStats[i])).join('');

    // Como en el legacy, la ventana de la entrada permite retirar tropas
    // con un botón "−" por tipo (sin reembolso, solo fuera de invasión).
    if (kind === 'entrance' && !upgrading && this.army && !this.invasion?.active) {
      const troops = Object.entries(this.army.counts).filter(([, n]) => n > 0);
      if (troops.length) {
        this.els.infoStats.insertAdjacentHTML('beforeend',
          '<div class="info-troops" role="group" aria-label="Retirar tropas">' +
          troops.map(([id, n]) =>
            `<button class="action-btn info-troop-remove" type="button" data-remove-troop="${id}" ` +
            `title="Retirar ${TROOP_NAME(id)} (sin reembolso)">− ${TROOP_NAME(id)} (${n})</button>`,
          ).join('') + '</div>');
        this.els.infoStats.querySelectorAll('[data-remove-troop]').forEach(btn => {
          btn.addEventListener('click', () => {
            if (this.army.remove(btn.dataset.removeTroop)) {
              this.invasion?.refreshArmy?.();
              this.openPanel('info');
            }
          });
        });
      }
    }

    // Mejora del núcleo: si faltan edificios se enumeran (y el botón queda
    // bloqueado por WorkController); si no, se muestra lo que se desbloquea.
    this.hideMissingBox();
    const levelBlocked = lvl >= (this.works?.capOf(sel) ?? max);
    if (upgrading && kind === 'core' && !levelBlocked) {
      const missing = this.works?.missingBuildings() || [];
      if (missing.length) this.showMissingBox(missing);
      else this.showUnlockBox(this.works?.unlockingBuildings() || []);
    }

    this.els.infoFooter.hidden = !upgrading;
    this.els.infoWork.hidden = !upgrading;
    if (upgrading) {
      const cost = upgradeCost(kind, lvl + 1);
      const parts = costParts(cost);
      this.els.iwCost.innerHTML = parts.length
        ? parts.map(p => `<span class="cost-${p.res}">${p.n}${RES_ICON[p.res]}</span>`).join('')
        : 'Gratis';
      this.els.iwCost.classList.toggle('poor', !this.resources.canAfford(cost));
      this.els.iwTime.textContent = fmtDur(upgradeTime(kind, lvl + 1));
      this.els.iwBuilders.textContent = this.works
        ? `${this.works.free()}/${this.works.limit}` : '0/0';

      const reason = this.works?.blockReason(sel) || '';
      this.els.infoUpgrade.disabled = Boolean(reason);
      this.els.infoUpgrade.classList.toggle('locked', Boolean(reason));
      this.els.infoUpgrade.querySelector('span').textContent = reason || 'Mejorar';
      this.els.infoUpgrade.title = reason || `Mejorar a nivel ${lvl + 1}`;
    }

    // Las barras parten de 0 y se llenan con la transición de front/css,
    // igual que en el legacy (dos frames para que el navegador interpole).
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.els.infoStats.querySelectorAll('.stat-fill').forEach(f => {
        f.style.width = `${f.dataset.fill}%`;
      });
    }));
    this.els.infoClose.focus();
  }

  closePanel() {
    if (!this.infoUI.open) return false;
    this.infoUI.open = false;
    this.hideMissingBox();
    this.els.infoOverlay.classList.remove('open');
    document.body.classList.remove('info-open');
    return true;
  }

  /* ---------- Invasión (Fase 8) ----------------------------------------- */

  renderInvasionItems() {
    const inv = this.invasion;
    const key = `${inv.active}|${inv.over}|` + Object.entries(inv.army)
      .map(([id, total]) => `${id}:${total - (inv.deployed[id] || 0)}:${this.army?.levelOf(id) || 1}`).join(',');
    if (key === this.invItemsKey) return;
    this.invItemsKey = key;

    const frag = document.createDocumentFragment();
    for (const [id, total] of Object.entries(inv.army)) {
      const art = TROOP_ART[id] || TROOP_ART.esqueleto;
      const left = Math.max(0, total - (inv.deployed[id] || 0));
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'inv-troop';
      btn.dataset.id = id;
      btn.setAttribute('role', 'listitem');
      // Tarjeta compacta: icono + disponibles. El nombre se pone en title/aria
      // para no estirar el botón a lo ancho de la barra de invasión.
      const label = `${art.name} · ${left}/${total} · Nivel ${this.army?.levelOf(id) || 1}`;
      btn.title = label;
      btn.setAttribute('aria-label', `Desplegar ${label}`);
      btn.innerHTML =
        `<span class="troop-dot" style="--troop-hi:${art.hi};--troop-lo:${art.lo};background:${art.color}"></span>` +
        `<span class="inv-left">${left}/${total}</span>`;
      // Durante la invasión no hay botón "i", pero sí el nivel de la tropa.
      const level = this.army?.levelOf(id) || 1;
      const max = BALANCE.tropas.tipos[id]?.maxNivel || 1;
      btn.appendChild(this.troopLevelBadge(level, max));
      btn.disabled = left === 0 || inv.over;
      btn.addEventListener('click', () => inv.deploy(id));
      frag.appendChild(btn);
    }
    this.els.invasionItems.replaceChildren(frag);
  }

  /** Botín aún robable en la base invadida (25 % de almacenes/producción). */
  syncLoot(loot) {
    const coins = Math.max(0, Math.floor(loot?.coins || 0));
    const crystals = Math.max(0, Math.floor(loot?.crystals || 0));
    const key = `${coins}|${crystals}`;
    if (key === this.lootKey) return;
    this.lootKey = key;
    if (this.els.lootCoins) this.els.lootCoins.textContent = coins.toLocaleString('es-ES');
    if (this.els.lootCrystals) this.els.lootCrystals.textContent = crystals.toLocaleString('es-ES');
  }

  syncInvasion(inv) {
    document.body.classList.toggle('invading', inv.active);
    // Se actualiza solo la etiqueta: así el recuadro del atajo (key-hint)
    // que añade ShortcutController no se pierde al cambiar de estado.
    const setInvasionLabel = text => {
      const label = this.els.invasionBtnLabel || this.els.invasionBtn.querySelector('.btn-label');
      if (label) {
        if (label.textContent !== text) label.textContent = text;
      } else if (this.els.invasionBtn.textContent !== text) {
        this.els.invasionBtn.textContent = text;
      }
    };
    if (!inv.active) {
      this.els.invasionPanel.classList.remove('open');
      this.els.invasionBtn.classList.remove('active');
      this.els.invasionBtn.setAttribute('aria-pressed', 'false');
      if ((this.els.invasionBtnLabel?.textContent || '') !== 'Invasión') {
        setInvasionLabel('Invasión');
        this.els.invasionBtn.setAttribute('aria-label', 'Iniciar invasión');
      }
      this.els.victory.classList.remove('show', 'defeat');
      this.invClockKey = '';
      this.syncLoot(null);
      if (this.els.invasionTarget) this.els.invasionTarget.hidden = true;
      this.renderInvasionItems();
      return;
    }

    this.els.invasionBtn.classList.add('active');
    this.els.invasionBtn.setAttribute('aria-pressed', 'true');
    if ((this.els.invasionBtnLabel?.textContent || '') !== 'Terminar invasión') {
      setInvasionLabel('Terminar invasión');
      this.els.invasionBtn.setAttribute('aria-label', 'Terminar invasión');
    }
    this.els.invasionPanel.classList.toggle('open', !inv.over);
    this.renderInvasionItems();

    const s = Math.max(0, Math.ceil(inv.timeLeft));
    const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const label = inv.phase === 'prep' ? 'Preparación' : 'Tiempo restante';
    const key = `${label}|${text}|${inv.phase === 'battle' && s <= 30}`;
    if (key !== this.invClockKey) {
      this.invClockKey = key;
      this.els.timerLabel.textContent = label;
      this.els.timerTime.textContent = text;
      this.els.timer.classList.toggle('prep', inv.phase === 'prep');
      this.els.timer.classList.toggle('low', inv.phase === 'battle' && s <= 30);
    }

    const selected = inv.troops.filter(t => t.selected).length;
    const dead = Object.values(inv.dead).reduce((a, b) => a + b, 0);
    // La vida del núcleo se muestra ahora sobre el propio núcleo en el mundo;
    // el panel de despliegue solo informa del estado del ejército.
    const rival = inv.opponent?.name
      ? `Invadiendo a ${inv.opponent.name} · ` : '';
    this.els.invasionStatus.textContent =
      `${rival}Seleccionadas ${selected} · En campo ${inv.inField()} · Bajas ${dead}`;
    if (this.els.invasionTarget) {
      this.els.invasionTarget.hidden = !inv.opponent?.name;
      this.els.invasionTarget.textContent = inv.opponent?.name
        ? `Botín de ${inv.opponent.name}` : '';
    }
    this.syncLoot(inv.availableLoot?.());
  }

  showEnd({ kind, sub }) {
    this.els.victory.classList.toggle('defeat', kind === 'lost');
    this.els.victory.querySelector('b').textContent = kind === 'lost' ? 'Derrota' : '¡Victoria!';
    this.els.victory.querySelector('span').textContent = sub || '';
    this.els.victory.classList.add('show');
    this.els.victoryBack.focus();
  }

  setSelectBox(x0, y0, x1, y1, show) {
    const el = this.els.selectBox;
    if (!el) return;
    if (!show) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    el.style.left = `${Math.min(x0, x1)}px`;
    el.style.top = `${Math.min(y0, y1)}px`;
    el.style.width = `${Math.abs(x1 - x0)}px`;
    el.style.height = `${Math.abs(y1 - y0)}px`;
  }

  /* ---------- Aviso breve ----------------------------------------------- */

  showToast(text) {
    this.els.toast.textContent = text;
    this.els.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.els.toast.classList.remove('show'), 1600);
  }
}
