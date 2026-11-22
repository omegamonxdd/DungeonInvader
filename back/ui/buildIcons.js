/* Iconos pixelados de las ranuras del menú Construir (Fase 7).
 * Se dibujan en un lienzo de 80×80 con una rejilla lógica de 20×20 (4 px por
 * "píxel"). No son los sprites del juego: son los iconos de los menús, como en
 * el legacy (06-estructuras-ui.js y los drawIcon de cada edificio).
 */

const P = 4;

const C = Object.freeze({
  ink: '#1a1a1a',
  wood: '#8a5a2b', woodHi: '#c08a4a',
  stone: '#6a6a6a', stoneHi: '#9a9a9a',
  gold: '#d4a017', goldHi: '#f7de78',
  crystal: '#9be0ff', crystalHi: '#3fa7e0',
  green: '#3ddc84', red: '#b8392b',
  purple: '#9a6bd6', purpleHi: '#c9a8f0',
  bone: '#e8e0c8', slime: '#7dc94a',
});

/* Un píxel lógico = 4 px reales. Las coordenadas se dan en la rejilla 20×20. */
function painter(canvas) {
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, canvas.width, canvas.height);
  return (x, y, w, h, color) => {
    g.fillStyle = color;
    g.fillRect(x * P, y * P, w * P, h * P);
  };
}

const DRAWERS = {
  ballista(px) {
    // Trípode y cabeza de madera, con la cuerda dorada.
    px(8, 11, 4, 2, C.ink); px(8, 12, 4, 1, C.wood);
    px(6, 13, 2, 5, C.wood); px(12, 13, 2, 5, C.wood);
    px(9, 13, 2, 6, C.woodHi);
    px(9, 3, 2, 9, C.woodHi);
    px(4, 4, 2, 4, C.wood); px(4, 10, 2, 3, C.wood);
    px(14, 4, 2, 4, C.wood); px(14, 10, 2, 3, C.wood);
    px(5, 7, 10, 1, C.goldHi);
    px(9, 2, 2, 2, C.gold);
  },
  turret(px) {
    px(4, 13, 12, 5, C.stone); px(5, 12, 10, 2, C.stoneHi);
    px(7, 8, 6, 5, C.stone); px(8, 9, 4, 3, C.ink);
    px(9, 4, 2, 5, C.gold); px(9, 3, 2, 2, C.goldHi);
    px(3, 14, 2, 4, C.ink); px(15, 14, 2, 4, C.ink);
  },
  catapult(px) {
    px(3, 14, 14, 4, C.wood); px(5, 13, 10, 2, C.woodHi);
    px(8, 7, 3, 7, C.wood); px(9, 6, 2, 2, C.gold);
    px(12, 4, 5, 3, C.woodHi); px(13, 3, 3, 3, C.stoneHi);
    px(4, 18, 3, 2, C.ink); px(14, 18, 3, 2, C.ink);
  },
  rift(px) {
    px(5, 4, 10, 12, C.ink); px(6, 5, 8, 10, C.purple);
    px(8, 6, 4, 8, C.purpleHi); px(9, 7, 2, 6, C.ink);
    px(3, 7, 2, 2, C.purpleHi); px(15, 10, 2, 2, C.purpleHi);
    px(9, 2, 2, 2, C.purpleHi); px(9, 17, 2, 2, C.purpleHi);
  },
  vault(px, resource) {
    const gem = resource === 'crystals' ? C.crystal : C.gold;
    px(3, 8, 14, 9, C.wood); px(3, 6, 14, 3, C.woodHi);
    px(4, 9, 12, 1, C.ink); px(4, 15, 12, 1, C.ink);
    px(9, 10, 2, 4, C.goldHi); px(8, 13, 4, 2, C.gold);
    px(8, 3, 4, 3, gem);
    px(6, 18, 8, 1, C.ink);
  },
  mine(px) {
    px(9, 8, 2, 10, C.wood);
    px(4, 5, 12, 2, C.stoneHi); px(3, 6, 3, 2, C.stone); px(14, 6, 3, 2, C.stone);
    px(7, 12, 6, 6, C.crystalHi); px(8, 13, 4, 5, C.crystal);
    px(4, 18, 12, 1, C.ink);
  },
  workshop(px) {
    px(5, 10, 10, 4, C.stone); px(7, 8, 6, 2, C.stoneHi);
    px(7, 14, 6, 3, C.stone); px(5, 17, 10, 1, C.ink);
    px(8, 3, 4, 4, C.gold); px(9, 2, 2, 1, C.goldHi);
  },
  banner(px, resource) {
    const cloth = resource === 'slimes' ? C.slime : C.bone;
    px(8, 2, 2, 16, C.wood); px(7, 18, 4, 1, C.ink);
    px(10, 3, 8, 9, cloth); px(10, 3, 8, 1, C.ink); px(10, 11, 8, 1, C.ink);
    if (resource === 'slimes') { px(12, 7, 2, 2, C.ink); px(15, 7, 2, 2, C.ink); }
    else { px(12, 6, 4, 1, C.ink); px(13, 5, 2, 1, C.ink); px(12, 8, 4, 1, C.ink); }
  },
  bomb(px) {
    px(5, 8, 10, 9, C.ink); px(6, 7, 8, 2, C.ink);
    px(7, 9, 3, 2, C.stoneHi);
    px(14, 6, 3, 2, C.wood); px(16, 3, 2, 3, C.goldHi);
    px(15, 2, 1, 1, C.gold); px(18, 4, 1, 1, C.gold);
  },
  rocktrap(px) {
    px(3, 12, 6, 6, C.stone); px(9, 10, 7, 8, C.stoneHi);
    px(4, 12, 4, 2, C.stoneHi); px(10, 10, 5, 2, C.stone);
    px(3, 18, 14, 1, C.ink);
  },
  electro(px) {
    px(8, 3, 4, 7, C.crystalHi); px(9, 4, 2, 5, C.crystal);
    px(6, 10, 8, 2, C.stone); px(8, 12, 4, 2, C.stoneHi);
    px(9, 14, 2, 3, C.goldHi); px(7, 16, 2, 2, C.goldHi); px(11, 17, 2, 2, C.goldHi);
  },
  lab(px) {
    px(8, 2, 4, 2, C.stoneHi); px(9, 4, 2, 4, C.stoneHi);
    px(7, 8, 6, 4, C.crystalHi); px(6, 12, 8, 6, C.crystal);
    px(7, 13, 6, 2, C.green); px(8, 17, 4, 1, C.ink);
  },
  incubator(px) {
    px(7, 4, 6, 12, C.bone); px(8, 3, 4, 2, C.bone);
    px(8, 7, 2, 2, C.wood); px(11, 10, 2, 2, C.wood);
    px(6, 16, 8, 2, C.stone); px(5, 18, 10, 1, C.ink);
  },
};

/* key: identificador de la ranura (sin el prefijo "build-"). */
export function drawBuildIcon(canvas, key) {
  if (!canvas) return;
  const px = painter(canvas);
  let drawer = DRAWERS[key];
  let resource;

  // Almacenes, mina/taller y estandartes comparten dibujo con distinto color.
  if (key.startsWith('vault-')) { drawer = DRAWERS.vault; resource = key.slice(6); }
  else if (key.startsWith('prod-')) { drawer = key === 'prod-crystals' ? DRAWERS.mine : DRAWERS.workshop; }
  else if (key === 'bannerslime') { drawer = DRAWERS.banner; resource = 'slimes'; }
  else if (key === 'banner') { drawer = DRAWERS.banner; resource = 'skeletons'; }

  if (drawer) drawer(px, resource);
}
