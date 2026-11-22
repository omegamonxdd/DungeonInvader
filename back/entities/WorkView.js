/* ==========================================================
 * FASE 9 — ANDAMIOS Y BARRA DE PROGRESO DE LAS OBRAS
 * ----------------------------------------------------------
 * Equivalente a drawWorkSite()/drawWorkLayer() del legacy, dibujado
 * con Graphics de Phaser en coordenadas del mundo. La barra y las
 * etiquetas se escalan por 1/zoom para conservar su tamaño en pantalla.
 * ========================================================== */

import { iso } from '../systems/iso.js';
import { COLORS, hexToInt } from '../config/palette.js';
import { CORE_HEIGHT, DIRT_HEIGHT, SCALE } from '../config/world.js';
import { OVERLAY_DEPTH } from '../config/interaction.js';
import { fmtDur } from '../systems/WorkController.js';

const SITE = { top: '#a98760', left: '#7d5d3a', right: '#5d4329' };
const TEXT_STYLE = {
  fontFamily: '"Pixel Digitos", "Courier New", monospace',
  fontSize: '12px',
  fontStyle: 'bold',
  stroke: '#0b0b0b',
  strokeThickness: 3,
};

export class WorkView {
  constructor(scene) {
    this.scene = scene;
    this.entries = new Map();
  }

  // Crea/destruye los objetos de cada obra; solo toca el DOM de Phaser si el
  // conjunto cambia, para no recrear textos 60 veces por segundo.
  sync(jobs) {
    const ids = new Set(jobs.map(j => j.id));
    for (const [id, entry] of this.entries) {
      if (ids.has(id)) continue;
      entry.g.destroy();
      entry.label.destroy();
      entry.time.destroy();
      this.entries.delete(id);
    }
    for (const job of jobs) {
      if (this.entries.has(job.id)) continue;
      const depth = OVERLAY_DEPTH + 20;
      const g = this.scene.add.graphics().setDepth(depth);
      const label = this.scene.add.text(0, 0, '', { ...TEXT_STYLE, color: '#ffd54a' })
        .setOrigin(0.5).setDepth(depth + 0.01);
      const time = this.scene.add.text(0, 0, '', { ...TEXT_STYLE, color: '#ffffff' })
        .setOrigin(0.5).setDepth(depth + 0.01);
      this.entries.set(job.id, { g, label, time });
    }
  }

  beam(g, a, b, width) {
    g.lineStyle(width + 3, hexToInt(COLORS.wood.dark), 1);
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.strokePath();

    g.lineStyle(width, hexToInt(COLORS.wood.body), 1);
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.strokePath();

    g.lineStyle(Math.max(1, width * 0.2), hexToInt(COLORS.wood.light), 0.6);
    g.beginPath();
    g.moveTo(a.x - width * 0.22, a.y);
    g.lineTo(b.x - width * 0.22, b.y);
    g.strokePath();
  }

  heightOf(def) {
    if (def.kind === 'core') return CORE_HEIGHT;
    if (def.kind === 'entrance') return DIRT_HEIGHT * 0.8;
    return def.height || 30;
  }

  update(jobs) {
    // Un edificio guardado por el editor (o levantado por el modo Mover) no
    // dibuja andamios en su casilla anterior: la obra sigue, pero el soporte
    // aparece de nuevo al colocarlo en su sitio definitivo.
    const visible = jobs.filter(j => j.def && !j.def.shelved && j.def.placed !== false);
    this.sync(visible);
    const zoom = this.scene.cameras.main.zoom || 1;
    const k = 1 / zoom; // 1 px de pantalla = k px del mundo

    for (const job of visible) {
      const entry = this.entries.get(job.id);
      const def = job.def;
      const n = def.w || def.size || 1;
      const m = def.h || def.size || 1;
      const H = this.heightOf(def);
      const g = entry.g;
      g.clear();

      const cells = [
        [def.x, def.y], [def.x + n, def.y],
        [def.x + n, def.y + m], [def.x, def.y + m],
      ];
      const lo = cells.map(c => iso(c[0], c[1], 0));
      const hi = cells.map(c => iso(c[0], c[1], H));

      // Obra inicial: cimientos que crecen hasta la altura definitiva.
      if (job.work.kind === 'build') {
        const z = 4 + (H - 8) * job.frac;
        const top = cells.map(c => iso(c[0], c[1], z));
        g.fillStyle(hexToInt(SITE.left), 1);
        g.fillPoints([top[1], top[2], lo[2], lo[1]], true);
        g.fillStyle(hexToInt(SITE.right), 1);
        g.fillPoints([top[2], top[3], lo[3], lo[2]], true);
        g.fillStyle(hexToInt(SITE.top), 1);
        g.fillPoints(top, true);
      }

      // Cuatro postes y vigas superiores, como drawScaffold() del legacy.
      const postW = 4 * SCALE;
      for (let i = 0; i < 4; i++) {
        this.beam(g, lo[i], hi[i], postW);
        this.beam(g, hi[i], hi[(i + 1) % 4], postW * 0.8);
      }

      // Barra de progreso y tiempo restante sobre el andamio.
      const cx = def.x + n / 2;
      const cy = def.y + m / 2;
      const anchor = iso(cx, cy, H + 34 * k);
      const w = 84 * k;
      const h = 12 * k;
      const x0 = anchor.x - w / 2;
      const y0 = anchor.y - h / 2;
      const filled = w * job.frac;
      g.fillStyle(0x0b0b0b, 1).fillRect(x0 - 2 * k, y0 - 2 * k, w + 4 * k, h + 4 * k);
      g.fillStyle(0x2a2a2a, 1).fillRect(x0, y0, w, h);
      g.fillStyle(0xe0a02c, 1).fillRect(x0, y0, filled, h);
      g.fillStyle(0xffd873, 1).fillRect(x0, y0, filled, 4 * k);

      entry.label
        .setText(job.work.kind === 'build' ? 'Construyendo' : `Mejorando · Nv ${job.work.to}`)
        .setPosition(anchor.x, y0 - 10 * k)
        .setScale(k);
      entry.time
        .setText(fmtDur(job.left))
        .setPosition(anchor.x, y0 + h / 2)
        .setScale(k);
    }
  }

  destroy() {
    for (const entry of this.entries.values()) {
      entry.g.destroy();
      entry.label.destroy();
      entry.time.destroy();
    }
    this.entries.clear();
  }
}
