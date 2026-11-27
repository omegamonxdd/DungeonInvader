/* ==========================================================
 * FASE 11 — ATAJOS DE TECLADO CONFIGURABLES
 * ----------------------------------------------------------
 * Port autocontenido de js/ui/23-atajos.js para la app Phaser.
 * No hay globals ni localStorage: las asignaciones viven en esta
 * instancia y `resetKeys()` vuelve siempre a los valores por defecto.
 *
 * Contextos (mismo solapamiento que el legacy):
 *   · 'global'  accesos rápidos (Invasión, Construir); coincide con todos
 *   · 'select'  barra de acciones de un edificio seleccionado
 *   · 'build'   menú Construir abierto (etiquetas, excavar, rellenar)
 *   · 'editor'  editor de mazmorra
 *   · 'editsel' editor con edificio seleccionado (solapa con 'editor')
 * 'select' y 'build' nunca coinciden; el editor sustituye a los demás.
 *
 * Contrato:
 *   new ShortcutController({ run, ui, editor, invasion, move, terrain,
 *                            shortcutsUI, showToast })
 *   `run` es un mapa id → callback: info, upgrade, move, special,
 *   invasion, build, upgrades, tab-recursos, tab-militar, tab-defensas,
 *   tab-estandartes, tab-trampas, dig, fill, edig, efill, einfo, emove,
 *   eretire. Si falta un callback se usa un clic DOM de reserva.
 * ========================================================== */

import { keyCodeOf } from './keyboard.js';

/* ---------- Definición de atajos (id, contexto, etiqueta, tecla inicial) ---------- */
export const SHORTCUT_GROUPS = [
  { ctx: 'select', title: 'Edificio seleccionado' },
  { ctx: 'global', title: 'Accesos rápidos' },
  { ctx: 'build', title: 'Menú Construir' },
  { ctx: 'editor', title: 'Editor de mazmorra' },
  { ctx: 'editsel', title: 'Editor: edificio seleccionado' },
];

export const SHORTCUT_ACTIONS = [
  { id: 'info',     ctx: 'select', label: 'Información',                    def: 'KeyZ' },
  { id: 'upgrade',  ctx: 'select', label: 'Mejorar',                        def: 'KeyX' },
  { id: 'move',     ctx: 'select', label: 'Mover',                          def: 'KeyC' },
  { id: 'special',  ctx: 'select', label: 'Acción única (Invocar, Mutar…)', def: 'KeyV' },
  { id: 'invasion', ctx: 'global', label: 'Invasión',                       def: 'KeyQ' },
  { id: 'build',    ctx: 'global', label: 'Construir',                      def: 'KeyE' },
  { id: 'upgrades', ctx: 'global', label: 'Mejoras pendientes',             def: 'AltLeft' },
  { id: 'tab-recursos',    ctx: 'build', label: 'Etiqueta: Recursos',    def: 'Digit1' },
  { id: 'tab-militar',     ctx: 'build', label: 'Etiqueta: Militar',     def: 'Digit2' },
  { id: 'tab-defensas',    ctx: 'build', label: 'Etiqueta: Defensas',    def: 'Digit3' },
  { id: 'tab-estandartes', ctx: 'build', label: 'Etiqueta: Estandartes', def: 'Digit4' },
  { id: 'tab-trampas',     ctx: 'build', label: 'Etiqueta: Trampas',     def: 'Digit5' },
  { id: 'tab-fusiones',    ctx: 'build', label: 'Etiqueta: Fusiones',    def: 'Digit6' },
  { id: 'dig',      ctx: 'build',  label: 'Excavar',   def: 'KeyZ' },
  { id: 'fill',     ctx: 'build',  label: 'Rellenar',  def: 'KeyX' },
  { id: 'edig',     ctx: 'editor', label: 'Excavar',   def: 'KeyQ' },
  { id: 'efill',    ctx: 'editor', label: 'Rellenar',  def: 'KeyE' },
  { id: 'einfo',    ctx: 'editsel', label: 'Información', def: 'KeyZ' },
  { id: 'emove',    ctx: 'editsel', label: 'Mover',       def: 'KeyX' },
  { id: 'eretire',  ctx: 'editsel', label: 'Retirar',     def: 'KeyC' },
];

const ACTION_IDS = new Set(SHORTCUT_ACTIONS.map(a => a.id));
const EDIT_CTX = ['editor', 'editsel'];

// WASD/flechas mueven la cámara; Esc, Tab, Enter, Espacio… son reservados.
const CAMERA_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const RESERVED_CODES = new Set(['Escape', 'Tab', 'Enter', 'NumpadEnter',
  'Space', 'Backspace', 'Delete']);
const isModifierCode = code => /^(Shift|Control|Alt|Meta|OS|AltGraph)(Left|Right)?$|^CapsLock$|^ContextMenu$/.test(code || '');
const EDITABLE_TAG = /^(INPUT|TEXTAREA|SELECT)$/;

const KEY_NAMES = {
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
  Backslash: '\\', IntlBackslash: '<',
  AltLeft: 'Alt Izq', AltRight: 'Alt Der',
};

/* Valor de una propiedad que puede ser dato o getter (para controladores). */
const read = (obj, key) => {
  if (!obj) return undefined;
  const value = obj[key];
  return typeof value === 'function' ? value() : value;
};

/* El editor y editsel sí se solapan entre sí; editor no solapa con los otros.
 * Fuera del editor, 'global' solapa con todo y contextos iguales solapan. */
function ctxOverlap(a, b) {
  const ea = EDIT_CTX.includes(a);
  const eb = EDIT_CTX.includes(b);
  if (ea && eb) return true;
  if (ea || eb) return false;
  return a === b || a === 'global' || b === 'global';
}

/* Teclado numérico = dígitos de la fila principal, como en el legacy. */
function normalizeCode(code) {
  const c = keyCodeOf({ code: code || '', key: '' });
  return (c || '').replace(/^Numpad(\d)$/, 'Digit$1');
}

/* Siempre event.code cuando existe; el fallback cubre eventos sintéticos. */
function codeOfEvent(event) {
  if (!event) return '';
  const code = event.code ? normalizeCode(event.code) : normalizeCode(keyCodeOf(event));
  return code || '';
}

export class ShortcutController {
  constructor(deps = {}) {
    this.deps = deps;
    this.ui = deps.ui || {};
    this.editor = deps.editor || deps.ui?.editor || {};
    this.invasion = deps.invasion || deps.ui?.invasion || {};
    this.move = deps.move || deps.ui?.move || {};
    this.terrain = deps.terrain || deps.ui?.terrain || {};
    this.run = deps.run || {};
    // Se puede asignar después de construir (útil si la UI se crea más tarde).
    this.shortcutsUI = deps.shortcutsUI || null;

    this._bindings = {};
    for (const a of SHORTCUT_ACTIONS) this._bindings[a.id] = a.def;
    this._keyLabelMemo = Object.create(null);
  }

  get bindings() { return { ...this._bindings }; }

  /* ---------- Contextos y bloqueos ---------- */

  _selection() {
    for (const candidate of [this.editor?.selection, this.ui?.selection, this.deps.selection]) {
      const value = typeof candidate === 'function' ? candidate() : candidate;
      if (value !== undefined && value !== null) return value;
    }
    return null;
  }

  _buildOpen() {
    return Boolean(read(this.ui.buildUI, 'open') || read(this.ui, 'buildOpen') ||
      read(this.ui.build, 'open'));
  }

  _actionBarOpen() {
    const explicit = read(this.ui, 'actionBarOpen');
    if (explicit !== undefined) return Boolean(explicit);

    let bar = read(this.ui, 'actionBar');
    if (!bar) bar = this.ui?.els?.actionBar;
    if (!bar && typeof document !== 'undefined') bar = document.getElementById('action-bar');
    if (bar?.classList) return bar.classList.contains('open');
    return Boolean(this._selection());
  }

  activeContexts() {
    if (read(this.invasion, 'active')) return ['global'];
    if (read(this.editor, 'active')) return this._selection() ? ['editor', 'editsel'] : ['editor'];
    if (this._buildOpen()) return ['global', 'build'];
    if (this._actionBarOpen()) return ['global', 'select'];
    return ['global'];
  }

  /* Ventanas propias o ajenas, y modo Mover: ningún atajo debe filtrarse. */
  overlaysOpen() {
    const ui = this.ui || {};
    const su = this.shortcutsUI || this.deps.shortcutsUI;
    let shortcutsOpen = false;
    if (su) {
      const isOpen = typeof su.isOpen === 'function' ? su.isOpen() : su.isOpen;
      shortcutsOpen = Boolean(isOpen || su.keysOpen || su.confirmOpen);
    }
    const infoOpen = Boolean(read(ui.infoUI, 'open') || read(ui, 'infoOpen') ||
      read(ui.infoPanel, 'open') || read(ui.summonUI, 'open'));
    const keysOpen = Boolean(read(ui.keysUI, 'open') || read(ui, 'keysOpen'));
    const confirmOpen = Boolean(read(this.deps.confirm, 'open') ||
      read(this.deps.confirmUI, 'open') || read(ui.confirmUI, 'open') ||
      read(ui, 'confirmOpen'));
    const moving = Boolean(read(this.move, 'active') || read(this.deps.moving, 'active'));
    const baseSelectOpen = Boolean(this.editor?.baseSelectorOpen?.());
    const rivalOpen = Boolean(ui?.rivalPickerOpen);
    const authOpen = Boolean(typeof window !== 'undefined' && window.__DUNGEON_AUTH_UI__?.isOpen);
    return shortcutsOpen || infoOpen || keysOpen || confirmOpen || moving || baseSelectOpen || rivalOpen || authOpen;
  }

  /* ---------- Ejecución ---------- */

  // ¿Es esta tecla un atajo del juego (con la asignación actual)? Lo usa
  // InteractionController para impedir que Ctrl+E, Ctrl+Q… activen órdenes
  // del navegador (abrir/cerrar paneles de archivos, guardar, etc.).
  isGameKey(code) {
    const c = codeOfEvent({ code });
    return SHORTCUT_ACTIONS.some(a => this._bindings[a.id] === c);
  }

  handleKeydown(event) {
    if (!event || event.repeat || event.ctrlKey || event.metaKey) return false;
    const code = codeOfEvent(event);
    // El Alt izquierdo es asignable (atajo de Mejoras por defecto); el resto
    // de combinaciones con Alt siguen reservadas por el navegador.
    if (event.altKey && code !== 'AltLeft') return false;
    const target = event.target;
    if (target && (target.isContentEditable || EDITABLE_TAG.test(target.tagName || ''))) return false;
    if (this.overlaysOpen()) return false;

    if (!code) return false;
    const ctxs = this.activeContexts();
    const act = SHORTCUT_ACTIONS.find(a => this._bindings[a.id] === code && ctxs.includes(a.ctx));
    if (!act) return false;

    // Con el menú Construir abierto solo mandan sus atajos (1-5, excavar,
    // rellenar) y E, que lo cierra. Ni Q (invasión) ni Alt (mejoras) ni el
    // resto de accesos globales deben filtrarse mientras se está construyendo.
    if (this._buildOpen() && act.ctx === 'global' && act.id !== 'build') return false;

    if (typeof event.preventDefault === 'function') event.preventDefault();
    this._runAction(act.id);
    return true;
  }

  _runAction(id) {
    const fn = this.run[id];
    if (typeof fn === 'function') { fn(); return true; }
    return this._fallbackAction(id);
  }

  /* Red de seguridad para usar el controlador sin pasar `run`: clic en los
   * botones del legacy, que siguen siendo los ids de la app migrada. */
  _fallbackAction(id) {
    if (typeof document === 'undefined') return false;
    const click = selector => {
      const el = document.querySelector(selector);
      if (!el || el.hidden || el.disabled) return false;
      el.click();
      return true;
    };

    if (id.startsWith('tab-')) {
      const cat = id.slice(4);
      if (typeof this.ui?.setBuildCategory === 'function') {
        this.ui.setBuildCategory(cat);
        return true;
      }
      const tab = [...document.querySelectorAll('.build-tab')].find(t => t.dataset.cat === cat);
      if (tab) { tab.click(); return true; }
      return false;
    }

    const editorLive = ['edig', 'efill', 'einfo', 'emove', 'eretire'].includes(id);
    if (editorLive && read(this.editor, 'invaderView')) return false;

    switch (id) {
      case 'info':     return click('#btn-info');
      case 'upgrade':  return click('#btn-upgrade');
      case 'move':     return click('#btn-move:not([hidden])');
      case 'special':  return click('#action-bar .action-special:not([hidden])');
      case 'invasion': return click('#invasion-btn');
      case 'build':    return click('#build-btn');
      case 'upgrades': return click('#upg-btn');
      case 'dig':      return click('#tool-dig');
      case 'fill':     return click('#tool-fill');
      case 'edig':     return click('#ed-dig');
      case 'efill':    return click('#ed-fill');
      case 'einfo':    return click('#btn-info');
      case 'emove':    return click('#btn-move:not([hidden])');
      case 'eretire':  return click('#btn-retire:not([hidden])');
      default:         return false;
    }
  }

  /* ---------- Asignación ---------- */

  assignKey(id, event) {
    const act = SHORTCUT_ACTIONS.find(a => a.id === id);
    if (!act || !event || event.repeat) return false;
    const code = codeOfEvent(event);
    if (!code) return false;

    // Teclas con símbolo: recordar el carácter que produjo el evento.
    if (!/^(Key[A-Z]|Digit\d)$/.test(code) && event.key && event.key.length === 1) {
      this._keyLabelMemo[code] = event.key.toUpperCase();
    }
    const label = this.codeLabel(code);

    if (CAMERA_CODES.has(code)) {
      this._toast(`${label} se usa para mover la cámara`);
      return false;
    }
    // AltLeft se permite porque es el atajo por defecto de Mejoras; AltRight
    // (AltGr) y el resto de modificadores siguen reservados.
    if (RESERVED_CODES.has(code) || /^F\d{1,2}$/.test(code) ||
        (isModifierCode(code) && code !== 'AltLeft')) {
      this._toast(`La tecla ${label} está reservada`);
      return false;
    }
    const clash = SHORTCUT_ACTIONS.find(o => o.id !== id &&
      this._bindings[o.id] === code && ctxOverlap(o.ctx, act.ctx));
    if (clash) {
      this._toast(`${label} ya está en uso: ${clash.label}`);
      return false;
    }

    this._bindings[id] = code;
    this.refreshHints();
    this.shortcutsUI?.stopCapture?.();
    return true;
  }

  resetKeys() {
    for (const a of SHORTCUT_ACTIONS) this._bindings[a.id] = a.def;
    this._keyLabelMemo = Object.create(null);

    const ui = this.shortcutsUI;
    if (ui) {
      ui.stopCapture?.();
      ui.renderKeys?.('keys-reset');
      const btn = typeof document !== 'undefined' ? document.getElementById('keys-reset') : null;
      btn?.focus();
    }
    this.refreshHints();
    this._toast('Atajos restablecidos');
  }

  /* ---------- Etiquetas y pistas ---------- */

  codeLabel(code) {
    if (!code) return '—';
    if (this._keyLabelMemo[code]) return this._keyLabelMemo[code];
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    return KEY_NAMES[code] || code;
  }

  hintPairs() {
    if (typeof document === 'undefined') return [];
    const pairs = [];
    const seen = new Set();
    const q = selector => document.querySelector(selector);
    const qa = selector => [...document.querySelectorAll(selector)];
    const add = (el, id) => {
      if (!el || !ACTION_IDS.has(id) || seen.has(el)) return;
      seen.add(el);
      if (el.dataset && !el.dataset.action) el.dataset.action = id;
      pairs.push([el, id]);
    };
    const editor = Boolean(read(this.editor, 'active'));
    const dig = q('#tool-dig');
    const fill = q('#tool-fill');
    const edDig = q('#ed-dig');
    const edFill = q('#ed-fill');

    add(q('#btn-info'), editor ? 'einfo' : 'info');
    add(q('#btn-upgrade'), 'upgrade');
    add(q('#btn-move'), editor ? 'emove' : 'move');
    add(q('#btn-retire'), 'eretire');
    add(q('#build-btn'), 'build');
    add(q('#invasion-btn'), 'invasion');
    add(q('#upg-btn'), 'upgrades');
    add(dig, 'dig');
    add(fill, 'fill');
    add(edDig, 'edig');
    add(edFill, 'efill');

    // Cualquier otra herramienta de terreno con data-tool (legacy: .tool-btn).
    for (const btn of qa('.tool-btn[data-tool]')) {
      if (btn === dig || btn === fill || btn === edDig || btn === edFill) continue;
      if (btn.dataset.tool === 'dig' || btn.dataset.tool === 'fill') add(btn, btn.dataset.tool);
    }

    for (const btn of qa('#action-bar .action-special')) add(btn, 'special');
    for (const btn of qa('.build-tab')) {
      if (btn.dataset.cat) add(btn, `tab-${btn.dataset.cat}`);
    }
    // Cualquier botón marcado en el HTML con data-action recibe su recuadro.
    for (const btn of qa('[data-action]')) add(btn, btn.dataset.action);
    return pairs;
  }

  refreshHints() {
    if (typeof document === 'undefined') return;
    for (const [el, id] of this.hintPairs()) {
      let hint = Array.from(el.children || []).find(c => c.classList?.contains('key-hint'));
      if (!hint) {
        hint = document.createElement('span');
        hint.className = 'key-hint';
        hint.setAttribute('aria-hidden', 'true');
        el.appendChild(hint);
      }
      const code = this._bindings[id] || null;
      const label = code ? this.codeLabel(code) : '—';
      hint.textContent = label;
      hint.hidden = !code;
      if (code) el.setAttribute('aria-keyshortcuts', label);
      else el.removeAttribute('aria-keyshortcuts');
    }
  }

  _toast(text) {
    if (typeof this.deps.showToast === 'function') { this.deps.showToast(text); return; }
    if (typeof this.ui?.showToast === 'function') this.ui.showToast(text);
  }
}
