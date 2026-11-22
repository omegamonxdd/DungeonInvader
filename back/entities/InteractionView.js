import Phaser from 'phaser';
import { iso } from '../systems/iso.js';
import { heightAt } from '../systems/map.js';
import { footprintPoly } from '../systems/picking.js';
import { INTERACTION_COLORS, OVERLAY_DEPTH } from '../config/interaction.js';
import { drawRangeRing } from '../systems/rangeRing.js';

/* Resaltados de interacción. Se dibuja por encima del mundo, igual que el
 * resaltado del legacy (04-render.js) y la copia del modo Mover (07).
 */
export class InteractionView {
  constructor(scene) {
    this.scene = scene;
    this.g = scene.add.graphics().setDepth(OVERLAY_DEPTH);
    this.selection = null;
    this.hoverStructure = null;
    this.toolCell = null;
    this.zoom = -1;
  }

  setSelection(def) { this.selection = def || null; this.zoom = -1; }

  setHoverStructure(def) { this.hoverStructure = def || null; this.zoom = -1; }

  setToolCell(cell) { this.toolCell = cell || null; this.zoom = -1; }

  outline(poly, color, alpha, width) {
    const g = this.g;
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) g.lineTo(poly[i].x, poly[i].y);
    g.closePath();
    g.strokePath();
  }

  // Anillo isométrico con guionaje manual (Phaser Graphics no tiene
  // setLineDash). Con `innerRadius` se deja sin teñir la zona muerta.
  rangeRing(cx, cy, radius, innerRadius = 0) {
    drawRangeRing(this.g, cx, cy, radius, this.zoom, innerRadius);
  }

  drawSelection() {
    const def = this.selection;
    if (!def) return;
    const poly = footprintPoly(def.x, def.y, def.w, def.h);
    this.g.fillStyle(INTERACTION_COLORS.selection, 0.10);
    this.g.fillPoints(poly, true);
    this.outline(poly, INTERACTION_COLORS.selection, 0.95, 2 / this.zoom);
    if (def.range) this.rangeRing(def.x + def.w / 2, def.y + def.h / 2, def.range, def.minRange || 0);
  }

  drawHover() {
    const def = this.hoverStructure;
    if (!def || def === this.selection) return;
    this.outline(footprintPoly(def.x, def.y, def.w, def.h), INTERACTION_COLORS.selection, 0.45, 1.5 / this.zoom);
  }

  drawToolHover(map) {
    const cell = this.toolCell;
    if (!cell) return;
    const h = heightAt(map, cell.x, cell.y);
    const c0 = iso(cell.x, cell.y, h);
    const poly = [
      c0,
      iso(cell.x + 1, cell.y, h),
      iso(cell.x + 1, cell.y + 1, h),
      iso(cell.x, cell.y + 1, h),
    ];
    let color = INTERACTION_COLORS.dig;
    let edge = INTERACTION_COLORS.digEdge;
    if (this.tool === 'fill') { color = INTERACTION_COLORS.fill; edge = INTERACTION_COLORS.fillEdge; }
    if (!this.toolValid) { color = INTERACTION_COLORS.invalidFree; edge = INTERACTION_COLORS.invalidEdge; }
    this.g.fillStyle(color, 0.32);
    this.g.fillPoints(poly, true);
    this.outline(poly, edge, 0.9, 2 / this.zoom);
  }

  setToolState(tool, valid) {
    this.tool = tool;
    this.toolValid = valid;
    this.zoom = -1;
  }

  update() {
    const z = this.scene.cameras.main.zoom;
    if (z === this.zoom) return;
    this.zoom = z;
    this.g.clear();
    this.drawSelection();
    this.drawHover();
    if (this.toolCell) this.drawToolHover(this.scene.terrain.map);
  }
}
