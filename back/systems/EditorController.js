/* ==========================================================
 * FASE 11 — EDITOR DE MAZMORRA
 * ----------------------------------------------------------
 * Port de js/ui/25-editor.js a la app Phaser. La lógica vive aquí; la escena
 * solo facilita las dependencias y repinta con `onChange`.
 *
 *  · `editor = { active, picking, invaderView, snap }` es el estado público.
 *  · El panel derecho lista los edificios guardados (`shelved`); pulsar una
 *    tarjeta los devuelve al mapa con `move.start(id, false, true)`.
 *  · Retirar conserva nivel/vida/producción; el núcleo también se puede
 *    guardar (sus casillas CORE pasan a EMPTY) y la puerta no.
 *  · Guardar exige que no queden edificios guardados y que haya camino.
 *  · Salir sin guardar restaura la copia tomada al entrar.
 * ========================================================== */

import { CORE, EMPTY } from './map.js';
import { structureAt } from './picking.js';
import { nameOf, specFor } from './structureSpecs.js';
import { drawBuildIcon } from '../ui/buildIcons.js';

const byId = id => (typeof document === 'undefined' ? null : document.getElementById(id));

const MOVE_MSG = 'Termina de mover el edificio primero';
const PATH_MSG = 'Camino bloqueado: abre un camino válido hasta el núcleo';
const EMPTY_LIST = 'No hay edificios guardados. Usa Retirar o Recoger para guardar edificios aquí.';

// Claves que `drawBuildIcon` sabe dibujar (el resto usa texto/nombre).
const ICON_KEYS = new Set([
  'ballista', 'turret', 'catapult', 'rift', 'lab', 'incubator',
  'vault-coins', 'vault-crystals', 'prod-crystals', 'prod-coins',
  'banner', 'bannerslime', 'bomb', 'rocktrap', 'electro',
]);

export class EditorController {
  constructor(deps = {}) {
    this.deps = deps;
    this.scene = deps.scene || null;
    this.structures = deps.structures || [];
    this.terrain = deps.terrain || null;
    this.move = deps.move || null;
    this.ui = deps.ui || null;
    this.editorUI = deps.editorUI || this.ui?.editorUI || null;
    this.invasion = deps.invasion || null;
    this.camera = deps.camera || deps.cameraController || this.scene?.cameras?.main || null;

    this.select = typeof deps.select === 'function' ? deps.select : null;
    this.getSelection = typeof deps.getSelection === 'function' ? deps.getSelection : null;
    this.onChange = typeof deps.onChange === 'function' ? deps.onChange : () => {};
    this.showToast = typeof deps.showToast === 'function' ? deps.showToast
      : typeof deps.onToast === 'function' ? deps.onToast
        : msg => this._callUI('showToast', msg);
    this.confirm = deps.confirm || deps.shortcuts || this.ui?.confirm || this.ui?.shortcuts || null;

    this.editor = { active: false, picking: false, invaderView: false, snap: null };

    this._bind();
  }

  /* ---------- Estado público --------------------------------------------- */

  get active() { return this.editor.active; }
  get picking() { return this.editor.picking; }
  get invaderView() { return this.editor.invaderView; }
  get snap() { return this.editor.snap; }

  /* ---------- Auxiliares ------------------------------------------------- */

  _callUI(method, ...args) {
    for (const target of [this.ui, this.ui?.editorUI, this.editorUI]) {
      if (target && typeof target[method] === 'function') {
        target[method](...args);
        return true;
      }
    }
    return false;
  }

  _toast(text) { this.showToast(text); }

  _canvas() {
    return this.ui?.els?.canvas
      || (typeof document === 'undefined' ? null : document.querySelector('#game canvas'));
  }

  _toolButtons() {
    if (typeof document === 'undefined') return [];
    return [byId('ed-dig'), byId('ed-fill')].filter(Boolean);
  }

  // Las pistas de teclado de la barra de acciones cambian con el contexto:
  // en el editor, Información/Mover/Recoger pasan a ser Z/X/C (atajos editsel).
  _refreshKeyHints() {
    const sc = this.deps?.shortcuts || this.ui?.shortcuts || this.scene?.shortcuts;
    if (sc && typeof sc.refreshHints === 'function') sc.refreshHints();
  }

  _def(id) { return this.structures.find(d => d?.id === id) || null; }

  _isShelved(def) { return Boolean(def?.shelved); }

  _movableDefs() {
    return this.structures.filter(d => d && Boolean(d.movable ?? specFor(d)?.movable));
  }

  _coreDef() {
    return this.structures.find(d => d?.kind === 'core' || d?.id === 'core') || null;
  }

  _name(def) { return nameOf(def); }

  _selection() {
    if (this.getSelection) return this.getSelection();
    if (this.deps.selection && typeof this.deps.selection !== 'function') return this.deps.selection;
    if (this.scene && 'selection' in this.scene) return this.scene.selection;
    return this.ui?.selection || null;
  }

  _select(def) {
    if (this.select) this.select(def);
    else this._callUI('setSelection', def);
    this._syncRetireButton();
  }

  _blockedByModal() {
    return Boolean(
      this.ui?.infoUI?.open
      || this.confirm?.open
      || this.confirm?.confirmOpen
      || this.confirm?.keysOpen
      || this.ui?.keysUI?.open,
    );
  }

  _screenToWorld(sx, sy) {
    const cam = this.camera;
    if (!cam) return { x: sx, y: sy };
    if (typeof cam.screenToWorld === 'function') return cam.screenToWorld(sx, sy);
    if (typeof cam.getWorldPoint === 'function') return cam.getWorldPoint(sx, sy);
    return { x: sx, y: sy };
  }

  _inMap(x, y) {
    if (!this.terrain?.map) return false;
    if (typeof this.terrain.inBounds === 'function') return this.terrain.inBounds(x, y);
    return y >= 0 && y < this.terrain.map.length && x >= 0 && x < this.terrain.map[y].length;
  }

  // value = CORE fuerza la celda; value = EMPTY solo limpia celdas CORE.
  _writeCoreCells(def, value) {
    if (!def || !this.terrain?.map) return;
    const w = def.w || def.size || 3;
    const h = def.h || w;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const x = def.x + i;
        const y = def.y + j;
        if (!this._inMap(x, y)) continue;
        if (value === CORE || this.terrain.map[y][x] === CORE) {
          this.terrain.map[y][x] = value;
          this.scene?.terrainView?.refresh?.(x, y);
        }
      }
    }
  }

  // Un núcleo recolocado desde el panel debe volver a escribir sus celdas CORE.
  _syncCorePlacement() {
    const core = this._coreDef();
    if (!core || !this.terrain) return;
    const placed = Boolean(core.placed) && !this._isShelved(core);
    if (placed) {
      this._writeCoreCells(core, CORE);
      this.terrain.coreShelved = false;
      if (core.view?.setVisible) core.view.setVisible(true);
    } else {
      this._writeCoreCells(core, EMPTY);
      this.terrain.coreShelved = true;
      if (core.view?.setVisible) core.view.setVisible(false);
    }
  }

  /* ---------- Firma y snapshot ------------------------------------------ */

  _signature() {
    const cells = this.terrain
      ? this.terrain.map.map(row => row.join('')).join('')
      : '';
    const defs = this.structures
      .map(d => `${d.id}:${d.x},${d.y},${this._isShelved(d) ? 1 : 0}`)
      .join(';');
    return `${cells}|${defs}`;
  }

  _takeSnapshot() {
    const core = this._coreDef();
    return {
      map: this.terrain.map.map(row => row.slice()),
      dig: this.terrain.digCount,
      defs: this.structures.map(d => ({
        id: d.id,
        x: d.x,
        y: d.y,
        placed: Boolean(d.placed),
        shelved: this._isShelved(d),
      })),
      coreMovable: core ? Boolean(core.movable) : false,
      coreShelved: Boolean(this.terrain.coreShelved),
      sig: this._signature(),
    };
  }

  _restoreSnapshot(snap) {
    if (!snap) return;

    const grid = this.terrain.map;
    for (let y = 0; y < snap.map.length && y < grid.length; y++) {
      const src = snap.map[y];
      const dst = grid[y];
      for (let x = 0; x < src.length && x < dst.length; x++) dst[x] = src[x];
    }
    this.terrain.digCount = snap.dig;
    this.terrain.occupied?.clear?.();

    const saved = new Map(snap.defs.map(p => [p.id, p]));
    for (const def of this.structures) {
      const p = saved.get(def.id);
      if (!p) continue;

      def.x = p.x;
      def.y = p.y;
      def.shelved = Boolean(p.shelved);
      def.placed = Boolean(p.placed) && !def.shelved;

      if (def.view) {
        def.view.x = def.x;
        def.view.y = def.y;
        if (typeof def.view.placeAt === 'function') def.view.placeAt(def.x, def.y);
        if (typeof def.view.clearFloating === 'function') def.view.clearFloating();
        if (typeof def.view.setVisible === 'function') def.view.setVisible(def.placed);
        if (def.kind !== 'core' && def.kind !== 'entrance' && typeof def.depth === 'number') {
          def.depth = def.x + def.y + (def.size || 1);
        }
      }

      if (def.placed) {
        const w = def.w || def.size || 1;
        const h = def.h || w;
        this.terrain.setFootprint(def.x, def.y, w, h, true);
      }
    }

    // El núcleo puede estar guardado: entonces no se ocupa y sus celdas siguen
    // despejadas. Si está colocado, sus celdas vuelven a ser CORE.
    const core = this._coreDef();
    if (core?.placed) {
      this._writeCoreCells(core, CORE);
      this.terrain.coreShelved = false;
    } else if (core) {
      this._writeCoreCells(core, EMPTY);
      this.terrain.coreShelved = true;
    }
    if (core) core.movable = Boolean(core.shelved) || Boolean(snap.coreMovable);

    this.terrain.pathValid = this.terrain.isCoreReachable();
    if (this.scene?.terrainView) {
      for (let y = 0; y < this.terrain.map.length; y++) {
        for (let x = 0; x < this.terrain.map[y].length; x++) {
          this.scene.terrainView.refresh?.(x, y);
        }
      }
    }
  }

  /* ---------- Panel derecho ---------------------------------------------- */

  shelvedIds() {
    return this._movableDefs().filter(d => this._isShelved(d)).map(d => d.id);
  }

  mapIds() {
    return this._movableDefs()
      .filter(d => !this._isShelved(d) && d.placed !== false)
      .map(d => d.id);
  }

  saveBlock() {
    const n = this.shelvedIds().length;
    if (n) return n === 1 ? 'Coloca primero el edificio guardado' : `Coloca primero los ${n} edificios guardados`;
    if (this.terrain && !this.terrain.pathValid) return PATH_MSG;
    return '';
  }

  refresh() {
    this._syncCorePlacement();
    this._syncButtons();

    const ids = this.shelvedIds();
    const sub = byId('ed-sub');
    if (sub) sub.textContent = `Guardados: ${ids.length}`;

    const list = byId('ed-list');
    if (list) {
      const frag = document.createDocumentFragment();
      if (!ids.length) {
        const empty = document.createElement('p');
        empty.className = 'army-empty';
        empty.textContent = EMPTY_LIST;
        frag.appendChild(empty);
      }
      for (const id of ids) {
        const def = this._def(id);
        if (!def) continue;
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'upg-row';
        row.setAttribute('role', 'listitem');
        row.dataset.ed = id;
        const label = this._name(def);
        row.setAttribute('aria-label', `Colocar ${label}`);

        const key = specFor(def)?.slot || def.kind;
        if (ICON_KEYS.has(key)) {
          const canvas = document.createElement('canvas');
          canvas.className = 'ed-ic';
          canvas.width = 80;
          canvas.height = 80;
          canvas.dataset.src = key;
          canvas.setAttribute('aria-hidden', 'true');
          row.appendChild(canvas);
          drawBuildIcon(canvas, key);
        } else {
          const icon = document.createElement('span');
          icon.className = 'ed-ic';
          icon.setAttribute('aria-hidden', 'true');
          icon.textContent = def.kind === 'core' ? '◆' : def.kind === 'entrance' ? '⌂' : (label || '?').charAt(0);
          row.appendChild(icon);
        }

        const txt = document.createElement('span');
        txt.className = 'upg-txt';
        const nameEl = document.createElement('span');
        nameEl.className = 'upg-name';
        nameEl.textContent = label;
        const subEl = document.createElement('span');
        subEl.className = 'upg-sub';
        subEl.textContent = `Nivel ${def.level || 1}`;
        txt.append(nameEl, subEl);
        row.appendChild(txt);
        frag.appendChild(row);
      }
      list.replaceChildren(frag);
    }

    this._syncRetireButton();
  }

  // La escena lo llama al seleccionar para que Retirar aparezca/oculte.
  syncSelection() { this._syncRetireButton(); }

  _syncRetireButton() {
    const btn = byId('btn-retire');
    if (!btn) return;
    const sel = this._selection();
    const show = Boolean(
      this.active && !this.invaderView && sel
      && Boolean(sel.movable ?? specFor(sel)?.movable)
      && !this._isShelved(sel),
    );
    btn.hidden = !show;
    btn.setAttribute('aria-disabled', String(!show));
  }

  _syncButtons() {
    const body = typeof document === 'undefined' ? null : document.body;
    body?.classList.toggle('editing', this.active);
    body?.classList.toggle('ed-view', this.invaderView);

    const editorBtn = byId('editor-btn');
    if (editorBtn) {
      editorBtn.classList.toggle('gold', this.active);
      editorBtn.setAttribute('aria-pressed', String(this.active));
      editorBtn.title = this.active ? 'Salir del editor' : 'Editor de mazmorra';
    }
    byId('editor-panel')?.classList.toggle('open', this.active);
    byId('editor-bar')?.classList.toggle('open', this.active);

    const pickBtn = byId('ed-pick');
    if (pickBtn) {
      pickBtn.hidden = false;
      pickBtn.classList.toggle('gold', this.picking);
      pickBtn.setAttribute('aria-pressed', String(this.picking));
    }
    this._canvas()?.classList.toggle('picking', this.picking);

    const viewBtn = byId('ed-view');
    if (viewBtn) {
      viewBtn.classList.toggle('gold', this.invaderView);
      viewBtn.setAttribute('aria-pressed', String(this.invaderView));
    }

    for (const btn of this._toolButtons()) {
      const on = Boolean(this.terrain && this.terrain.tool === btn.dataset.tool);
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    }

    const why = this.saveBlock();
    const saveBtn = byId('ed-save');
    if (saveBtn) {
      saveBtn.classList.toggle('locked', Boolean(why));
      saveBtn.setAttribute('aria-disabled', String(Boolean(why)));
      saveBtn.title = why;
    }

    if (typeof document !== 'undefined') {
      for (const el of document.querySelectorAll('#editor-panel .ed-lock, #editor-bar .ed-lock')) {
        el.setAttribute('aria-disabled', String(this.invaderView));
        if ('disabled' in el) el.disabled = this.invaderView;
      }
    }
    this._syncRetireButton();
  }

  /* ---------- Modos y herramientas -------------------------------------- */

  setPicking(on, notify = true) {
    const next = Boolean(on) && this.active && !this.invaderView && !this.move?.active;
    this.editor.picking = next;
    if (next) this._setTool(null, false);
    this._syncButtons();
    if (notify) this.onChange();
    return next;
  }

  setView(on, notify = true) {
    const next = Boolean(on) && this.active;
    this.editor.invaderView = next;
    if (next) {
      this.editor.picking = false;
      this._setTool(null, false);
      this._select(null);
    }
    this._syncButtons();
    if (notify) this.onChange();
    return next;
  }

  _setTool(tool, notify = true) {
    if (tool && (!this.active || this.invaderView || this.move?.active)) return false;
    if (tool) {
      this.editor.picking = false;
      this.terrain?.setTool?.(null);
    }
    this.terrain?.setTool?.(tool || null);
    this._syncButtons();
    this._callUI('refreshTerrainUI');
    this._callUI('syncScene');
    if (notify) this.onChange();
    return Boolean(this.terrain?.tool);
  }

  setTool(tool) { return this._setTool(tool); }

  /* ---------- Entrar / salir -------------------------------------------- */

  enter() {
    if (this.active) {
      this._toast('El editor ya está abierto');
      return false;
    }
    if (this._blockedByModal()) {
      this._toast('Cierra la ventana antes de abrir el editor');
      return false;
    }
    if (this.invasion?.active) {
      this._toast('No se puede editar durante una invasión');
      return false;
    }
    if (this.move?.active) {
      this._toast(MOVE_MSG);
      return false;
    }

    // El snapshot se toma antes de habilitar el núcleo para recordar su flag.
    this.editor.snap = this._takeSnapshot();
    this._callUI('setBuildOpen', false);
    this._callUI('closePanel');
    this._setTool(null, false);
    this._select(null);

    const core = this._coreDef();
    if (core) core.movable = true;
    this.editor.active = true;
    this.editor.picking = false;
    this.editor.invaderView = false;

    this.refresh();
    this._refreshKeyHints();
    this.onChange();
    return true;
  }

  leave(keep) {
    if (!this.active) return false;
    const dirty = this._signature() !== this.editor.snap?.sig;

    this.editor.picking = false;
    this.editor.invaderView = false;
    this.terrain?.setTool?.(null);
    if (!keep) this._restoreSnapshot(this.editor.snap);

    const core = this._coreDef();
    if (core) {
      core.movable = Boolean(core.shelved) || Boolean(this.editor.snap?.coreMovable);
    }

    this.editor.active = false;
    this.editor.snap = null;
    this._select(null);

    this.terrain.pathValid = this.terrain.isCoreReachable();
    this._callUI('refreshTerrainUI');
    this._callUI('refreshBuildItems');
    this._callUI('syncScene');
    this.refresh();
    this._refreshKeyHints();

    if (keep) this._toast('Diseño guardado');
    else if (dirty) this._toast('Cambios descartados: la mazmorra vuelve a como estaba');
    this.onChange();
    return true;
  }

  requestExit() {
    if (!this.active) return false;
    if (this.move?.active) {
      this._toast(MOVE_MSG);
      return false;
    }
    if (this._signature() === this.editor.snap?.sig) {
      this.leave(false);
      return true;
    }

    const options = {
      title: '¿Salir del editor?',
      text: 'Los cambios sin guardar se descartarán y la mazmorra volverá a como estaba.',
      okLabel: 'Salir sin guardar',
      cancelLabel: 'Seguir editando',
      onOk: () => this.leave(false),
      stillValid: () => this.active,
    };
    if (this.confirm?.openConfirm) {
      this.confirm.openConfirm(options);
      return true;
    }
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(options.text)) this.leave(false);
      return true;
    }
    this.leave(false);
    return true;
  }

  save() {
    if (!this.active) return false;
    if (this.move?.active) {
      this._toast(MOVE_MSG);
      return false;
    }
    const why = this.saveBlock();
    if (why) {
      this._toast(why);
      return false;
    }
    this.leave(true);
    return true;
  }

  /* ---------- Retirar y recoger ----------------------------------------- */

  retire(id) {
    const def = this._def(id);
    if (!def || !def.movable || this._isShelved(def) || def.placed === false) return false;
    if (this.invaderView) return false;
    // Estar en obras (mejora o construcci??n) NO quita la opci??n de mover:
    // el edificio se recoge y se vuelve a colocar con su obra en curso.

    // Libera la huella. En el n??cleo adem??s las celdas CORE vuelven a EMPTY.
    const w = def.w || def.size || 1;
    const h = def.h || w;
    if (def.kind === 'core' || def.id === 'core') {
      this._writeCoreCells(def, EMPTY);
      this.terrain.coreShelved = true;
      if (def.view?.setVisible) def.view.setVisible(false);
    }
    this.terrain.setFootprint(def.x, def.y, w, h, false);

    def.shelved = true;
    def.placed = false;

    // Guardado fuera del mapa: la vista desaparece con el edificio.
    def.view?.setHidden?.(true);
    if (this._selection()?.id === id) this._select(null);
    this.terrain.pathValid = this.terrain.isCoreReachable();
    this._callUI('refreshTerrainUI');
    this._callUI('refreshBuildItems');
    this._callUI('syncScene');
    this.refresh();
    this.onChange();
    return true;
  }

  retireSelected() {
    if (!this.active || this.invaderView) return false;
    const sel = this._selection();
    if (!sel) return false;
    const label = this._name(sel);
    if (this.retire(sel.id)) {
      this._toast(`${label} retirado`);
      return true;
    }
    return false;
  }

  pick(sx, sy) {
    if (!this.picking) return false;
    const w = this._screenToWorld(sx, sy);
    const def = structureAt(w.x, w.y, this.structures);
    if (!def) return true;                       // el clic se consume igualmente
    if (def.kind === 'entrance' || def.id === 'entrance') {
      this._toast('La puerta no se puede retirar');
      return true;
    }
    const label = this._name(def);
    if (this.retire(def.id)) this._toast(`${label} guardado`);
    return true;
  }

  _retireAll() {
    if (this.invaderView || this.move?.active) return;
    const ids = this.mapIds();
    if (!ids.length) {
      this._toast('No hay edificios en el mapa');
      return;
    }
    let done = 0;
    for (const id of ids) if (this.retire(id)) done++;
    this._toast(done === 1 ? '1 edificio guardado' : `${done} edificios guardados`);
  }

  /* ---------- Teclado ---------------------------------------------------- */

  handleEscape() {
    if (!this.active || this.move?.active || this._blockedByModal()) return false;
    if (this.invaderView) { this.setView(false); return true; }
    if (this.picking) { this.setPicking(false); return true; }
    if (this.terrain?.tool) { this.setTool(null); return true; }
    if (this._selection()) { this._select(null); return true; }
    this.requestExit();
    return true;
  }

  /* ---------- Eventos de la interfaz ------------------------------------ */

  _bind() {
    const add = (el, type, fn) => {
      if (el && typeof el.addEventListener === 'function') el.addEventListener(type, fn);
    };

    add(byId('editor-btn'), 'click', () => (this.active ? this.requestExit() : this.enter()));
    add(byId('ed-save'), 'click', () => this.save());
    add(byId('ed-view'), 'click', () => {
      if (this.move?.active) { this._toast(MOVE_MSG); return; }
      this.setView(!this.invaderView);
    });
    add(byId('ed-pick'), 'click', () => {
      if (this.invaderView || this.move?.active) return;
      if (this.setPicking(!this.picking)) this._toast('Recoger: pulsa un edificio para guardarlo');
    });
    add(byId('ed-all'), 'click', () => this._retireAll());
    for (const btn of this._toolButtons()) {
      add(btn, 'click', () => {
        if (this.invaderView || this.move?.active) return;
        const tool = btn.dataset.tool || null;
        this.setTool(this.terrain?.tool === tool ? null : tool);
      });
    }
    add(byId('btn-retire'), 'click', () => this.retireSelected());

    add(byId('ed-list'), 'click', e => {
      if (!this.active || this.invaderView) return;
      const row = e.target?.closest ? e.target.closest('[data-ed]') : null;
      if (!row) return;
      if (this.move?.active) { this._toast(MOVE_MSG); return; }
      this.setPicking(false, false);
      this._setTool(null, false);
      this._select(null);
      if (this.move?.start(row.dataset.ed, false, true)) {
        this._callUI('syncScene');
        this.refresh();
        this.onChange();
      }
    });
    // Escape lo enruta InteractionController con la prioridad acordada:
    // confirmación → atajos → info → invasión → movimiento → editor.
  }
}
