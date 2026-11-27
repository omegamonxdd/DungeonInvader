import Phaser from 'phaser';
import { GAME_CONFIG } from './config/gameConfig.js';
import { BALANCE } from './balance/index.js';
import { GameService, setService, AuthUI } from './database/index.js';
// La interfaz importa los tokens y hojas visuales de front/css/ (antes legacy).
import '../front/css/ui.css';

// La capa de datos se crea ANTES del juego: MainScene la recoge con
// getService() en create(). start() espera a que la escena se adjunte.
const saveService = setService(new GameService());
const authUI = new AuthUI(saveService);
window.__DUNGEON_AUTH_UI__ = authUI;

const game = new Phaser.Game(GAME_CONFIG);

saveService.start().then(() => authUI.ready()).catch(err => {
  console.warn('[database] El progreso se guardará solo en local:', err);
  authUI.ready();
});

// Acceso de depuración solo en desarrollo.
if (import.meta.env.DEV) {
  window.__DUNGEON_GAME__ = game;
  window.__DUNGEON_BALANCE__ = BALANCE;
  window.__DUNGEON_SAVE__ = saveService;
}
