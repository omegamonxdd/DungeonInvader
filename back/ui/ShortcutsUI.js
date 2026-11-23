/* ==========================================================
 * FASE 11 — VENTANAS DE ATAJOS Y CONFIRMACIÓN
 * ----------------------------------------------------------
 * Port autocontenido de la parte DOM de js/ui/23-atajos.js.
 * Crea sus overlays y el botón #settings-btn si no existen (no toca
 * index.html), usa las clases de css/modales/02-atajos.css y deja que
 * ShortcutController resuelva teclas, choques y ejecución.
 *
 * Contrato:
 *   new ShortcutsUI({ shortcuts, showToast })
 *   keysOpen / confirmOpen / isOpen, openKeys(), closeKeys(),
 *   openConfirm(opts), closeConfirm(), renderKeys(focusId),
 *   startCapture(id), stopCapture(), bindCapture(), refreshHints()
 * ========================================================== */

import { SHORTCUT_ACTIONS, SHORTCUT_GROUPS } from '../systems/ShortcutController.js';

const SVG_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>';
const SVG_SETTINGS = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/>' +
  '<circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>' +
  '<path d="M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></svg>';
const KEYS_HELP = 'Pulsa una tecla para reasignarla. Esc cancela.';
const EDITABLE_TAG = /^(INPUT|TEXTAREA|SELECT)$/;
const KEY_NAMES = {
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
  Backslash: '\\', IntlBackslash: '<',
  AltLeft: 'Alt Izq', AltRight: 'Alt Der',
};
// AltLeft es asignable (atajo por defecto de Mejoras); los demás modificadores
// siguen siendo teclas reservadas tanto al capturar como al ejecutar.
const isModifierCode = code => code !== 'AltLeft' &&
  /^(Shift|Control|Alt|Meta|OS|AltGraph)(Left|Right)?$|^CapsLock$|^ContextMenu$/.test(code || '');

const KEYS_MARKUP = `
<div class="kb-overlay" id="keys-overlay">
  <section class="kb-panel" id="keys-panel" role="dialog" aria-modal="true" aria-labelledby="keys-title">
    <button class="action-btn kb-close" id="keys-close" type="button" aria-label="Cerrar configuración">${SVG_CLOSE}</button>
    <h2 class="kb-title" id="keys-title">Atajos de teclado</h2>
    <div class="kb-sub" id="keys-sub" role="status" aria-live="polite"></div>
    <div id="keys-list"></div>
    <div class="kb-footer"><button class="action-btn" id="keys-reset" type="button">Restablecer predeterminados</button></div>
  </section>
</div>`;

const CONFIRM_MARKUP = `
<div class="kb-overlay" id="confirm-overlay">
  <section class="kb-panel kb-confirm" id="confirm-panel" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text">
    <h2 class="kb-title" id="confirm-title"></h2>
    <p class="kb-text" id="confirm-text"></p>
    <div class="kb-footer">
      <button class="action-btn" id="confirm-cancel" type="button"></button>
      <button class="action-btn danger" id="confirm-ok" type="button"></button>
    </div>
  </section>
</div>`;

function basicLabel(code) {
  if (!code) return '—';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  return KEY_NAMES[code] || code;
}

const isEditable = el => Boolean(el && (el.isContentEditable || EDITABLE_TAG.test(el.tagName || '')));

export class ShortcutsUI {
  constructor(deps = {}) {
    this.deps = deps;
    // Se puede sustituir después: los métodos leen `this.shortcuts` en cada uso.
    this.shortcuts = deps.shortcuts || null;
    this._keysOpen = false;
    this._confirmOpen = false;
    this._capturing = null;
    this._confirm = null;
    this._keysReturn = null;
    this._confirmReturn = null;
    this._bound = false;
    this._buttonsBound = false;
    this._wheelBound = false;

    if (typeof document === 'undefined') return;
    this._ensureKeysDom();
    this._ensureConfirmDom();
    this._connectSettings();
    this._bindButtons();
    this.bindCapture();
    this.bindBuildWheel();
    this.refreshHints();
  }

  get keysOpen() { return this._keysOpen; }
  get confirmOpen() { return this._confirmOpen; }
  get isOpen() { return this._keysOpen || this._confirmOpen; }

  /* ---------- Construcción de DOM (sin tocar index.html) ---------- */

  _fromHTML(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    return tpl.content.firstElementChild;
  }

  _makeChild(parent, tag, cls, id, html) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (id) node.id = id;
    if (html !== undefined) node.innerHTML = html;
    parent.appendChild(node);
    return node;
  }

  _ensureChild(parent, id, tag, cls, html) {
    const found = id ? document.getElementById(id) : null;
    if (found && parent.contains(found)) return found;
    return this._makeChild(parent, tag, cls, id, html);
  }

  _ensureClass(parent, selector, tag, cls) {
    const found = parent.querySelector(selector);
    return found || this._makeChild(parent, tag, cls);
  }

  _ensureKeysDom() {
    let overlay = document.getElementById('keys-overlay');
    if (!overlay) {
      overlay = this._fromHTML(KEYS_MARKUP);
      document.body.appendChild(overlay);
    }
    this.keysOverlay = overlay;
    this.keysPanel = this._ensureChild(overlay, 'keys-panel', 'section', 'kb-panel');
    this.keysPanel.setAttribute('role', 'dialog');
    this.keysPanel.setAttribute('aria-modal', 'true');
    this.keysPanel.setAttribute('aria-labelledby', 'keys-title');

    this.keysTitle = this._ensureChild(this.keysPanel, 'keys-title', 'h2', 'kb-title');
    if (!this.keysTitle.textContent) this.keysTitle.textContent = 'Atajos de teclado';
    this.keysClose = this._ensureChild(this.keysPanel, 'keys-close', 'button', 'action-btn kb-close', SVG_CLOSE);
    this.keysClose.type = 'button';
    this.keysClose.setAttribute('aria-label', 'Cerrar configuración');
    this.keysSub = this._ensureChild(this.keysPanel, 'keys-sub', 'div', 'kb-sub');
    this.keysSub.setAttribute('role', 'status');
    this.keysSub.setAttribute('aria-live', 'polite');
    this.keysList = this._ensureChild(this.keysPanel, 'keys-list', 'div', '');
    const footer = this._ensureClass(this.keysPanel, '.kb-footer', 'div', 'kb-footer');
    this.keysReset = this._ensureChild(footer, 'keys-reset', 'button', 'action-btn',
      'Restablecer predeterminados');
    this.keysReset.type = 'button';
  }

  _ensureConfirmDom() {
    let overlay = document.getElementById('confirm-overlay');
    if (!overlay) {
      overlay = this._fromHTML(CONFIRM_MARKUP);
      document.body.appendChild(overlay);
    }
    this.confirmOverlay = overlay;
    this.confirmPanel = this._ensureChild(overlay, 'confirm-panel', 'section', 'kb-panel kb-confirm');
    this.confirmPanel.setAttribute('role', 'alertdialog');
    this.confirmPanel.setAttribute('aria-modal', 'true');
    this.confirmPanel.setAttribute('aria-labelledby', 'confirm-title');
    this.confirmPanel.setAttribute('aria-describedby', 'confirm-text');

    this.confirmTitle = this._ensureChild(this.confirmPanel, 'confirm-title', 'h2', 'kb-title');
    this.confirmText = this._ensureChild(this.confirmPanel, 'confirm-text', 'p', 'kb-text');
    const footer = this._ensureClass(this.confirmPanel, '.kb-footer', 'div', 'kb-footer');
    this.confirmCancel = this._ensureChild(footer, 'confirm-cancel', 'button', 'action-btn', 'Cancelar');
    this.confirmCancel.type = 'button';
    this.confirmOk = this._ensureChild(footer, 'confirm-ok', 'button', 'action-btn danger', 'Aceptar');
    this.confirmOk.type = 'button';
  }

  _connectSettings() {
    let btn = document.getElementById('settings-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'settings-btn';
      btn.className = 'action-btn';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Configuración de atajos de teclado');
      btn.title = 'Configuración';
      btn.innerHTML = SVG_SETTINGS;
      const host = document.getElementById('status-tools')
        || document.getElementById('status') || document.getElementById('topbar') || document.body;
      host.insertBefore(btn, host.firstChild);
    }
    this.settingsBtn = btn;
    if (!btn.dataset.shortcutsBound) {
      btn.dataset.shortcutsBound = 'true';
      btn.addEventListener('click', () => this.openKeys());
    }
  }

  _bindButtons() {
    if (this._buttonsBound) return;
    this._buttonsBound = true;

    this.keysList.addEventListener('click', e => {
      const btn = e.target.closest?.('[data-action]');
      if (btn) this.startCapture(btn.dataset.action);
    });
    this.keysReset.addEventListener('click', () => this.shortcuts?.resetKeys?.());
    this.keysClose.addEventListener('click', () => this.closeKeys());
    this.keysOverlay.addEventListener('pointerdown', e => {
      if (e.target === this.keysOverlay) this.closeKeys();
    });
    this.confirmCancel.addEventListener('click', () => this.closeConfirm());
    this.confirmOk.addEventListener('click', () => {
      const fn = this._confirm?.onOk;
      this.closeConfirm();
      if (fn) fn();
    });
    this.confirmOverlay.addEventListener('pointerdown', e => {
      if (e.target === this.confirmOverlay) this.closeConfirm();
    });
  }

  /* ---------- Ventana de atajos ---------- */

  openKeys() {
    if (this._moveActive()) {
      this._toast('Termina de mover el edificio primero');
      return;
    }
    if (this._blocked() || this._keysOpen || this._confirmOpen) return;

    this._keysReturn = document.activeElement;
    this._keysOpen = true;
    this._capturing = null;
    this._pauseWorld();
    this.renderKeys();
    this.keysOverlay.classList.add('open');
    this.keysClose.focus();
  }

  closeKeys() {
    if (!this._keysOpen) return;
    this._keysOpen = false;
    this._capturing = null;
    this.keysOverlay.classList.remove('open');
    this._focusBack(this._keysReturn, this.settingsBtn);
    this._keysReturn = null;
  }

  renderKeys(focusId = null) {
    const sc = this.shortcuts;
    const bindings = sc?.bindings || Object.fromEntries(SHORTCUT_ACTIONS.map(a => [a.id, a.def]));
    const labelOf = code => (sc && typeof sc.codeLabel === 'function' ? sc.codeLabel(code) : basicLabel(code));
    const act = SHORTCUT_ACTIONS.find(a => a.id === this._capturing);
    this.keysSub.textContent = this._capturing && act
      ? `Pulsa la nueva tecla para «${act.label}». Esc cancela.`
      : KEYS_HELP;

    const frag = document.createDocumentFragment();
    for (const group of SHORTCUT_GROUPS) {
      const box = document.createElement('div');
      box.className = 'stat kb-group';
      const title = document.createElement('div');
      title.className = 'army-label';
      title.textContent = group.title;
      box.appendChild(title);

      for (const action of SHORTCUT_ACTIONS.filter(a => a.ctx === group.ctx)) {
        const code = bindings[action.id] || null;
        const label = code ? labelOf(code) : '—';
        const on = this._capturing === action.id;
        const row = document.createElement('div');
        row.className = 'kb-row';
        const name = document.createElement('span');
        name.className = 'kb-label';
        name.textContent = action.label;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `action-btn kb-key${on ? ' gold' : ''}`;
        btn.dataset.action = action.id;
        btn.textContent = on ? 'Pulsa una tecla…' : label;
        btn.setAttribute('aria-label', `Reasignar tecla de ${action.label}; actual: ${label}`);
        row.append(name, btn);
        box.appendChild(row);
      }
      frag.appendChild(box);
    }
    this.keysList.replaceChildren(frag);

    if (focusId) {
      const target = [...this.keysList.querySelectorAll('[data-action]')]
        .find(btn => btn.dataset.action === focusId);
      target?.focus();
    }
  }

  startCapture(id) {
    if (!SHORTCUT_ACTIONS.some(a => a.id === id)) return;
    // Pulsar dos veces la misma fila cancela la captura (como en el legacy).
    this._capturing = this._capturing === id ? null : id;
    this.renderKeys(id);
  }

  stopCapture() {
    const id = this._capturing;
    this._capturing = null;
    this.renderKeys(id);
  }

  /* ---------- Confirmación reutilizable ---------- */

  openConfirm(options = {}) {
    const { title = '', text = '', okLabel = 'Aceptar', cancelLabel = 'Cancelar',
      onOk, stillValid } = options || {};
    if (this._blocked() || this._keysOpen || this._confirmOpen) return;

    this._confirmReturn = document.activeElement;
    this._confirmOpen = true;
    this._confirm = {
      onOk: typeof onOk === 'function' ? onOk : null,
      stillValid: typeof stillValid === 'function' ? stillValid : null,
      timer: 0,
    };
    this.confirmTitle.textContent = title ?? '';
    this.confirmText.textContent = text ?? '';
    this.confirmOk.textContent = okLabel;
    this.confirmCancel.textContent = cancelLabel;
    this._pauseWorld();
    this.confirmOverlay.classList.add('open');
    this.confirmCancel.focus();

    clearInterval(this._confirm.timer);
    this._confirm.timer = setInterval(() => {
      const valid = this._confirm?.stillValid;
      if (!valid) return;
      let ok = true;
      try { ok = valid(); } catch { ok = false; }
      if (!ok) this.closeConfirm();
    }, 250);
  }

  closeConfirm() {
    if (!this._confirmOpen) return;
    this._confirmOpen = false;
    if (this._confirm) clearInterval(this._confirm.timer);
    this._confirm = null;
    this.confirmOverlay.classList.remove('open');
    this._focusBack(this._confirmReturn, this.settingsBtn);
    this._confirmReturn = null;
  }

  /* ---------- Teclado: un oyente en fase de captura ---------- */

  bindCapture() {
    if (this._bound || typeof window === 'undefined') return;
    this._bound = true;
    window.addEventListener('keydown', event => {
      if (this._keysOpen) {
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

        if (this._capturing) {
          if (typeof event.preventDefault === 'function') event.preventDefault();
          if (event.repeat || isModifierCode(event.code || '')) return;
          if (event.code === 'Escape' || event.key === 'Escape') {
            this.stopCapture();
            return;
          }
          this.shortcuts?.assignKey?.(this._capturing, event);
          return;
        }

        if (event.code === 'Escape' || event.key === 'Escape') {
          event.preventDefault?.();
          this.closeKeys();
        } else if (event.code === 'Tab' || event.key === 'Tab') {
          this.trapTab(event, [...this.keysPanel.querySelectorAll('button')]);
        }
        return;
      }

      if (this._confirmOpen) {
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        if (event.code === 'Escape' || event.key === 'Escape') {
          event.preventDefault?.();
          this.closeConfirm();
        } else if (event.code === 'Tab' || event.key === 'Tab') {
          this.trapTab(event, [this.confirmCancel, this.confirmOk].filter(Boolean));
        }
      }
      // Sin overlay: ShortcutController.handleKeydown se encarga de los atajos.
    }, true);
  }

  trapTab(event, items) {
    if (!items.length) return;
    if (typeof event.preventDefault === 'function') event.preventDefault();
    const i = items.indexOf(document.activeElement);
    const next = event.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i + 1) % items.length;
    items[next]?.focus();
  }

  /* ---------- Pistas y rueda horizontal del menú Construir ---------- */

  refreshHints() {
    this.shortcuts?.refreshHints?.();
  }

  bindBuildWheel() {
    if (this._wheelBound) return;
    const items = document.getElementById('build-items');
    if (!items) return;
    this._wheelBound = true;
    items.addEventListener('wheel', e => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!d) return;
      e.preventDefault();
      // Líneas / páginas / píxeles, igual que en 23-atajos.js.
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? items.clientWidth : 1;
      items.scrollLeft += d * unit;
    }, { passive: false });
  }

  /* ---------- Auxiliares ---------- */

  _blocked() {
    const sc = this.shortcuts;
    if (sc && typeof sc.overlaysOpen === 'function') return sc.overlaysOpen();
    const ui = sc?.ui || {};
    const move = sc?.move || {};
    const active = typeof move.active === 'function' ? move.active() : move.active;
    return Boolean(active || ui.infoUI?.open || ui.infoOpen || this._keysOpen || this._confirmOpen);
  }

  _moveActive() {
    const move = this.shortcuts?.move || this.shortcuts?.deps?.move;
    if (!move) return false;
    return Boolean(typeof move.active === 'function' ? move.active() : move.active);
  }

  _pauseWorld() {
    const canvas = document.querySelector('#game canvas');
    canvas?.classList.remove('dragging');
    const sc = this.shortcuts;
    const cam = sc?.ui?.cameraController || sc?.deps?.camera || sc?.ui?.camera;
    if (typeof cam?.clearKeys === 'function') cam.clearKeys();
    else if (cam?.camKeys?.clear) cam.camKeys.clear();
    else if (sc?.ui?.camKeys?.clear) sc.ui.camKeys.clear();
  }

  _focusBack(previous, fallback) {
    const usable = el => el && typeof el.focus === 'function' && el !== document.body &&
      (el.isConnected || document.contains(el)) && !el.hidden && !isEditable(el);
    const target = usable(previous) ? previous : fallback;
    if (target && typeof target.focus === 'function' && !isEditable(target)) target.focus();
  }

  _toast(text) {
    const fn = this.deps.showToast || this.shortcuts?.deps?.showToast || this.shortcuts?.ui?.showToast;
    if (typeof fn === 'function') fn(text);
  }
}
