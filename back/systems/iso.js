import { HALF_W, HALF_H } from '../config/world.js';

// Proyección isométrica idéntica a la del juego legacy (01-config-estado.js).
// iso() devuelve el vértice superior del rombo de la casilla (x, y).
export function iso(x, y, z = 0) {
  return { x: (x - y) * HALF_W, y: (x + y) * HALF_H - z };
}
