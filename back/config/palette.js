/* Paleta del mundo. Espejo de la paleta de js/world/04-render.js.
 * Los menús y el HUD siguen siendo DOM/CSS (pixel art) y no usan estos colores.
 */

export const COLORS = Object.freeze({
  void: '#14100d',
  floor: '#2b2622',
  floorGrid: 'rgba(230, 215, 195, 0.10)',
  // Suelo y cimientos de mazmorra (misma familia que la ballesta 2.5D).
  dungeon: Object.freeze({
    floor: '#33333a',
    floorEdge: 'rgba(16, 14, 22, 0.75)',
    brick: 'rgba(18, 16, 24, 0.42)',
    stone: 0x3d3d44,
    stoneHi: 0x7b7b86,
    stoneLo: 0x25252c,
  }),
  wood: Object.freeze({
    dark: '#3a2312',
    body: '#8a5a2b',
    far: '#6f4724',
    light: '#b88147',
  }),
});

// Convierte '#rrggbb' al entero que espera Phaser Graphics.
export function hexToInt(hex) {
  return parseInt(hex.slice(1), 16);
}
