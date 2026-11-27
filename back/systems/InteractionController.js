import { CLICK_TOLERANCE } from '../config/interaction.js';
import { keyCodeOf } from './keyboard.js';
import { pickCell, structureAt } from './picking.js';

const CAMERA_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/* Enrutamiento de puntero y teclado, equivalente a js/world/05-controles.js
 * y a las partes de atajos que afectan a la escena (07-modo-mover.js, 23).
 * Fase 7: la UI DOM/CSS se conecta por `deps.ui` (Escape cierra primero el
 * modal; E y las pestañas los gestiona la propia interfaz).
 */
export class InteractionController {
  constructor(scene, deps) {
    this.scene = scene;
    this.terrain = deps.terrain;
    this.structures = deps.structures;
    this.camera = deps.camera;
    this.move = deps.move;
    this.view = deps.view;
    this.invasion = deps.invasion || null;
    this.editor = deps.editor || null;
    this.shortcuts = deps.shortcuts || null;
    this.shortcutsUI = deps.shortcutsUI || null;
    this.select = deps.select;
    this.placeNew = deps.placeNew;
    this.onCellChanged = deps.onCellChanged;
    this.ui = deps.ui || null;
    this.upgrades = deps.upgrades || null;

    this.pointerDown = false;
    this.mode = null;               // 'click' | 'pan' | 'tool'
    this.touchSelect = false;       // móvil: arrastrar = seleccionar tropas
    this.moved = false;
    this.lastTap = null;            // para el doble tap (seleccionar ejército)
    this.downX = 0; this.downY = 0;
    this.lastX = 0; this.lastY = 0;
    this.lastCell = null;

    this.bind();
  }

  screenCell(sx, sy) {
    const w = this.camera.screenToWorld(sx, sy);
    return pickCell(this.terrain.map, w.x, w.y);
  }

  /** Botón móvil «Select»: invierte arrastrar-cámara / recuadro de tropas. */
  toggleTouchSelect() {
    this.touchSelect = !this.touchSelect;
    return this.touchSelect;
  }

  /** Un pellizco cancela el arrastre que pudiera haber empezado un dedo. */
  cancelPointer() {
    if (!this.pointerDown) return;
    this.pointerDown = false;
    this.mode = null;
    this.ui?.setSelectBox?.(0, 0, 0, 0, false);
    this.view?.setHoverStructure?.(null);
  }

  useToolAlong(x0, y0, x1, y1) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const cell = this.screenCell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      if (!cell || (this.lastCell && cell.x === this.lastCell.x && cell.y === this.lastCell.y)) continue;
      this.lastCell = cell;
      if (this.terrain.applyCell(cell) && this.onCellChanged) this.onCellChanged(cell);
      this.view.setToolState(this.terrain.tool, true);
      this.view.setToolCell(this.terrain.hover);
      if (!this.terrain.tool) break;
    }
  }

  /* Modificadores: los atajos configurables ya los ignoran, pero la cámara
   * lee las teclas WASD directamente y el navegador tiene sus propios atajos.
   * Este oyente en fase de captura deja el teclado con modificador fuera del
   * juego, salvo Ctrl+A durante la invasión (que es selección de tropas). */
  onModifierKey(e) {
    const code = keyCodeOf(e);
    const overlays = this.shortcutsUI?.keysOpen || this.shortcutsUI?.confirmOpen ||
      this.shortcuts?.overlaysOpen?.();
    if (overlays) return;

    if ((e.ctrlKey || e.metaKey) && code === 'KeyA' &&
        this.invasion?.active && !this.invasion.over) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.invasion.selectAll();
      return;
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey) return;
    const target = e.target;
    if (target && (target.isContentEditable ||
        /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || ''))) return;
    if (this.shortcuts?.isGameKey?.(code) || CAMERA_KEYS.has(code)) e.preventDefault();
  }

  bind() {
    const input = this.scene.input;

    // El legacy desactivaba el menú contextual en el canvas (07-modo-mover.js:221).
    // Sin esto, el clic derecho manda la orden Y abre el menú del navegador.
    const surface = document.getElementById('game') || this.scene.game.canvas;
    if (surface) {
      surface.addEventListener('contextmenu', e => e.preventDefault());
      // El clic central es cámara: evita el autoscroll del navegador.
      surface.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });
    }
    // Fase de captura: Ctrl+A se resuelve aquí para que no llegue ni a la
    // cámara (que vería la A pulsada) ni al "seleccionar todo" del navegador.
    window.addEventListener('keydown', e => this.onModifierKey(e), true);

    // Doble clic: centra la cámara solo sin herramienta ni movimiento
    // (07-modo-mover.js:236 usa el evento dblclick del canvas).
    this.scene.game.canvas.addEventListener('dblclick', () => {
      if (!this.invasion?.active && !this.terrain.tool && !this.move.active) this.camera.centerOnCore();
    });

    input.on('pointerdown', p => {
      if (this.move.active) { this.move.onPointerDown(p); return; }
      if (p.button > 2) return;

      // Fase 11: "Recoger" del editor consume el clic para guardar la
      // estructura bajo el cursor; no selecciona ni desplaza la cámara.
      if (this.editor?.active && this.editor.picking && p.button === 0 && !this.terrain.tool) {
        this.pointerDown = true;
        this.downX = this.lastX = p.x;
        this.downY = this.lastY = p.y;
        this.mode = 'editor-pick';
        return;
      }
      this.pointerDown = true;
      this.moved = false;
      this.downX = this.lastX = p.x;
      this.downY = this.lastY = p.y;

      // Fase 8: durante la invasión el botón izq. selecciona tropas (o dibuja
      // un cuadro), el der. da órdenes y el central sigue paneando. En móvil,
      // el botón «Select» invierte esto: por defecto se arrastra la cámara.
      if (this.invasion?.active && !this.invasion.over) {
        if (p.button === 0) {
          this.mode = this.touchSelect ? 'inv-select' : 'pan';
          this.invasion.clearOrderPreview();
        } else {
          this.mode = p.button === 2 ? 'inv-order' : 'pan';
          if (p.button === 2) {
            const w = this.camera.screenToWorld(p.x, p.y);
            this.invasion.orderAtWorld(w.x, w.y);
          } else {
            this.invasion.clearOrderPreview();
          }
        }
        return;
      }

      if (p.button === 0 && this.terrain.tool) {
        this.mode = 'tool';
        this.lastCell = null;
        this.useToolAlong(p.x, p.y, p.x, p.y);
      } else if (p.button === 0) {
        this.mode = 'click';
      } else {
        this.mode = 'pan';
      }
    });

    input.on('pointermove', p => {
      if (this.move.active) { this.move.setCursor(p.x, p.y); return; }

      if (!this.pointerDown) {
        if (this.invasion?.active && !this.invasion.over) {
          this.view.setHoverStructure(null);
          // Previsualizar hacia dónde irán las tropas seleccionadas: retícula
          // roja sobre estructuras atacables, casilla verde sobre el suelo.
          const w = this.camera.screenToWorld(p.x, p.y);
          this.invasion.setOrderPreview(w.x, w.y);
          return;
        }
        if (this.terrain.tool) {
          this.terrain.hover = this.screenCell(p.x, p.y);
          this.view.setToolState(this.terrain.tool, true);
          this.view.setToolCell(this.terrain.hover);
        } else {
          const w = this.camera.screenToWorld(p.x, p.y);
          // En vista invasor no hay hover ni selección de estructuras.
          const hidden = Boolean(this.editor?.active && this.editor.invaderView);
          this.view.setHoverStructure(hidden ? null : structureAt(w.x, w.y, this.structures));
        }
        return;
      }

      if (this.mode === 'tool') {
        this.useToolAlong(this.lastX, this.lastY, p.x, p.y);
        this.lastX = p.x;
        this.lastY = p.y;
        this.terrain.hover = this.screenCell(p.x, p.y);
        this.view.setToolCell(this.terrain.hover);
        return;
      }

      if (this.mode === 'inv-select') {
        const tol = p.pointerType === 'touch' ? 14 : CLICK_TOLERANCE;
        if (Math.hypot(p.x - this.downX, p.y - this.downY) < tol) return;
        this.mode = 'inv-box';
        this.moved = true;
      }
      if (this.mode === 'inv-box') {
        this.ui?.setSelectBox(this.downX, this.downY, p.x, p.y, true);
        return;
      }

      if (this.mode === 'click') {
        const tol = p.pointerType === 'touch' ? 14 : CLICK_TOLERANCE;
        if (Math.hypot(p.x - this.downX, p.y - this.downY) < tol) return;
        this.mode = 'pan';
        this.moved = true;
        this.view.setHoverStructure(null);
      }

      if (this.mode === 'pan') {
        if (!this.moved) {
          const tol = p.pointerType === 'touch' ? 14 : CLICK_TOLERANCE;
          if (Math.hypot(p.x - this.downX, p.y - this.downY) >= tol) this.moved = true;
        }
        this.camera.panBy(p.x - this.lastX, p.y - this.lastY);
        this.lastX = p.x;
        this.lastY = p.y;
      }
    });

    const end = (p, allowClick) => {
      if (this.move.active) { this.move.onPointerUp(p, allowClick); return; }
      if (!this.pointerDown) return;
      const mode = this.mode;
      this.pointerDown = false;
      this.mode = null;
      if (this.invasion?.active && !this.invasion.over) {
        const now = Date.now();
        const isTap = allowClick && !this.moved
          && mode !== 'inv-box' && mode !== 'inv-order' && mode !== 'pan';
        const prev = this.lastTap;
        // Doble tap en el mismo sitio: selecciona todo el ejército.
        if (isTap && prev && now - prev.t < 320
          && Math.hypot(p.x - prev.x, p.y - prev.y) < 30) {
          this.invasion.selectAll();
          this.lastTap = null;
          return;
        }
        if (isTap) this.lastTap = { x: p.x, y: p.y, t: now };

        if (mode === 'inv-box') {
          this.ui?.setSelectBox(0, 0, 0, 0, false);
          if (allowClick) {
            this.invasion.selectBox({ x0: this.downX, y0: this.downY, x1: p.x, y1: p.y }, p.shiftKey);
          }
        } else if (isTap) {
          // Toque: tropa → seleccionar; edificio → atacar; suelo → mover.
          const w = this.camera.screenToWorld(p.x, p.y);
          this.invasion.tapAtWorld(w.x, w.y, p.shiftKey);
        }
        if (allowClick) {
          const w = this.camera.screenToWorld(p.x, p.y);
          this.invasion.setOrderPreview(w.x, w.y);
        }
        return;
      }
      if (allowClick && mode === 'editor-pick') {
        this.editor.pick(p.x, p.y);
        return;
      }
      if (allowClick && mode === 'click') {
        // Con el menú Construir abierto no se seleccionan edificios: sus
        // atajos (Z/X, 1-5) son los únicos que mandan en ese contexto.
        if (this.ui?.buildUI?.open) return;
        const w = this.camera.screenToWorld(p.x, p.y);
        const hidden = Boolean(this.editor?.active && this.editor.invaderView);
        this.select(hidden ? null : structureAt(w.x, w.y, this.structures));
      }
    };
    input.on('pointerup', p => end(p, true));
    input.on('pointerupoutside', p => end(p, false));
    input.on('gameout', () => {
      if (!this.pointerDown) this.view.setToolCell(null);
      this.invasion?.clearOrderPreview?.();
    });

    this.scene.input.keyboard.on('keydown', e => {
      const code = keyCodeOf(e);

      // Fase 11: una sola prioridad para Escape. Los atajos configurables
      // (Z/X/C/V/Q/E/1–5) los resuelve ShortcutController en MainScene.
      if (code === 'Escape') {
        if (this.shortcutsUI?.confirmOpen) { this.shortcutsUI.closeConfirm(); return; }
        if (this.shortcutsUI?.keysOpen) return; // lo cierra su propio overlay
        if (typeof window !== 'undefined' && window.__DUNGEON_AUTH_UI__?.isOpen) return;
        if (this.ui?.rivalPickerOpen) { this.ui.closeRivalPicker(); return; }
        if (this.editor?.baseSelectorOpen?.()) { this.editor.closeBaseSelector(); return; }
        if (this.upgrades?.close?.()) return;
        if (this.ui?.closePanel?.()) return;
        if (this.ui?.closeSummon?.()) return;
        if (this.invasion?.active && !this.invasion.over) {
          if (this.invasion.troops.some(t => t.selected)) this.invasion.clearTroopSelection();
          return;
        }
        if (this.move.active) { this.move.cancel(); return; }
        if (this.editor?.active && this.editor.handleEscape()) return;
        this.select(null);
        return;
      }

      // Ctrl+A ya se resolvió en onModifierKey; con modificador no hacemos
      // nada aquí para que la cámara ni los atajos reaccionen a la tecla.
      if (this.invasion?.active && !this.invasion.over) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (this.shortcuts?.overlaysOpen?.()) return;
    });
  }
}
