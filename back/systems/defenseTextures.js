/* Texturas compartidas por las tres defensas 2.5D (ballesta, lanzadardos y
 * catapulta). Antes este código estaba triplicado en ballistaTextures.js,
 * turretTextures.js y catapultTextures.js; ahora hay una sola implementación y
 * cada defensa solo aporta su configuración y sus claves.
 *
 * Las imágenes de las cabezas se hornean OFFLINE desde modelos 3D con cámara
 * ortográfica isométrica (tools/*-art/). Aquí no se rota ni se cizalla en
 * tiempo de ejecución: BootScene carga los atlas y este módulo solo calcula
 * claves, índices de frame y el parche de roca de la huella.
 */
import { HALF_H, HALF_W, TILE_H, TILE_W } from '../config/world.js';

const makeCanvas = (w, h) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
};

/* ---------- Suelo de piedra de mazmorra de la huella 2×2 ----------
 * Textura de 64×64 con semilla fija (misma familia que el resto del suelo),
 * proyectada sobre el rombo de la huella. Se hornea a 2× del tamaño del
 * mundo para que, con filtrado NEAREST, coincida con el dibujo nítido del
 * legacy al ampliar (1× a zoom 2, 1.5× a zoom 3). La huella está sobre
 * suelo despejado, así que no hay bloques que deban taparla desde dentro.
 */
const ROCK_T = 64;
const ROCK_SS = 2;

export const rockSmoothingFor = (zoom, size) => zoom * size * HALF_W / ROCK_T < 1;

function buildRockPattern() {
  const T = ROCK_T;
  const canvas = makeCanvas(T, T);
  const g = canvas.getContext('2d');
  let seed = 20240611;
  const rnd = () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const px = (x, y, c, w = 1, h = 1) => {
    g.fillStyle = c;
    g.fillRect(Math.floor(x), Math.floor(y), w, h);
  };
  const pick = arr => arr[Math.floor(rnd() * arr.length)];

  // Misma piedra de mazmorra que el resto del mapa, con juntas de ladrillo.
  g.fillStyle = '#4a4a53';
  g.fillRect(0, 0, T, T);
  const patches = ['#404048', '#55555f', '#62626c', '#37373f'];
  for (let i = 0; i < 46; i++) {
    px(rnd() * T, rnd() * T, pick(patches), 3 + Math.floor(rnd() * 7), 2 + Math.floor(rnd() * 5));
  }
  const grains = ['#82828d', '#26262e', '#6c6c76', '#94949f'];
  for (let i = 0; i < 260; i++) px(rnd() * T, rnd() * T, pick(grains));

  g.fillStyle = '#303038';
  for (let row = 0; row < 4; row++) {
    const y = row * 16;
    g.fillRect(0, y, T, 2);
    const off = (row % 2) * 16;
    for (let x = off; x < T; x += 32) g.fillRect(x, y, 2, 16);
  }

  const crack = (x, y, dx, dy, len, branch) => {
    for (let i = 0; i < len; i++) {
      if (x < 3 || y < 3 || x > T - 4 || y > T - 4) return;
      px(x + 1, y + 1, '#2c2c34');
      px(x, y, '#0d0c12');
      const r = rnd();
      if (r < 0.40) x += dx;
      else if (r < 0.80) y += dy;
      else { x += dx; y += dy; }
      if (r > 0.93) { if (rnd() < 0.5) x -= dx; else y -= dy; }
      if (branch && rnd() < 0.07) crack(x, y, rnd() < 0.5 ? dx : -dx, dy, 6 + Math.floor(rnd() * 6), false);
    }
  };
  crack(10, 8, 1, 1, 34, true);
  crack(52, 12, -1, 1, 30, true);
  crack(8, 50, 1, -1, 26, true);
  crack(40, 58, 1, -1, 22, true);
  crack(30, 28, 1, 1, 14, false);

  g.fillStyle = '#181820';
  g.fillRect(0, 0, T, 2); g.fillRect(0, T - 2, T, 2);
  g.fillRect(0, 0, 2, T); g.fillRect(T - 2, 0, 2, T);
  for (let i = 0; i < 16; i++) {
    const e = Math.floor(rnd() * T), d = 2 + Math.floor(rnd() * 2);
    const side = Math.floor(rnd() * 4);
    if (side === 0) px(e, 2, '#181820', 1, d);
    else if (side === 1) px(e, T - 2 - d, '#181820', 1, d);
    else if (side === 2) px(2, e, '#181820', d, 1);
    else px(T - 2 - d, e, '#181820', d, 1);
  }
  return canvas;
}

/* Hornea el mismo suelo de piedra para cualquier huella cuadrada. La usan las
 * tres defensas con su propia clave para compartir EXACTAMENTE la familia de
 * roca del mapa. */
export function makeDungeonRockTexture(scene, key, n) {
  if (scene.textures.exists(key)) return key;

  const pattern = buildRockPattern();
  const w = Math.ceil(n * TILE_W) * ROCK_SS;
  const h = Math.ceil(n * TILE_H) * ROCK_SS;
  const canvas = makeCanvas(w, h);
  const g = canvas.getContext('2d');

  // Misma transformación isométrica que drawBuildingGround(), a 2×.
  g.translate(w / 2, 0);
  g.transform(
    ROCK_SS * n * HALF_W / ROCK_T, ROCK_SS * n * HALF_H / ROCK_T,
    -ROCK_SS * n * HALF_W / ROCK_T, ROCK_SS * n * HALF_H / ROCK_T,
    0, 0,
  );
  g.imageSmoothingEnabled = false;
  g.drawImage(pattern, 0, 0);

  scene.textures.addCanvas(key, canvas);
  return key;
}

/* Fábrica de helpers para una defensa concreta. `config` es BALLISTA/TURRET/
 * CATAPULT (config/defenses.js) y `keys` sus claves de textura. */
export function createDefenseTextures(config, keys) {
  const cols = config.headGroupCols;
  return Object.freeze({
    keys,
    headAtlasKey: group => keys.headPrefix + group,
    headGroup: yaw => Math.floor(yaw / cols),
    headFrame: (yaw, state) => (yaw % cols) + state * cols,
    rockSmoothing: zoom => rockSmoothingFor(zoom, config.size),

    // Comprobación de que el preload hizo su trabajo (los atlas no se hornean
    // en caliente: cada frame es un render 3D distinto).
    ensure(scene) {
      if (!scene.textures.exists(keys.base)) {
        throw new Error(`Falta la textura ${keys.base}: revisa BootScene/ASSETS.`);
      }
      for (let g = 0; g < config.headGroups; g++) {
        if (!scene.textures.exists(keys.headPrefix + g)) {
          throw new Error(`Falta el atlas ${keys.headPrefix + g}: revisa BootScene/ASSETS.`);
        }
      }
    },

    ensureRock(scene) {
      return makeDungeonRockTexture(scene, keys.rock, config.size);
    },
  });
}
