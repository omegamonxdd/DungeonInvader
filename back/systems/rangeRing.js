import { iso } from './iso.js';
import { INTERACTION_COLORS } from '../config/interaction.js';

/* Anillos de alcance isométricos (equivalentes a drawRangeRing() del legacy).
 * Con `innerRadius` se rellena solo el anillo entre ambos radios: la zona
 * muerta de la catapulta queda sin teñir, así se ve dónde SÍ puede disparar.
 *
 * El trazo es un único camino CERRADO (moveTo + lineTo + closePath). El
 * guionaje anterior saltaba un segmento de cada dos y, al caer el salto
 * justo en la unión (t = 0, que en isométrico es las 5 horas), el anillo
 * parecía abierto. closePath() dibuja explícitamente el último tramo y
 * garantiza que no quede ninguna abertura.
 *
 * El relleno con radio interior se hace con una tira de cuadrisláteros
 * entre los dos círculos. Un único polígono "con ojo" (outer + inner
 * invertido) deja una rendija radial en la costura: era el otro origen
 * del corte visual en la catapulta.
 */

const SEGMENTS = 72;

function ringPoints(cx, cy, radius) {
  const pts = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const t = (i / SEGMENTS) * Math.PI * 2;
    pts.push(iso(cx + Math.cos(t) * radius, cy + Math.sin(t) * radius));
  }
  return pts;
}

function fillDisc(g, cx, cy, radius) {
  g.fillStyle(INTERACTION_COLORS.range, 0.10);
  g.fillPoints(ringPoints(cx, cy, radius), true);
}

function fillAnnulus(g, cx, cy, radius, innerRadius) {
  const outer = ringPoints(cx, cy, radius);
  const inner = ringPoints(cx, cy, innerRadius);
  g.fillStyle(INTERACTION_COLORS.range, 0.10);
  for (let i = 0; i < SEGMENTS; i++) {
    const j = (i + 1) % SEGMENTS;
    g.fillPoints([outer[i], outer[j], inner[j], inner[i]], true);
  }
}

function strokeRing(g, cx, cy, radius, zoom, alpha = 0.9) {
  const pts = ringPoints(cx, cy, radius);
  g.lineStyle(2.5 / zoom, INTERACTION_COLORS.rangeEdge, alpha);
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  // Cierra con pts[last] → pts[0]. Sin esto el segmento de la unión
  // quedaba sin dibujar en la proyección isométrica (5 en punto).
  g.closePath();
  g.strokePath();
}

export function drawRangeRing(g, cx, cy, radius, zoom, innerRadius = 0) {
  if (innerRadius > 0) fillAnnulus(g, cx, cy, radius, innerRadius);
  else fillDisc(g, cx, cy, radius);

  strokeRing(g, cx, cy, radius, zoom);
  if (innerRadius > 0) strokeRing(g, cx, cy, innerRadius, zoom, 0.6);
}
