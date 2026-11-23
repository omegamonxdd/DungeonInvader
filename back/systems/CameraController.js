import { iso } from './iso.js';
import { keyCodeOf } from './keyboard.js';

const CAM_KEY_RE = /^(KeyW|KeyA|KeyS|KeyD|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/;
import {
  CAM_DT_MAX, CAM_SPEED, CORE_HEIGHT, CORE_MIN, CORE_SIZE, DIRT_HEIGHT,
  FRAME_OFFSET_Y, INITIAL_ZOOM_FACTOR, WORLD, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP,
} from '../config/world.js';

/* Cámara del mundo.
 * Reproduce el comportamiento del legacy: zoom inicial ajustado al mapa,
 * paneo con WASD/flechas, zoom con la rueda centrado en el cursor y límites
 * del mapa. El estado se guarda como punto del mundo en el centro de la vista.
 */
export class CameraController {
  constructor(scene, deps = {}) {
    this.scene = scene;
    this.camera = scene.cameras.main;

    this.x = 0;
    this.y = 0;
    this.zoom = 1;

    // Como en el legacy (03-canvas-camara.js:112): solo se registra la tecla
    // si no hay modificador. Así Ctrl+A selecciona tropas SIN mover la cámara.
    this.keys = new Set();
    window.addEventListener('keydown', e => {
      const code = keyCodeOf(e);
      if (!CAM_KEY_RE.test(code) || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return;
      if (document.body.classList.contains('info-open') ||
          document.body.classList.contains('inv-end')) return;
      this.keys.add(code);
      if (code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', e => this.keys.delete(keyCodeOf(e)));
    window.addEventListener('blur', () => this.keys.clear());

    this.bindPointer();
    this.bindTouchZoom(deps);
  }

  /* Debe llamarse cuando el tamaño del lienzo ya es definitivo. */
  start() {
    this.initialZoom();
    this.centerCamera();
    this.apply();
  }

  get viewWidth() { return this.scene.scale.width; }
  get viewHeight() { return this.scene.scale.height; }

  initialZoom() {
    const mapPxW = WORLD.mapSize * WORLD.baseTileW;
    const mapPxH = WORLD.mapSize * WORLD.baseTileH + WORLD.baseCoreH;
    const fitted = Math.min(this.viewWidth / mapPxW, this.viewHeight / mapPxH) * INITIAL_ZOOM_FACTOR;
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, fitted));
  }

  centerCamera() {
    const c = iso(
      CORE_MIN + CORE_SIZE / 2,
      CORE_MIN + CORE_SIZE / 2,
      CORE_HEIGHT / 2,
    );
    this.x = c.x;
    this.y = c.y + FRAME_OFFSET_Y * this.viewHeight / this.zoom;
  }

  clamp() {
    const left = iso(0, WORLD.mapSize).x;
    const right = iso(WORLD.mapSize, 0).x;
    const top = iso(0, 0).y - DIRT_HEIGHT;
    const bottom = iso(WORLD.mapSize, WORLD.mapSize).y;

    this.x = Math.min(right, Math.max(left, this.x));
    this.y = Math.min(bottom, Math.max(top, this.y));
  }

  apply() {
    this.camera.setZoom(this.zoom);
    this.camera.centerOn(this.x, this.y);
  }

  screenToWorld(sx, sy) {
    return {
      x: this.x + (sx - this.viewWidth / 2) / this.zoom,
      y: this.y + (sy - this.viewHeight / 2) / this.zoom,
    };
  }

  // Paneo por ratón (clic derecho o central, o arrastre tras superar CLICK_TOLERANCE).
  panBy(dx, dy) {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
    this.clamp();
    this.apply();
  }

  centerOnCore() {
    this.centerCamera();
    this.apply();
  }

  bindPointer() {
    const input = this.scene.input;

    input.on('wheel', (pointer, over, deltaX, deltaY) => {
      const before = this.screenToWorld(pointer.x, pointer.y);
      const factor = deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.zoom * factor));
      if (next === this.zoom) return;

      this.zoom = next;
      this.x = before.x - (pointer.x - this.viewWidth / 2) / this.zoom;
      this.y = before.y - (pointer.y - this.viewHeight / 2) / this.zoom;
      this.clamp();
      this.apply();
    });
  }

  /** Zoom centrado en un punto de la pantalla (mismo criterio que la rueda). */
  zoomAt(factor, sx, sy) {
    const before = this.screenToWorld(sx, sy);
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.zoom * factor));
    if (next === this.zoom) return;
    this.zoom = next;
    this.x = before.x - (sx - this.viewWidth / 2) / this.zoom;
    this.y = before.y - (sy - this.viewHeight / 2) / this.zoom;
    this.clamp();
    this.apply();
  }

  /** Pellizco con dos dedos en móvil: la distancia entre dedos escala el zoom. */
  bindTouchZoom(deps) {
    const canvas = this.scene.game?.canvas;
    if (!canvas?.addEventListener) return;
    let lastDistance = 0;
    let pinching = false;

    const distance = e => {
      const [a, b] = e.touches;
      return a && b ? Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) : 0;
    };
    const center = e => {
      const rect = canvas.getBoundingClientRect();
      const [a, b] = e.touches;
      return {
        x: (a.clientX + b.clientX) / 2 - rect.left,
        y: (a.clientY + b.clientY) / 2 - rect.top,
      };
    };

    canvas.addEventListener('touchstart', e => {
      if (e.touches.length < 2) return;
      pinching = true;
      lastDistance = distance(e);
      deps.onPinchStart?.();
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      if (!pinching || e.touches.length < 2) return;
      e.preventDefault();
      const d = distance(e);
      if (lastDistance > 0 && d > 0) {
        const p = center(e);
        this.zoomAt(d / lastDistance, p.x, p.y);
      }
      lastDistance = d;
    }, { passive: false });

    const end = e => {
      if (e.touches.length >= 2) return;
      pinching = false;
      lastDistance = 0;
    };
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', end);
  }

  update(deltaMs) {
    // Fase 7: la ventana de Información/Mejorar pausa la cámara (como en el
    // legacy) para que WASD no mueva el mundo mientras se leen las stats.
    if (document.body.classList.contains('info-open') ||
        document.body.classList.contains('inv-end')) return;
    const dt = Math.min(CAM_DT_MAX, deltaMs / 1000);
    if (!dt) return;

    const k = this.keys;
    const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) -
      (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const ky = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) -
      (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (!kx && !ky) return;

    const speed = CAM_SPEED * dt / this.zoom;
    this.x += kx * speed;
    this.y += ky * speed;
    this.clamp();
    this.apply();
  }
}
