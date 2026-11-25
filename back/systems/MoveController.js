import { HALF_H, HALF_W, SCALE } from '../config/world.js';
import {
  FLOAT_LIFT, INTERACTION_COLORS, OVERLAY_DEPTH,
} from '../config/interaction.js';
import { iso } from './iso.js';
import { CORE, EMPTY, heightAt } from './map.js';
import { drawRangeRing } from './rangeRing.js';

/* Modo Mover, portado de js/world/07-modo-mover.js.
 * La estructura se "levanta" (sus casillas dejan de estar ocupadas), una copia
 * flotante sigue al cursor sobre una huella verde/roja y el clic confirma.
 * Clic derecho o Esc cancelan y devuelven la estructura a su sitio.
 */
export class MoveController {
  constructor(scene, structures, terrain, cameraController, onFinish, canCommit = null) {
    this.scene = scene;
    this.structures = structures;
    this.terrain = terrain;
    this.camera = cameraController;
    this.onFinish = onFinish;
    // Fase 9: permite cobrar la obra/comprobar constructores justo antes de
    // confirmar. Devuelve false para dejar la copia siguiendo al cursor.
    this.canCommit = canCommit;

    this.active = false;
    this.id = null;
    this.def = null;
    this.isNew = false;
    this.fromStore = false;
    this.g = scene.add.graphics().setDepth(OVERLAY_DEPTH);

    this.x = 0; this.y = 0;
    this.gx = 0; this.gy = 0;
    this.valid = true;
    this.pressing = false;
    this.hasCursor = false;
    this.cursor = { x: 0, y: 0 };
    this.lastT = 0;
  }

  // `fromStore` = se coloca un edificio guardado por el editor: es "nuevo"
  // para el cursor, pero no cobra, no inicia obra y no se borra al cancelar.
  start(id, isNew = false, fromStore = false) {
    const def = this.structures.find(d => d.id === id);
    if (!def || !def.movable || this.active) return false;

    this.id = id;
    this.def = def;
    this.isNew = isNew;
    this.fromStore = fromStore;
    this.origX = def.x;
    this.origY = def.y;
    this.x = def.x; this.y = def.y;
    this.gx = def.x; this.gy = def.y;
    this.valid = true;
    this.pressing = false;
    this.hasCursor = false;
    this.lastT = 0;
    this.active = true;

    // Al levantarla, su huella vuelve a ser suelo despejado.
    if (def.kind === 'core') this._setCoreFootprint(def.x, def.y, false);
    else this.terrain.setFootprint(def.x, def.y, def.size, def.size, false);
    def.placed = false;
    def.moving = true;
    def.view?.setHidden?.(false);
    this.g.setVisible(true);

    if (isNew) {
      const s = this.scene.scale;
      this.setCursor(s.width / 2, s.height / 2);
      this.gx = this.x; this.gy = this.y;
    }
    return true;
  }

  // El centro del edificio a media altura queda bajo el cursor.
  updateTarget(sx, sy) {
    if (!this.def) return;
    const w = this.camera.screenToWorld(sx, sy);
    const a = w.x / HALF_W;
    const b = (w.y + this.def.height / 2) / HALF_H;
    this.x = Math.round((a + b) / 2 - this.def.size / 2);
    this.y = Math.round((b - a) / 2 - this.def.size / 2);
    this.valid = this.terrain.footprintFree(this.def.size, this.x, this.y);
  }

  setCursor(sx, sy) {
    this.cursor.x = sx;
    this.cursor.y = sy;
    this.hasCursor = true;
    this.updateTarget(sx, sy);
  }

  onPointerDown(pointer) {
    if (!this.active) return;
    if (pointer.button === 2) { this.cancel(); return; }
    if (pointer.button !== 0) return;      // el central no cancela (legacy)
    this.setCursor(pointer.x, pointer.y);
    this.pressing = true;
  }

  onPointerUp(pointer, allowClick = true) {
    if (!this.active) return;
    const place = allowClick && pointer.button === 0 && this.pressing;
    this.pressing = false;
    if (!place) return;
    this.setCursor(pointer.x, pointer.y);
    if (this.valid && (!this.canCommit || this.canCommit(this.def))) this.commit();
    // Si no es válido o no se puede pagar, la copia sigue pegada al cursor.
  }

  // El núcleo ocupa celdas CORE en el mapa además de la huella ocupada.
  _setCoreFootprint(x, y, on) {
    const n = this.def?.size || 3;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const cx = x + i, cy = y + j;
        if (!this.terrain.inBounds(cx, cy)) continue;
        if (on) this.terrain.map[cy][cx] = CORE;
        else if (this.terrain.map[cy][cx] === CORE) this.terrain.map[cy][cx] = EMPTY;
        // Los bloques del núcleo son teselas del terreno, no de la vista de
        // la estructura. Sin refrescarlas, la textura se queda en la casilla
        // anterior y se acumula una copia cada vez que se recoloca el núcleo.
        this.scene?.terrainView?.refresh?.(cx, cy);
      }
    }
    this.terrain.setFootprint(x, y, n, n, on);
    this.terrain.coreShelved = !on;
  }

  cancel() { this.finish(false); }

  commit() { this.finish(true); }

  finish(commit) {
    if (!this.active) return;
    const def = this.def;
    const nx = commit ? this.x : this.origX;
    const ny = commit ? this.y : this.origY;

    const fresh = this.isNew && !this.fromStore;
    if (fresh && !commit) {
      // Un edificio nuevo descartado no se cobra ni se queda en el registro.
      def.view?.destroy();
      const i = this.structures.indexOf(def);
      if (i >= 0) this.structures.splice(i, 1);
    } else {
      def.x = nx;
      def.y = ny;
      def.depth = nx + ny + def.size;
      if (def.view) {
        def.view.x = nx;
        def.view.y = ny;
      }
      def.placed = true;
      def.moving = false;
      def.shelved = false;
      if (def.kind === 'core') this._setCoreFootprint(nx, ny, true);
      else this.terrain.setFootprint(nx, ny, def.size, def.size, true);
      def.view?.clearFloating?.();
    }

    this.g.clear().setVisible(false);
    const finished = { id: def.id, def, commit, isNew: this.isNew, fromStore: this.fromStore };
    this.active = false;
    this.id = null;
    this.def = null;
    this.pressing = false;
    this.hasCursor = false;
    this.terrain.pathValid = this.terrain.isCoreReachable();
    if (this.onFinish) this.onFinish(finished);
  }

  update(time, deltaMs) {
    if (!this.active) return;
    if (this.hasCursor) this.updateTarget(this.cursor.x, this.cursor.y);
    const dt = this.lastT ? Math.min(64, time - this.lastT) : 16;
    this.lastT = time;
    const k = 1 - Math.exp(-dt / 55);
    this.gx += (this.x - this.gx) * k;
    this.gy += (this.y - this.gy) * k;
    this.draw(time);
  }

  drawRange(cx, cy, radius, zoom, innerRadius = 0) {
    drawRangeRing(this.g, cx, cy, radius, zoom, innerRadius);
  }

  draw(time) {
    const g = this.g;
    const def = this.def;
    const n = def.size;
    const zoom = this.scene.cameras.main.zoom;
    g.clear();

    // Sombras de validación, una por casilla de la huella.
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = this.x + i;
        const y = this.y + j;
        const h = this.terrain.inBounds(x, y) ? heightAt(this.terrain.map, x, y) : 0;
        const pts = [iso(x, y, h), iso(x + 1, y, h), iso(x + 1, y + 1, h), iso(x, y + 1, h)];
        const free = this.terrain.cellIsFree(x, y);
        const color = this.valid ? INTERACTION_COLORS.dig
          : (free ? INTERACTION_COLORS.invalidFree : INTERACTION_COLORS.invalidBusy);
        g.fillStyle(color, this.valid ? 0.60 : (free ? 0.45 : 0.75));
        g.fillPoints(pts, true);
        g.lineStyle(2 / zoom, this.valid ? INTERACTION_COLORS.digEdge : INTERACTION_COLORS.invalidEdge, 1);
        g.beginPath();
        g.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length; k++) g.lineTo(pts[k].x, pts[k].y);
        g.closePath();
        g.strokePath();
      }
    }

    // La catapulta deja sin teñir su zona muerta: solo se resalta el anillo
    // donde el mortero puede disparar. La bomba sigue mostrando sus dos radios.
    const cx = this.gx + n / 2;
    const cy = this.gy + n / 2;
    if (def.act) this.drawRange(cx, cy, def.act, zoom);
    if (def.range) this.drawRange(cx, cy, def.range, zoom, def.minRange || 0);

    const lift = FLOAT_LIFT + Math.sin(time / 320) * 2 * SCALE;
    def.view?.setFloating?.(this.gx, this.gy, lift, time);

    // Contorno del techo con el color de validación.
    const z = def.height + lift;
    const roof = [
      iso(this.gx, this.gy, z), iso(this.gx + n, this.gy, z),
      iso(this.gx + n, this.gy + n, z), iso(this.gx, this.gy + n, z),
    ];
    g.lineStyle(3 / zoom, this.valid ? INTERACTION_COLORS.validOutline : INTERACTION_COLORS.invalidOutline, 0.95);
    g.beginPath();
    g.moveTo(roof[0].x, roof[0].y);
    for (let k = 1; k < roof.length; k++) g.lineTo(roof[k].x, roof[k].y);
    g.closePath();
    g.strokePath();
  }
}
