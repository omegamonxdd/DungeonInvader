/* ==========================================================
 * FASE 10 — VISTA GENÉRICA DE ESTRUCTURAS
 * ----------------------------------------------------------
 * Dibuja en Phaser todos los edificios que no tienen un sprite propio
 * (la ballesta y el lanzadardos conservan su clase 2.5D). Expone el mismo
 * contrato que Ballista:
 * setFloating / clearFloating / setWorking / setDestroyed / update / destroy.
 *
 * El suelo de la huella se redibuja SIEMPRE en la posición final al terminar
 * de mover el edificio; así no queda un parche debajo de la casilla antigua.
 * ========================================================== */

import { iso } from '../systems/iso.js';
import { HALF_H, HALF_W, SCALE, TILE_H, TILE_W } from '../config/world.js';
import { OVERLAY_DEPTH } from '../config/interaction.js';
import { specFor } from '../systems/structureSpecs.js';

const C = {
  ink: 0x1a1512,
  wood: 0x8a5a2b, woodHi: 0xc08a4a, woodLo: 0x4a2e17,
  stone: 0x6a6a6a, stoneHi: 0x9a9a9a, stoneLo: 0x3b3b3b,
  gold: 0xd4a017, goldHi: 0xf7de78,
  crystal: 0x9be0ff, crystalHi: 0x3fa7e0, crystalLo: 0x245f88,
  purple: 0x9a6bd6, purpleHi: 0xc9a8f0, purpleLo: 0x392154,
  green: 0x3ddc84, greenHi: 0x9bf3bc,
  red: 0xb8392b, redHi: 0xf07a5a,
  bone: 0xe8e0c8, boneLo: 0x938d79,
  slime: 0x7dc94a, slimeHi: 0xb6f5a4,
};

// Cimientos de mazmorra: la misma piedra fría para todos, con un matiz
// ligero por edificio para conservar su identidad sin romper el conjunto.
const GROUND = {
  turret: [0x3d3d44, 0x7b7b86],
  catapult: [0x3d3a35, 0x7b756a],
  rift: [0x3a3446, 0x776a8c],
  lab: [0x354247, 0x6e8a92],
  incubator: [0x3e3b36, 0x80796e],
  vault: [0x403b31, 0x857a63],
  mine: [0x384146, 0x70848f],
  workshop: [0x3b3934, 0x7a7469],
  banner: [0x3c3a33, 0x79735f],
  bannerslime: [0x37402f, 0x6f8161],
  bomb: [0x35332f, 0x6c685f],
  electro: [0x334148, 0x668992],
  rocktrap: [0x3b3b3f, 0x787880],
};

function poly(g, points, color, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillPoints(points, true);
}

function outline(g, points, color = C.ink, width = 1.5, alpha = 1) {
  g.lineStyle(width, color, alpha);
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
  g.closePath();
  g.strokePath();
}

/* Cimiento de mazmorra: rombo de piedra con juntas de ladrillo. Las hiladas
 * se recortan al rombo calculando la anchura disponible en cada altura; así
 * no hace falta recortar gráficos y el trazo queda nítido a cualquier zoom. */
function brickDiamond(g, cx, cy, W, H, base, line, alpha, rows = 4) {
  const pts = [
    { x: cx, y: cy - H }, { x: cx + W, y: cy },
    { x: cx, y: cy + H }, { x: cx - W, y: cy },
  ];
  poly(g, pts, base, alpha);
  outline(g, pts, line, 1.5, 0.9);

  const halfAt = dy => W * (1 - Math.abs(dy) / H);
  const cols = Math.max(2, Math.round(W / 16));
  for (let i = 1; i < rows; i++) {
    const dy = -H + (2 * H * i) / rows;
    const half = halfAt(dy);
    g.lineStyle(1, line, 0.42 * alpha);
    g.beginPath();
    g.moveTo(cx - half, cy + dy);
    g.lineTo(cx + half, cy + dy);
    g.strokePath();
  }
  for (let i = 0; i < rows; i++) {
    const y0 = -H + (2 * H * i) / rows;
    const y1 = -H + (2 * H * (i + 1)) / rows;
    const half = Math.min(halfAt(y0), halfAt(y1)) - 2;
    if (half <= 0) continue;
    for (let j = 1; j < cols; j++) {
      if ((i + j) % 2 === 0) continue;
      const x = cx - half + (2 * half * j) / cols;
      g.lineStyle(1, line, 0.32 * alpha);
      g.beginPath();
      g.moveTo(x, cy + y0 + 2);
      g.lineTo(x, cy + y1 - 2);
      g.strokePath();
    }
  }
}

// Bloque 2.5D: cara izquierda, cara derecha y rombo superior.
function cuboid(g, cx, by, w, depth, h, colors, alpha = 1) {
  const w2 = w / 2;
  const h2 = h / 2;
  const ty = by - depth;
  const left = [
    { x: cx - w2, y: ty }, { x: cx, y: ty + h2 },
    { x: cx, y: by + h2 }, { x: cx - w2, y: by },
  ];
  const right = [
    { x: cx, y: ty + h2 }, { x: cx + w2, y: ty },
    { x: cx + w2, y: by }, { x: cx, y: by + h2 },
  ];
  const top = [
    { x: cx, y: ty - h2 }, { x: cx + w2, y: ty },
    { x: cx, y: ty + h2 }, { x: cx - w2, y: ty },
  ];
  poly(g, left, colors.left ?? colors.top, alpha);
  poly(g, right, colors.right ?? colors.top, alpha);
  poly(g, top, colors.top, alpha);
  outline(g, top, colors.edge ?? C.ink, 1.5, alpha);
  outline(g, left, colors.edge ?? C.ink, 1, alpha * 0.8);
  outline(g, right, colors.edge ?? C.ink, 1, alpha * 0.8);
}

const STONE = { top: C.stoneHi, left: C.stone, right: C.stoneLo };
const WOOD = { top: C.woodHi, left: C.wood, right: C.woodLo };

function drawTurret(g, cx, by, s, time, aim) {
  cuboid(g, cx, by, 46 * s, 20 * s, 20 * s, STONE);
  cuboid(g, cx, by - 18 * s, 30 * s, 15 * s, 14 * s, {
    top: C.stoneHi, left: 0x555555, right: 0x333333,
  });
  const topY = by - 36 * s;
  const a = aim?.angle ?? -0.7;
  const ex = cx + Math.cos(a) * 28 * s;
  const ey = topY + Math.sin(a) * 11 * s;
  g.lineStyle(6 * s, C.ink, 1);
  g.beginPath(); g.moveTo(cx, topY); g.lineTo(ex, ey); g.strokePath();
  g.lineStyle(3 * s, C.goldHi, 1);
  g.beginPath(); g.moveTo(cx, topY - 1); g.lineTo(ex, ey - 1); g.strokePath();
  g.fillStyle(C.gold, 1);
  g.fillCircle(cx, topY, 5 * s);
  g.fillStyle(C.red, 0.7 + Math.sin(time / 240) * 0.2);
  g.fillCircle(cx, topY - 7 * s, 2.5 * s);
}

function drawCatapult(g, cx, by, s, time, aim) {
  cuboid(g, cx, by, 52 * s, 16 * s, 20 * s, WOOD);
  g.lineStyle(5 * s, C.woodLo, 1);
  g.beginPath();
  g.moveTo(cx - 16 * s, by - 10 * s); g.lineTo(cx + 8 * s, by - 42 * s);
  g.moveTo(cx + 16 * s, by - 10 * s); g.lineTo(cx - 4 * s, by - 42 * s);
  g.strokePath();
  const swing = Math.sin(time / 420) * 0.25 + (aim?.angle ?? -0.6) * 0.18;
  const bx = cx + Math.cos(-Math.PI / 2 + swing) * 22 * s;
  const byy = by - 42 * s + Math.sin(-Math.PI / 2 + swing) * 22 * s;
  g.lineStyle(5 * s, C.woodHi, 1);
  g.beginPath(); g.moveTo(cx, by - 32 * s); g.lineTo(bx, byy); g.strokePath();
  g.fillStyle(C.stoneLo, 1);
  g.fillCircle(bx, byy, 6 * s);
  g.fillStyle(C.stoneHi, 1);
  g.fillCircle(bx - 1.5 * s, byy - 2 * s, 3 * s);
}

function drawRift(g, cx, by, s, time) {
  const pulse = 0.5 + 0.5 * Math.sin(time / 480);
  g.fillStyle(C.purpleLo, 0.9);
  g.fillEllipse(cx, by - 2 * s, 42 * s, 22 * s);
  g.lineStyle(3 * s, C.purpleHi, 0.8);
  g.strokeEllipse(cx, by - 4 * s, 34 * s + pulse * 4, 17 * s + pulse * 3);
  g.fillStyle(C.ink, 0.95);
  g.fillEllipse(cx, by - 5 * s, 26 * s, 13 * s);
  g.fillStyle(C.purple, 0.55 + pulse * 0.35);
  g.fillEllipse(cx, by - 6 * s, 16 * s + pulse * 3, 8 * s + pulse * 2);
  for (let i = 0; i < 4; i++) {
    const a = time / 900 + i * Math.PI / 2;
    const px = cx + Math.cos(a) * 22 * s;
    const py = by - 8 * s + Math.sin(a) * 9 * s;
    g.fillStyle(C.purpleHi, 0.8);
    g.fillCircle(px, py, 2.2 * s);
  }
  g.fillStyle(C.purpleHi, 1);
  g.fillTriangle(cx - 5 * s, by - 18 * s, cx, by - 34 * s, cx + 5 * s, by - 18 * s);
}

function drawLab(g, cx, by, s, time) {
  cuboid(g, cx, by, 46 * s, 14 * s, 18 * s, STONE);
  const glow = 0.6 + 0.3 * Math.sin(time / 360);
  g.fillStyle(C.crystalHi, 0.85);
  g.fillEllipse(cx - 10 * s, by - 22 * s, 12 * s, 15 * s);
  g.fillStyle(C.green, glow);
  g.fillEllipse(cx - 10 * s, by - 19 * s, 8 * s, 8 * s);
  g.fillStyle(C.crystalHi, 0.85);
  g.fillEllipse(cx + 10 * s, by - 24 * s, 10 * s, 12 * s);
  g.fillStyle(C.purple, glow);
  g.fillEllipse(cx + 10 * s, by - 22 * s, 6 * s, 6 * s);
  g.lineStyle(2 * s, C.stoneHi, 1);
  g.beginPath(); g.moveTo(cx - 18 * s, by - 16 * s); g.lineTo(cx + 18 * s, by - 16 * s); g.strokePath();
}

function drawIncubator(g, cx, by, s, time) {
  cuboid(g, cx, by, 44 * s, 14 * s, 18 * s, STONE);
  const pulse = Math.sin(time / 500) * 1.5 * s;
  g.fillStyle(C.bone, 1);
  g.fillEllipse(cx, by - 30 * s + pulse, 22 * s, 30 * s);
  g.lineStyle(2 * s, C.boneLo, 1);
  g.strokeEllipse(cx, by - 30 * s + pulse, 22 * s, 30 * s);
  g.lineStyle(1.5 * s, C.wood, 1);
  g.beginPath();
  g.moveTo(cx - 8 * s, by - 32 * s + pulse); g.lineTo(cx - 2 * s, by - 27 * s + pulse);
  g.lineTo(cx + 4 * s, by - 34 * s + pulse); g.lineTo(cx + 8 * s, by - 28 * s + pulse);
  g.strokePath();
}

function drawVault(g, cx, by, s, resource) {
  cuboid(g, cx, by, 64 * s, 20 * s, 26 * s, WOOD);
  g.lineStyle(3 * s, C.gold, 1);
  g.beginPath();
  g.moveTo(cx - 20 * s, by - 22 * s); g.lineTo(cx - 20 * s, by + 3 * s);
  g.moveTo(cx + 20 * s, by - 22 * s); g.lineTo(cx + 20 * s, by + 3 * s);
  g.strokePath();
  const gem = resource === 'crystals' ? C.crystal : C.goldHi;
  g.fillStyle(gem, 1);
  g.fillTriangle(cx, by - 34 * s, cx + 7 * s, by - 24 * s, cx - 7 * s, by - 24 * s);
  g.fillStyle(C.ink, 1);
  g.fillRect(cx - 4 * s, by - 10 * s, 8 * s, 7 * s);
}

function drawMine(g, cx, by, s, time) {
  cuboid(g, cx, by, 48 * s, 14 * s, 18 * s, STONE);
  g.fillStyle(C.crystalLo, 1);
  g.fillTriangle(cx - 14 * s, by - 16 * s, cx - 6 * s, by - 38 * s, cx + 2 * s, by - 16 * s);
  g.fillStyle(C.crystalHi, 1);
  g.fillTriangle(cx + 2 * s, by - 16 * s, cx + 11 * s, by - 44 * s, cx + 18 * s, by - 16 * s);
  g.fillStyle(C.crystal, 0.7 + Math.sin(time / 400) * 0.2);
  g.fillTriangle(cx + 5 * s, by - 18 * s, cx + 11 * s, by - 36 * s, cx + 15 * s, by - 18 * s);
  g.lineStyle(3 * s, C.woodHi, 1);
  g.beginPath(); g.moveTo(cx - 20 * s, by - 12 * s); g.lineTo(cx + 18 * s, by - 30 * s); g.strokePath();
}

function drawWorkshop(g, cx, by, s, time) {
  cuboid(g, cx, by, 48 * s, 14 * s, 18 * s, STONE);
  g.fillStyle(C.stoneLo, 1);
  g.fillRect(cx - 16 * s, by - 30 * s, 32 * s, 10 * s);
  g.fillStyle(C.stoneHi, 1);
  g.fillRect(cx - 16 * s, by - 32 * s, 32 * s, 4 * s);
  g.fillStyle(C.gold, 0.8 + Math.sin(time / 320) * 0.2);
  g.fillCircle(cx, by - 40 * s, 6 * s);
  g.fillStyle(C.goldHi, 1);
  g.fillCircle(cx - 2 * s, by - 42 * s, 2 * s);
  g.lineStyle(3 * s, C.woodHi, 1);
  g.beginPath(); g.moveTo(cx + 12 * s, by - 20 * s); g.lineTo(cx + 18 * s, by - 40 * s); g.strokePath();
}

function drawBanner(g, cx, by, s, time, kind) {
  const sway = Math.sin(time / 520) * 3 * s;
  g.lineStyle(4 * s, C.woodLo, 1);
  g.beginPath(); g.moveTo(cx, by); g.lineTo(cx, by - 56 * s); g.strokePath();
  const cloth = kind === 'bannerslime' ? C.slime : C.bone;
  const pts = [
    { x: cx + 2 * s, y: by - 54 * s },
    { x: cx + 26 * s + sway, y: by - 50 * s },
    { x: cx + 22 * s + sway, y: by - 34 * s },
    { x: cx + 26 * s + sway, y: by - 22 * s },
    { x: cx + 2 * s, y: by - 28 * s },
  ];
  poly(g, pts, cloth, 1);
  outline(g, pts, C.ink, 1.5);
  if (kind === 'bannerslime') {
    g.fillStyle(C.ink, 1);
    g.fillCircle(cx + 10 * s + sway, by - 43 * s, 1.8 * s);
    g.fillCircle(cx + 18 * s + sway, by - 43 * s, 1.8 * s);
    g.lineStyle(1.5 * s, C.ink, 1);
    g.beginPath(); g.moveTo(cx + 10 * s + sway, by - 37 * s);
    g.lineTo(cx + 18 * s + sway, by - 37 * s); g.strokePath();
  } else {
    g.fillStyle(C.ink, 1);
    g.fillRect(cx + 8 * s + sway, by - 44 * s, 3 * s, 3 * s);
    g.fillRect(cx + 16 * s + sway, by - 44 * s, 3 * s, 3 * s);
    g.lineStyle(1.5 * s, C.ink, 1);
    g.beginPath(); g.moveTo(cx + 8 * s + sway, by - 36 * s);
    g.lineTo(cx + 18 * s + sway, by - 36 * s); g.strokePath();
  }
}

function drawBomb(g, cx, by, s, time) {
  g.fillStyle(C.stoneLo, 1);
  g.fillEllipse(cx, by - 5 * s, 22 * s, 11 * s);
  g.fillStyle(C.ink, 1);
  g.fillEllipse(cx, by - 7 * s, 16 * s, 9 * s);
  g.lineStyle(2 * s, C.woodHi, 1);
  g.beginPath(); g.moveTo(cx + 5 * s, by - 12 * s); g.lineTo(cx + 12 * s, by - 20 * s); g.strokePath();
  g.fillStyle(C.goldHi, 0.7 + Math.sin(time / 140) * 0.3);
  g.fillCircle(cx + 13 * s, by - 22 * s, 3 * s);
}

function drawElectro(g, cx, by, s, time) {
  cuboid(g, cx, by, 24 * s, 10 * s, 14 * s, STONE);
  const pulse = 0.5 + 0.5 * Math.sin(time / 220);
  g.fillStyle(C.crystalLo, 1);
  g.fillTriangle(cx, by - 40 * s, cx + 10 * s, by - 18 * s, cx - 10 * s, by - 18 * s);
  g.fillStyle(C.crystalHi, 0.6 + pulse * 0.4);
  g.fillTriangle(cx, by - 38 * s, cx + 5 * s, by - 20 * s, cx - 5 * s, by - 20 * s);
  g.lineStyle(1.5 * s, C.crystal, 0.7);
  for (let i = 0; i < 3; i++) {
    const a = time / 300 + i * 2.1;
    g.beginPath();
    g.moveTo(cx, by - 28 * s);
    g.lineTo(cx + Math.cos(a) * 14 * s, by - 30 * s + Math.sin(a) * 7 * s);
    g.strokePath();
  }
}

function drawRocktrap(g, cx, by, s) {
  for (let i = -1; i <= 1; i++) {
    const x = cx + i * 16 * s;
    const y = by - (i === 0 ? 6 : 2) * s;
    g.fillStyle(i === 0 ? C.stone : C.stoneLo, 1);
    g.fillTriangle(x - 11 * s, y, x, y - (i === 0 ? 26 : 16) * s, x + 11 * s, y);
    g.fillStyle(C.stoneHi, 1);
    g.fillTriangle(x - 5 * s, y - 4 * s, x, y - (i === 0 ? 22 : 13) * s, x + 2 * s, y - 5 * s);
  }
}

function drawRubble(g, cx, by, s) {
  g.fillStyle(0x3a322c, 0.9);
  g.fillEllipse(cx, by, 46 * s, 20 * s);
  for (let i = 0; i < 5; i++) {
    const x = cx + (i - 2) * 10 * s;
    const h = (8 + ((i * 7) % 9)) * s;
    g.fillStyle(i % 2 ? C.stoneLo : C.stone, 1);
    g.fillTriangle(x - 7 * s, by, x, by - h, x + 7 * s, by);
  }
}

const DRAWERS = {
  turret: drawTurret,
  catapult: drawCatapult,
  rift: drawRift,
  lab: drawLab,
  incubator: drawIncubator,
  vault: drawVault,
  mine: drawMine,
  workshop: drawWorkshop,
  banner: drawBanner,
  bannerslime: drawBanner,
  bomb: drawBomb,
  electro: drawElectro,
  rocktrap: drawRocktrap,
};

export class StructureView {
  constructor(scene, def) {
    this.scene = scene;
    this.def = def;
    this.kind = def.kind;
    this.size = def.w || def.size || 1;
    this.height = def.height || 24;
    this.x = def.x;
    this.y = def.y;
    this.level = def.level || 1;
    this.resource = def.resource || null;

    this.baseDepth = this.x + this.y + this.size;
    this.ground = scene.add.graphics().setDepth(this.baseDepth + 0.01);
    this.shadow = scene.add.graphics().setDepth(this.baseDepth + 0.02);
    this.body = scene.add.graphics().setDepth(this.baseDepth + 0.05);
    this.bubble = null;
    this.floating = false;
    this.destroyed = false;
    this.working = false;
    this.hidden = false;
    this.aim = { angle: -0.7 };
    this.lastArt = -1;

    this.drawGround();
    this.drawShadow();
    this.drawBody(scene.time.now);
  }

  get unit() { return 0.9 + (this.size - 2) * 0.14; }

  center(lift = 0) {
    return iso(this.x + this.size / 2, this.y + this.size / 2, lift);
  }

  drawGround() {
    const g = this.ground;
    const n = this.size;
    const top = iso(this.x, this.y);
    const right = iso(this.x + n, this.y);
    const bottom = iso(this.x + n, this.y + n);
    const left = iso(this.x, this.y + n);
    const colors = GROUND[this.kind] || [0x3d3d44, 0x7b7b86];

    g.clear();
    brickDiamond(g,
      (top.x + bottom.x) / 2, (top.y + bottom.y) / 2,
      (right.x - left.x) / 2, (bottom.y - top.y) / 2,
      colors[0], colors[1], this.destroyed ? 0.6 : 0.95);
  }

  drawShadow() {
    const g = this.shadow;
    const c = this.center();
    g.clear();
    g.fillStyle(0x000000, 0.26);
    g.fillEllipse(c.x, c.y + 4 * SCALE, this.size * HALF_W * 0.62 * 2, this.size * HALF_H * 0.55 * 2);
  }

  drawBody(time) {
    const g = this.body;
    g.clear();
    if (this.destroyed) {
      const c = this.center();
      drawRubble(g, c.x, c.y, this.unit);
      return;
    }
    const lift = this.floating ? this.lift || 0 : 0;
    const c = this.center(lift);
    const drawer = DRAWERS[this.kind];
    if (!drawer) {
      cuboid(g, c.x, c.y, 36 * this.unit, 22, 18 * this.unit, WOOD);
      return;
    }
    const args = [g, c.x, c.y, this.unit, time, this.aim];
    if (this.kind === 'vault') args.splice(4, 0, this.resource);
    if (this.kind === 'banner' || this.kind === 'bannerslime') args[5] = this.kind;
    drawer(...args);
  }

  placeAt(x, y, lift = 0) {
    this.x = x;
    this.y = y;
    this.lift = lift;
    if (this.floating) {
      this.drawBody(this.scene.time.now);
      this.updateBubble();
      return;
    }
    // Al cambiar de sitio se recalculan profundidad, suelo y sombra.
    this.baseDepth = x + y + this.size;
    this.ground.setDepth(this.baseDepth + 0.01);
    this.shadow.setDepth(this.baseDepth + 0.02);
    this.body.setDepth(this.baseDepth + 0.05);
    this.drawGround();
    this.drawShadow();
    this.drawBody(this.scene.time.now);
    this.updateBubble();
  }

  // Mismo contrato que Ballista: la copia flotante no arrastra suelo.
  setFloating(gx, gy, lift, time) {
    this.floating = true;
    this.lift = lift;
    this.x = gx;
    this.y = gy;
    this.ground.setVisible(false);
    this.shadow.setVisible(false);
    this.body.setAlpha(this.working ? 0.55 : 0.85)
      .setDepth(OVERLAY_DEPTH + 0.05);
    this.drawBody(time);
    this.updateBubble();
  }

  clearFloating() {
    this.floating = false;
    this.lift = 0;
    this.x = this.def.x;
    this.y = this.def.y;
    this.ground.setVisible(!this.hidden);
    this.shadow.setVisible(!this.hidden);
    this.body.setVisible(!this.hidden)
      .setAlpha(this.working ? 0.55 : 1);
    this.placeAt(this.x, this.y, 0);
  }

  aimAt(x, y) {
    const c = this.center();
    const to = iso(x, y, 0);
    this.aim = { angle: Math.atan2((to.y - c.y) * 0.5, to.x - c.x) };
    this.drawBody(this.scene.time.now);
  }

  setWorking(on = true) {
    if (this.working === on) return;
    this.working = on;
    this.body.setAlpha(on ? 0.55 : 1);
  }

  setDestroyed(on = true) {
    if (this.destroyed === on) return;
    this.destroyed = on;
    this.drawGround();
    this.drawBody(this.scene.time.now);
  }

  // Bombas y electrostales no se ven durante la invasión.
  setHidden(on = true) {
    if (this.hidden === on) return;
    this.hidden = on;
    this.ground.setVisible(!on);
    this.shadow.setVisible(!on);
    this.body.setVisible(!on);
    if (this.bubble) this.bubble.setVisible(!on);
  }

  // Lo usa el editor al guardar/colocar una estructura.
  setVisible(on = true) { this.setHidden(!on); }

  setResource(resource) {
    this.resource = resource;
    this.drawBody(this.scene.time.now);
  }

  setBubble(text) {
    if (!text) {
      if (this.bubble) { this.bubble.destroy(); this.bubble = null; }
      return;
    }
    if (!this.bubble) {
      this.bubble = this.scene.add.text(0, 0, '', {
        fontFamily: 'monospace', fontSize: `${Math.round(13 * SCALE)}px`,
        color: '#f7de78', backgroundColor: '#1a1512',
        padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 1);
    }
    if (this.bubble.text !== String(text)) this.bubble.setText(String(text));
    this.updateBubble();
  }

  updateBubble() {
    if (!this.bubble) return;
    const c = this.center(this.floating ? this.lift || 0 : 0);
    this.bubble.setPosition(c.x, c.y - (this.height + 26) * SCALE)
      .setDepth((this.floating ? OVERLAY_DEPTH : this.baseDepth) + 0.2)
      .setVisible(!this.hidden);
  }

  update(time) {
    const animated = ['rift', 'electro', 'bomb', 'lab', 'workshop', 'incubator', 'mine', 'catapult', 'banner', 'bannerslime'];
    if (this.floating) return;
    if (!animated.includes(this.kind)) return;
    // 12 fps basta para los pulsos y no llena la lista de dibujo.
    const frame = Math.floor(time / 80);
    if (frame === this.lastArt) return;
    this.lastArt = frame;
    this.drawBody(time);
  }

  destroy() {
    this.ground.destroy();
    this.shadow.destroy();
    this.body.destroy();
    if (this.bubble) this.bubble.destroy();
  }
}

// Se usa desde el factory para decidir si un kind necesita vista genérica.
// Ballesta, lanzadardos y catapulta ya tienen su sprite 2.5D (Ballista,
// DartTurret, Catapult); sus DRAWERS se conservan solo como referencia
// histórica del aspecto previo al horneado.
export function needsGenericView(kind) {
  return Boolean(DRAWERS[kind]) && kind !== 'ballista' && kind !== 'turret' && kind !== 'catapult';
}
