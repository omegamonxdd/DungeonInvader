import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene.js';
import { MainScene } from '../scenes/MainScene.js';

// Configuración base de Phaser 3.
// Arcade Physics queda listo, pero en esta migración solo se usará para
// proyectiles y efectos: la cuadrícula, las unidades y el pathfinding siguen
// con la lógica isométrica propia del juego.
export const GAME_CONFIG = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#14121a',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, MainScene],
};
