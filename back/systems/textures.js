import {
  TILE_W, TILE_H, HALF_W, HALF_H, DIRT_HEIGHT, CORE_HEIGHT,
} from '../config/world.js';
import { COLORS } from '../config/palette.js';

/* Texturas horneadas del terreno.
 * Se dibuja a 3× y se reduce para conseguir bordes suaves (antialiasing)
 * sin depender de filtros del renderizador. Toda la piedra sigue el estilo
 * de mazmorra: gris frío con juntas de ladrillo y grietas.
 */

const SS = 3;                    // supersampling
export const DIRT_VARIANTS = 16; // suficientes para reproducir el ruido por casilla

// El bloque más alto es el núcleo, no la tierra.
const MAX_BLOCK_H = Math.max(DIRT_HEIGHT, CORE_HEIGHT);
const PAD = 1; // margen para que el trazo no se recorte en los bordes

export const TILE_TEXTURE = Object.freeze({
  w: TILE_W + PAD * 2,
  h: TILE_H + MAX_BLOCK_H + PAD * 2,
  originX: (HALF_W + PAD) / (TILE_W + PAD * 2),
  originY: (MAX_BLOCK_H + PAD) / (TILE_H + MAX_BLOCK_H + PAD * 2),
});

function hiResCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w * SS;
  canvas.height = h * SS;
  const ctx = canvas.getContext('2d');
  ctx.scale(SS, SS);
  return { canvas, ctx };
}

function flatten(canvas, w, h) {
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, w, h);
  return out;
}

function diamondPath(ctx, sx, sy) {
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + HALF_W, sy + HALF_H);
  ctx.lineTo(sx, sy + TILE_H);
  ctx.lineTo(sx - HALF_W, sy + HALF_H);
  ctx.closePath();
}

/* Juntas de ladrillo recortadas al rombo. Es lo que hace que el suelo se lea
 * como mazmorra en lugar de tierra: hiladas horizontales y trompicones
 * alternos, con el mismo grosor en todas las teselas. */
function stoneBricks(ctx, sx, ty, seed = 0) {
  const cy = ty + HALF_H;
  const step = 10;
  ctx.save();
  diamondPath(ctx, sx, ty);
  ctx.clip();
  ctx.lineWidth = 1;
  ctx.strokeStyle = COLORS.dungeon.brick;
  for (let row = 0, dy = -HALF_H; dy <= HALF_H; dy += step, row++) {
    const half = HALF_W * (1 - Math.abs(dy) / HALF_H) + 1;
    ctx.beginPath();
    ctx.moveTo(sx - half, cy + dy);
    ctx.lineTo(sx + half, cy + dy);
    ctx.stroke();
    if (dy >= HALF_H) break;
    const span = HALF_W / 2.4;
    const offset = (row + seed) % 2 ? span : 0;
    for (let u = -HALF_W + offset; u <= HALF_W; u += span * 2) {
      ctx.beginPath();
      ctx.moveTo(sx + u, cy + dy + 1.5);
      ctx.lineTo(sx + u, cy + dy + step - 1.5);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Bloque extruido: cara superior + cara izquierda + cara derecha.
// Las caras solo se dibujan si el vecino correspondiente es más bajo.
function drawBlock(ctx, sx, sy, h, colors, topStroke, showLeft, showRight, detail) {
  const ty = sy - h;

  if (showLeft) {
    ctx.beginPath();
    ctx.moveTo(sx - HALF_W, ty + HALF_H);
    ctx.lineTo(sx, ty + TILE_H);
    ctx.lineTo(sx, sy + TILE_H);
    ctx.lineTo(sx - HALF_W, sy + HALF_H);
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle = colors.left;
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
  }

  if (showRight) {
    ctx.beginPath();
    ctx.moveTo(sx, ty + TILE_H);
    ctx.lineTo(sx + HALF_W, ty + HALF_H);
    ctx.lineTo(sx + HALF_W, sy + HALF_H);
    ctx.lineTo(sx, sy + TILE_H);
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle = colors.right;
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
  }

  diamondPath(ctx, sx, ty);
  ctx.fillStyle = colors.top;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = topStroke || colors.top;
  ctx.stroke();
  if (detail) detail(ctx, sx, ty);
}

function drawFloor(ctx, sx, sy) {
  diamondPath(ctx, sx, sy);
  ctx.fillStyle = COLORS.dungeon.floor;
  ctx.fill();
  stoneBricks(ctx, sx, sy, 1);
  ctx.strokeStyle = COLORS.dungeon.floorEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function bake(scene, key, drawFn) {
  if (scene.textures.exists(key)) return key;
  const { canvas, ctx } = hiResCanvas(TILE_TEXTURE.w, TILE_TEXTURE.h);
  drawFn(ctx);
  scene.textures.addCanvas(key, flatten(canvas, TILE_TEXTURE.w, TILE_TEXTURE.h));
  return key;
}

export const FACE_LEFT = 1;
export const FACE_RIGHT = 2;

export const dirtKey = (variant, faces) => `dirt-${variant}-${faces}`;
export const coreStoneKey = faces => `core-stone-${faces}`;

export function ensureTerrainTextures(scene) {
  const sx = HALF_W + PAD;
  const sy = MAX_BLOCK_H + PAD;

  bake(scene, 'floor', ctx => drawFloor(ctx, sx, sy));

  for (let i = 0; i < DIRT_VARIANTS; i++) {
    // Piedra de mazmorra: mismo rango de luminosidad que la tierra anterior.
    const l = 27 + (i / (DIRT_VARIANTS - 1)) * 7;
    const colors = {
      top: `hsl(228, 9%, ${l + 6}%)`,
      left: `hsl(230, 10%, ${l - 4}%)`,
      right: `hsl(232, 11%, ${l - 9}%)`,
    };
    for (let faces = 0; faces < 4; faces++) {
      const showLeft = (faces & FACE_LEFT) !== 0;
      const showRight = (faces & FACE_RIGHT) !== 0;
      bake(scene, dirtKey(i, faces), ctx =>
        drawBlock(ctx, sx, sy, DIRT_HEIGHT, colors, 'rgba(0, 0, 0, 0.24)', showLeft, showRight,
          (c, x, y) => stoneBricks(c, x, y, i)));
    }
  }

  // Huella del núcleo: piedra más clara para que el conjunto resalte. El
  // cristal, los pilares y el resplandor son el PNG horneado (CoreView).
  const coreColors = {
    top: 'hsl(226, 11%, 41%)',
    left: 'hsl(228, 12%, 29%)',
    right: 'hsl(230, 13%, 22%)',
  };
  for (let faces = 0; faces < 4; faces++) {
    const showLeft = (faces & FACE_LEFT) !== 0;
    const showRight = (faces & FACE_RIGHT) !== 0;
    bake(scene, coreStoneKey(faces), ctx =>
      drawBlock(ctx, sx, sy, CORE_HEIGHT, coreColors, null, showLeft, showRight,
        (c, x, y) => stoneBricks(c, x, y, 3)));
  }
}
