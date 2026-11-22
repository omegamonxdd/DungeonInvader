import Phaser from 'phaser';
import { ASSETS } from '../assets/index.js';
import { BALLISTA, TURRET, CATAPULT } from '../config/defenses.js';
import { BALLISTA_TEX, headAtlasKey } from '../systems/ballistaTextures.js';
import { TURRET_TEX, turretHeadAtlasKey } from '../systems/turretTextures.js';
import { CATAPULT_TEX, catapultHeadAtlasKey } from '../systems/catapultTextures.js';
import { beginLoading, setLoadingProgress, failLoading } from '../../front/loading/splash.js';

/* Defensas 2.5D: las tres comparten geometría de atlas (24 ángulos × 3 estados
 * repartidos en 4 hojas de 6 columnas). Un solo bucle evita repetir el mismo
 * bloque de carga tres veces; los márgenes conservan el sheetPad de 4 px. */
const DEFENSE_GROUPS = [
  { config: BALLISTA, tex: BALLISTA_TEX, assets: ASSETS.ballista, atlasKey: headAtlasKey },
  { config: TURRET, tex: TURRET_TEX, assets: ASSETS.turret, atlasKey: turretHeadAtlasKey },
  { config: CATAPULT, tex: CATAPULT_TEX, assets: ASSETS.catapult, atlasKey: catapultHeadAtlasKey },
];

// Carga mínima. La UI seguirá siendo DOM/CSS, no Phaser.
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    beginLoading('Cargando defensas y escenarios…');

    // Progreso real del Loader de Phaser, no una animación falsa.
    this.load.on('progress', value => setLoadingProgress(value));
    this.load.on('filecomplete', key => setLoadingProgress(this.load.progress, `Cargado ${key}`));
    this.load.on('loaderror', file => failLoading(`Fallo al cargar ${file?.key || 'un recurso'}.`));

    for (const { config, tex, assets, atlasKey } of DEFENSE_GROUPS) {
      // Pedestal estático (incluye la sombra de contacto horneada).
      this.load.image(tex.base, assets.base);

      const frameConfig = {
        frameWidth: config.cell,
        frameHeight: config.cell,
        margin: config.sheetPad,
        spacing: config.sheetPad * 2,
      };
      assets.heads.forEach((url, group) => {
        this.load.spritesheet(atlasKey(group), url, frameConfig);
      });
    }

    // Núcleo: imagen 2.5D horneada + resplandor cian (su alfa se anima en CoreView).
    this.load.image('core', ASSETS.core.image);
    this.load.image('core-glow', ASSETS.core.glow);
  }

  create() {
    setLoadingProgress(1, 'Preparando la mazmorra…');
    this.scene.start('MainScene');
  }
}
