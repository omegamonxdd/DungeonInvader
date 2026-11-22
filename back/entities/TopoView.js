/* ==========================================================
 * FASE 11 — VISTA DE LOS TOPOS
 * ----------------------------------------------------------
 * Parte visual de js/world/21b-topos.js con sprites Phaser. Las
 * texturas se hornean una sola vez (topoArt.js); por frame solo se
 * mueven los sprites, la sombra elíptica y los puffs.
 *
 * La pausa la marca TopoController en las listas (`topos.paused`),
 * con redundancia de scene.editor / scene.invasion por si el llamador
 * pasa copias de las listas.
 * ========================================================== */

import Phaser from 'phaser';
import { BALANCE } from '../balance/index.js';
import { OVERLAY_DEPTH } from '../config/interaction.js';
import { iso } from '../systems/iso.js';
import {
  TOPO_ANCHOR, TOPO_DEPTH, TOPO_FADE_MS, TOPO_H, TOPO_PUFF_MS,
  TOPO_PX, TOPO_Q, TOPO_W, ensureTopoTextures, topoTextureKey,
} from './topoArt.js';

const ORIGIN_X = TOPO_ANCHOR.c / TOPO_W;
const ORIGIN_Y = TOPO_ANCHOR.r / TOPO_H;
const SPRITE_SCALE = TOPO_PX / TOPO_Q; // textura 4× → dibujo de ~1.5 px por celda de diseño
const PUFF_DEPTH = OVERLAY_DEPTH - 5;
const PUFF_COLOR = 0xd2e1f5;

export class TopoView {
  constructor(scene) {
    this.scene = scene;
    this.entries = new Map(); // id → { sprite, shadow }
    this.puffG = scene.add.graphics().setDepth(PUFF_DEPTH);
    this.smoothing = null;
    ensureTopoTextures(scene);
  }

  paused(topos, puffs) {
    return Boolean(topos?.paused || puffs?.paused
      || this.scene?.editor?.active
      || (this.scene?.invasion?.active && !BALANCE.topos.visiblesEnInvasion));
  }

  // Equivale a imageSmoothingEnabled del legacy: nítido al ampliar, suave al alejar.
  syncFilter() {
    const zoom = this.scene.cameras?.main?.zoom || 1;
    const dpr = globalThis.devicePixelRatio || 1;
    const smooth = zoom * dpr * TOPO_PX < TOPO_Q;
    if (smooth === this.smoothing) return;
    this.smoothing = smooth;
    const mode = smooth ? Phaser.Textures.FilterMode.LINEAR : Phaser.Textures.FilterMode.NEAREST;
    for (const type of ['normal', 'builder']) {
      this.scene.textures?.get(topoTextureKey(type))?.setFilter?.(mode);
    }
  }

  sync(topos) {
    const ids = new Set(topos.map(b => b?.id));
    for (const [id, entry] of this.entries) {
      if (ids.has(id)) continue;
      entry.sprite.destroy();
      entry.shadow.destroy();
      this.entries.delete(id);
    }
    for (const b of topos) {
      if (!b || this.entries.has(b.id)) continue;
      const sprite = this.scene.add.image(0, 0, topoTextureKey(b.type))
        .setOrigin(ORIGIN_X, ORIGIN_Y)
        .setScale(SPRITE_SCALE)
        .setDepth(TOPO_DEPTH)
        .setVisible(false);
      const shadow = this.scene.add.graphics().setDepth(TOPO_DEPTH).setVisible(false);
      this.entries.set(b.id, { sprite, shadow });
    }
  }

  drawTopo(entry, b, time) {
    const p = iso(b.x, b.y, 0);
    const walking = Boolean(b.path?.length);
    const swing = b.working ? Math.abs(Math.sin(time / 225)) : 0;
    const bob = walking
      ? Math.abs(Math.sin(b.anim)) * 2.2
      : b.working ? (1 - swing) * 1.5 : Math.sin(time / 600 + b.id) * 0.6;
    const tilt = b.working
      ? swing * 0.32 * b.face
      : walking ? Math.sin(b.anim) * 0.06 : 0;
    const alpha = Math.min(1, Math.max(0, (time - (b.born ?? 0)) / TOPO_FADE_MS));
    const depth = TOPO_DEPTH + (b.x + b.y) * 0.01;

    const shadow = entry.shadow;
    shadow.clear()
      .fillStyle(0x000000, 0.32 * alpha)
      .fillEllipse(p.x, p.y, 18, 9) // legacy: elipse de rx 9, ry 4.5
      .setDepth(depth)
      .setVisible(true);

    entry.sprite
      .setTexture(topoTextureKey(b.type))
      .setPosition(p.x, p.y - bob)
      .setRotation(tilt)
      .setFlipX((b.face ?? 1) < 0)
      .setAlpha(alpha)
      .setDepth(depth + 0.01)
      .setVisible(true);
  }

  drawPuffs(puffs, time) {
    const g = this.puffG;
    g.clear();
    for (const p of puffs || []) {
      const k = (time - p.t0) / TOPO_PUFF_MS;
      if (k < 0 || k > 1) continue;
      const c = iso(p.x, p.y, 4);
      const rx = 8 + 18 * k;
      const ry = 4.5 + 10 * k;
      g.fillStyle(PUFF_COLOR, 0.25 * (1 - k)).fillEllipse(c.x, c.y, rx * 2, ry * 2);
      g.lineStyle(2.5, PUFF_COLOR, 0.9 * (1 - k)).strokeEllipse(c.x, c.y, rx * 2, ry * 2);
    }
  }

  update(topos = [], puffs = [], time = this.scene?.time?.now ?? 0) {
    if (this.paused(topos, puffs)) {
      for (const entry of this.entries.values()) {
        entry.sprite.setVisible(false);
        entry.shadow.setVisible(false);
      }
      this.puffG.clear();
      return;
    }

    this.sync(topos);
    this.syncFilter();

    // Mismo orden por x+y del legacy, sin mutar la lista del controlador.
    const list = [...topos]
      .filter(b => b?.alive && !b.paused)
      .sort((a, b) => (a.x + a.y) - (b.x + b.y));
    const visible = new Set(list.map(b => b.id));
    for (const [id, entry] of this.entries) {
      if (visible.has(id)) continue;
      entry.sprite.setVisible(false);
      entry.shadow.setVisible(false);
    }
    for (const b of list) this.drawTopo(this.entries.get(b.id), b, time);
    this.drawPuffs(puffs, time);
  }

  destroy() {
    for (const entry of this.entries.values()) {
      entry.sprite.destroy();
      entry.shadow.destroy();
    }
    this.entries.clear();
    this.puffG.destroy();
    // Las texturas se comparten con el TextureManager: no se destruyen aquí.
  }
}
