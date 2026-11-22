import Phaser from 'phaser';
import { iso } from '../systems/iso.js';
import { HALF_H, HALF_W, SCALE, TILE_H, TILE_W } from '../config/world.js';
import { OVERLAY_DEPTH } from '../config/interaction.js';
import { shotOrigin } from '../systems/muzzle.js';
import { createDefenseTextures } from '../systems/defenseTextures.js';

/* Base común de las tres defensas 2.5D (ballesta, lanzadardos y catapulta).
 *
 * Antes había tres clases de ~240 líneas casi idénticas: mismo pedestal, misma
 * sombra, mismo movimiento, mismo apuntado y mismo ciclo de disparo; solo
 * cambiaban la configuración del arte y los instantes de la animación. Aquí
 * vive esa lógica una sola vez y cada defensa aporta (config, keys, fireStages).
 *
 * `fireStages` son los milisegundos [fin del estado 1, fin del estado 2]
 * medidos desde el disparo; el estado 0 es reposo. Así se conserva el ritmo
 * propio de cada arma sin tocar la configuración de balance.
 */
export class DefenseTower {
  constructor(scene, x, y, level, config, keys, fireStages) {
    this.scene = scene;
    this.config = config;
    this.keys = keys;
    this.tex = createDefenseTextures(config, keys);
    this.fireStages = fireStages;

    this.kind = config.kind;
    this.name = config.name;
    this.size = config.size;
    this.x = x;
    this.y = y;
    this.level = level;
    this.placed = true;
    this.selected = false;
    this.shotAt = -Infinity;
    this.yaw = -1;
    this.state = -1;
    this.target = { ...config.defaultTarget };

    this.tex.ensure(scene);
    this.tex.ensureRock(scene);
    this.artScale = config.artScale;

    // La estructura se dibuja después de la última casilla de su huella.
    const depth = x + y + this.size;

    // Suelo de roca bajo la huella. Se crea vacío y se dibuja en drawGround()
    // para poder recolocarlo al terminar un movimiento.
    this.ground = scene.add.image(0, 0, keys.rock)
      .setOrigin(0.5, 0)
      .setDisplaySize(this.size * TILE_W, this.size * TILE_H)
      .setDepth(depth + 0.01);
    this.rockFilter = -1;

    // Sombra bajo el diseño, igual que drawBuildingGround(). El Graphics se
    // redibuja (no basta con moverlo) porque la elipse está horneada en él.
    this.shadow = scene.add.graphics().setDepth(depth + 0.02);
    this.drawGround();
    this.drawShadow();

    const center = iso(x + this.size / 2, y + this.size / 2, 0);

    // El ancla del pedestal coincide con el centro de la huella; el pivote de
    // la cabeza queda a headLift px por encima (misma cámara para las tres).
    this.anchor = this.baseTopLeft(center);
    const headTopLeft = this.headTopLeft(center);

    this.base = scene.add.image(this.anchor.x, this.anchor.y, keys.base)
      .setOrigin(0, 0).setScale(this.artScale).setDepth(depth + 0.03);

    this.head = scene.add.image(
      headTopLeft.x, headTopLeft.y,
      this.tex.headAtlasKey(0), this.tex.headFrame(0, 0),
    ).setOrigin(0, 0).setScale(this.artScale).setDepth(depth + 0.04);

    this.destroyed = false;
    this.working = false;
    this.floating = false;
    this.hidden = false;
    this.drawOrigin = null;
    this.baseDepth = depth + 0.03;
    this.headDepth = depth + 0.04;

    this.update(0);
  }

  // Esquina superior izquierda del pedestal para una posición isométrica.
  baseTopLeft(center) {
    const px = this.artScale;
    const { baseGround } = this.config.model;
    return {
      x: center.x - baseGround.x * px,
      y: center.y - baseGround.y * px,
    };
  }

  // Esquina superior izquierda del frame de cabeza: el pivote (128,128) debe
  // caer sobre el sillín del pedestal, elevado `headLift` px.
  headTopLeft(center) {
    const px = this.artScale;
    const pad = this.config.sheetPad;
    const { headPivot, headLift } = this.config.model;
    return {
      x: center.x - (headPivot.x + pad) * px,
      y: center.y - (headPivot.y + headLift + pad) * px,
    };
  }

  // Dibuja el parche de roca en la huella ACTUAL. Se llama al crear y al
  // confirmar un movimiento; antes solo se ocultaba y quedaba abandonado en
  // la casilla anterior (bug visual reportado).
  drawGround() {
    const top = iso(this.x, this.y, 0);
    this.ground.setPosition(top.x, top.y);
  }

  drawShadow() {
    const c = iso(this.x + this.size / 2, this.y + this.size / 2, 0);
    this.shadow.clear();
    this.shadow.fillStyle(0x000000, 0.28);
    this.shadow.fillEllipse(
      c.x,
      c.y + 4 * SCALE,
      this.size * HALF_W * 0.62 * 2,
      this.size * HALF_H * 0.55 * 2,
    );
  }

  // Reposiciona pedestal y cabeza para una casilla y elevación dadas.
  placeAt(x, y, lift = 0) {
    this.x = x;
    this.y = y;
    const center = iso(x + this.size / 2, y + this.size / 2, lift);
    this.anchor = this.baseTopLeft(center);
    const headTopLeft = this.headTopLeft(center);
    this.base.setPosition(this.anchor.x, this.anchor.y);
    this.head.setPosition(headTopLeft.x, headTopLeft.y);
  }

  // Copia del modo Mover: dibuja sobre todo, translúcida, sin suelo ni sombra,
  // con el vaivén de la cabeza de *Fx() del legacy.
  setFloating(gx, gy, lift, time) {
    this.floating = true;
    this.ground.setVisible(false);
    this.shadow.setVisible(false);
    this.base.setAlpha(0.8).setDepth(OVERLAY_DEPTH + 0.03);
    this.head.setAlpha(0.8).setDepth(OVERLAY_DEPTH + 0.04);
    this.placeAt(gx, gy, lift);
    this.drawOrigin = { x: gx + this.size / 2, y: gy + this.size / 2 };
    this.update(time);
  }

  // Fase 8: una defensa destruida en la simulación deja de disparar y queda
  // como escombros. La base real no se toca: basta con ocultar el diseño.
  setDestroyed(on = true) {
    if (this.destroyed === on) return;
    this.destroyed = on;
    this.base.setVisible(!on);
    this.head.setVisible(!on);
    this.shadow.setVisible(!on);
    this.ground.setTint(on ? 0x6a625a : 0xffffff);
  }

  // Fase 9: en obras el diseño queda translúcido bajo el andamio.
  setWorking(on = true) {
    if (this.working === on) return;
    this.working = on;
    if (!this.floating) {
      this.base.setAlpha(on ? 0.55 : 1);
      this.head.setAlpha(on ? 0.55 : 1);
    }
  }

  // Lo usa el editor al guardar/colocar la defensa.
  setHidden(on = true) {
    if (this.hidden === on) return;
    this.hidden = on;
    this.ground.setVisible(!on);
    this.shadow.setVisible(!on && !this.destroyed);
    this.base.setVisible(!on);
    this.head.setVisible(!on);
  }

  setVisible(on = true) { this.setHidden(!on); }

  clearFloating() {
    this.floating = false;
    this.drawOrigin = null;
    // Sincroniza con la posición lógica aunque nunca se haya flotado
    // (commit programático o restauración del editor).
    this.ground.setVisible(!this.hidden);
    this.shadow.setVisible(!this.hidden && !this.destroyed);
    // Al colocarla en otro sitio cambia su profundidad isométrica.
    const depth = this.x + this.y + this.size;
    this.baseDepth = depth + 0.03;
    this.headDepth = depth + 0.04;
    this.ground.setDepth(depth + 0.01);
    this.shadow.setDepth(depth + 0.02);
    this.drawGround();
    this.drawShadow();
    const alpha = this.working ? 0.55 : 1;
    this.base.setAlpha(alpha).setDepth(this.baseDepth);
    this.head.setAlpha(alpha).setDepth(this.headDepth);
    this.placeAt(this.x, this.y, 0);
    this.update(this.scene.time.now);
  }

  get center() {
    if (this.drawOrigin) return this.drawOrigin;
    return {
      x: this.x + this.size / 2,
      y: this.y + this.size / 2,
    };
  }

  // Objetivo en coordenadas de casilla (centro de la celda).
  aimAt(x, y) {
    this.target.x = x;
    this.target.y = y;
  }

  aimAtEntrance() {
    this.target.x = this.config.defaultTarget.x;
    this.target.y = this.config.defaultTarget.y;
  }

  // Ángulo en pantalla desde el centro de la huella hasta el objetivo.
  // `wobble` es el vaivén de la copia flotante (+sin(t/260)*0.09).
  yawToTarget(wobble = 0) {
    const from = iso(this.center.x, this.center.y, 0);
    const to = iso(this.target.x, this.target.y, 0);
    const rel = Math.atan2(-(to.y - from.y), to.x - from.x) + wobble;
    const step = (Math.PI * 2) / this.config.yawFrames;
    // Cuantización a 15° tal cual la hoja de sprites (0..23, sin frame duplicado).
    return ((Math.round(rel / step) % this.config.yawFrames) + this.config.yawFrames) % this.config.yawFrames;
  }

  fire(time = this.scene.time.now) {
    this.shotAt = time;
  }

  // El proyectil nace en el fogón/cazo del modelo, no en el centro de la huella.
  shotOrigin() {
    return shotOrigin(this, this.config.kind);
  }

  // El filtro de la roca cambia con el zoom, como imageSmoothingEnabled en el
  // legacy: nítido al ampliar, suave al alejar.
  syncRockFilter() {
    const zoom = this.scene.cameras.main.zoom || 1;
    const mode = this.tex.rockSmoothing(zoom)
      ? Phaser.Textures.FilterMode.LINEAR
      : Phaser.Textures.FilterMode.NEAREST;
    if (mode === this.rockFilter) return;
    this.rockFilter = mode;
    this.scene.textures.get(this.keys.rock).setFilter(mode);
  }

  update(time) {
    this.syncRockFilter();
    const wobble = this.floating ? Math.sin(time / 260) * 0.09 : 0;
    const yaw = this.yawToTarget(wobble);
    const age = time - this.shotAt;
    const state = age < this.fireStages[0] ? 1 : age < this.fireStages[1] ? 2 : 0;

    if (yaw === this.yaw && state === this.state) return;

    this.yaw = yaw;
    this.state = state;
    this.head.setTexture(
      this.tex.headAtlasKey(this.tex.headGroup(yaw)),
      this.tex.headFrame(yaw, state),
    );
  }

  destroy() {
    this.ground.destroy();
    this.shadow.destroy();
    this.base.destroy();
    this.head.destroy();
  }
}
