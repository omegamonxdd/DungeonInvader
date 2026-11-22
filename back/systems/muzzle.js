/* ==========================================================
 * BOCA DE DISPARO DE LAS DEFENSAS 2.5D
 * ----------------------------------------------------------
 * Cada defensa hornea su cabeza desde un modelo 3D con una cámara
 * ortográfica isométrica (generadores en tools/). El proyectil debe salir
 * del cañón / del cazo, no del centro de la huella: aquí se traduce el
 * punto 3D de la boca (en unidades del modelo, girado por el ángulo real
 * del frame) a coordenadas de casilla para que iso(x, y, z) caiga exactamente
 * sobre el pixel donde el arte dibuja el fogonazo o la roca.
 *
 * No se hace ninguna rotación 2D: el ángulo viene de yawDegPerFrame, la
 * misma tabla que usó el horneado para cada uno de los 24 frames.
 * ========================================================== */

import { HALF_H, HALF_W } from '../config/world.js';
import ballistaArt from '../../front/assets/estructuras/ballesta/ballista-art.json';
import turretArt from '../../front/assets/estructuras/lanzadardos/turret-art.json';
import catapultArt from '../../front/assets/estructuras/catapulta/catapult-art.json';

// Cámara del horneado: azimut 45°, elevación 30°, PPU = 62 px/unidad.
const SIN_AZ = Math.sin(Math.PI / 4);
const COS_AZ = Math.cos(Math.PI / 4);
const SIN_EL = Math.sin(Math.PI / 6);
const COS_EL = Math.cos(Math.PI / 6);
const PPU = 62;

// Las tres defensas comparten artScale (px de mundo por px de arte).
const ART_SCALE = 0.67;

/* Un punto del modelo (px, py, pz) se proyecta en el arte como
 *   ox = PPU·sin(AZ)·(px - py)
 *   oy = PPU·[sin(EL)·cos(AZ)·(px + py) - cos(EL)·pz]
 * y en el juego como
 *   ox = HALF_W·(dx - dy)
 *   oy = HALF_H·(dx + dy) - z
 * Igualando y usando z = ART_SCALE·PPU·cos(EL)·pz salen estos factores. */
const K_DIFF = ART_SCALE * PPU * SIN_AZ / HALF_W;
const K_SUM = ART_SCALE * PPU * SIN_EL * COS_AZ / HALF_H;
const K_Z = ART_SCALE * PPU * COS_EL;

const MUZZLES = Object.freeze({
  ballista: Object.freeze({
    // Fogón del estado «fire» en tools/ballista-art/generate.mjs (fx=1.34, fz=0.74).
    point: Object.freeze([1.34, 0, 0.74]),
    headZ: 1.55,
    yaw: ballistaArt.yawDegPerFrame,
  }),
  turret: Object.freeze({
    // Boca del cañón de dardos (fx=1.10, fz=0.47) en tools/turret-art/generate.mjs.
    point: Object.freeze([1.10, 0, 0.47]),
    headZ: 1.05,
    yaw: turretArt.yawDegPerFrame,
  }),
  catapult: Object.freeze({
    // Posición de la roca al soltar el brazo (swing≈1.95 rad): cazo a
    // [0.37, 0, 1.80] en coords de cabeza. tools/catapult-art/generate.mjs.
    point: Object.freeze([0.37, 0, 1.80]),
    headZ: 1.14,
    yaw: catapultArt.yawDegPerFrame,
  }),
});

/* Origen del proyectil en coordenadas de mundo (casillas + altura en px).
 * `view` es Ballista / DartTurret / Catapult: se le pide el ángulo justo en
 * que se dispara, para no depender del frame dibujado el tick anterior. */
export function shotOrigin(view, kind) {
  const cfg = MUZZLES[kind];
  if (!cfg) return null;

  const frames = cfg.yaw.length;
  const raw = view.yawToTarget ? view.yawToTarget() : (view.yaw ?? 0);
  const frame = ((Math.round(raw) % frames) + frames) % frames;
  const phi = (cfg.yaw[frame] || 0) * Math.PI / 180;
  const [lx, ly, lz] = cfg.point;
  const c = Math.cos(phi), s = Math.sin(phi);
  // Giro real sobre el eje vertical, igual que en el generador (rotZ).
  const px = lx * c - ly * s;
  const py = lx * s + ly * c;
  const pz = lz + cfg.headZ;

  const u = px - py;
  const v = px + py;
  const dx = (K_DIFF * u + K_SUM * v) / 2;
  const dy = (K_SUM * v - K_DIFF * u) / 2;
  const center = view.center;

  return {
    x: center.x + dx,
    y: center.y + dy,
    z: K_Z * pz,
  };
}
