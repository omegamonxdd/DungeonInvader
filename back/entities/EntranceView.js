import { iso } from '../systems/iso.js';
import { COLORS, hexToInt } from '../config/palette.js';
import {
  DIRT_HEIGHT, SCALE, WORLD,
} from '../config/world.js';

/* Entrada de mina con soportes de madera.
 * Copia de drawEntrance() del legacy, dibujada con Graphics en coordenadas
 * de mundo para conservar el trazo nítido a cualquier zoom.
 */

const FRAME_H = DIRT_HEIGHT * 0.8;
const POST_W = 7 * SCALE;

function extend(a, b, by) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return [
    { x: a.x - ux * by, y: a.y - uy * by },
    { x: b.x + ux * by, y: b.y + uy * by },
  ];
}

export class EntranceView {
  constructor(scene) {
    this.scene = scene;
    this.g = scene.add.graphics();

    // Se dibuja justo después de la casilla (40, 22), como en el legacy.
    this.g.setDepth(WORLD.entranceX + WORLD.entranceYMax + 1.5);
    this.draw();
  }

  beam(a, b, width, color, square = false) {
    const g = this.g;
    const [p0, p1] = square ? extend(a, b, width / 2) : [a, b];

    g.lineStyle(width + 3, hexToInt(COLORS.wood.dark), 1);
    g.beginPath();
    g.moveTo(p0.x, p0.y);
    g.lineTo(p1.x, p1.y);
    g.strokePath();

    g.lineStyle(width, hexToInt(color), 1);
    g.beginPath();
    g.moveTo(p0.x, p0.y);
    g.lineTo(p1.x, p1.y);
    g.strokePath();

    const off = width * 0.22;
    g.lineStyle(Math.max(1.5, width * 0.18), hexToInt(COLORS.wood.light), 0.55);
    g.beginPath();
    g.moveTo(p0.x - off, p0.y);
    g.lineTo(p1.x - off, p1.y);
    g.strokePath();
  }

  draw() {
    const g = this.g;
    const X = WORLD.entranceX;
    const yMin = WORLD.entranceYMin;
    const yMax = WORLD.entranceYMax;

    const FH = FRAME_H;
    const yA = yMin + 0.1;   // poste izquierdo
    const yB = yMax + 0.9;   // poste derecho
    const xIn = X + 0.1;     // marco interior
    const xOut = X + 0.9;    // marco exterior

    // Boca oscura sobre el muro del fondo
    const mouth = [
      iso(X, yMin, 0),
      iso(X, yMax + 1, 0),
      iso(X, yMax + 1, FH),
      iso(X, yMin, FH),
    ];
    g.fillStyle(0x080503, 0.93);
    g.fillPoints(mouth, true);

    // Marco interior
    for (const y of [yA, yB]) this.beam(iso(xIn, y, 0), iso(xIn, y, FH), POST_W, COLORS.wood.far);
    this.beam(iso(xIn, yA, FH), iso(xIn, yB, FH), POST_W, COLORS.wood.far, true);

    // Vigas longitudinales superiores
    for (const y of [yA, yB]) {
      this.beam(iso(xIn, y, FH), iso(xOut, y, FH), POST_W * 0.85, COLORS.wood.body, true);
    }

    // Marco exterior
    for (const y of [yA, yB]) this.beam(iso(xOut, y, 0), iso(xOut, y, FH), POST_W, COLORS.wood.body);
    this.beam(iso(xOut, yA, FH), iso(xOut, yB, FH), POST_W, COLORS.wood.body, true);

    // Tornapuntas en las esquinas superiores
    const brace = 0.4;
    const drop = 14 * SCALE;
    this.beam(iso(xOut, yA, FH - drop), iso(xOut, yA + brace, FH), POST_W * 0.6, COLORS.wood.body);
    this.beam(iso(xOut, yB, FH - drop), iso(xOut, yB - brace, FH), POST_W * 0.6, COLORS.wood.body);
  }
}
