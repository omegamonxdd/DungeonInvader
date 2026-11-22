import { iso } from '../systems/iso.js';
import { CORE_MIN, CORE_SIZE, CORE_HEIGHT } from '../config/world.js';
import { CORE_ART } from '../config/coreArt.js';

/* Núcleo de la mazmorra.
 * Arte 2.5D horneado OFFLINE desde un modelo 3D con cámara isométrica real
 * (tools/core-art/generate.mjs): plataforma de piedra, 4 pilares agrietados
 * y cristal cian. Aquí solo se coloca el sprite sobre la huella 3×3 del
 * terreno y se anima el resplandor; ya no se dibuja geometría en pantalla.
 */

const PULSE_MS = 650;

export class CoreView {
  constructor(scene, x = CORE_MIN, y = CORE_MIN, size = CORE_SIZE) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.size = size;
    this.floating = false;
    this.lift = 0;
    this.hidden = false;

    this.glow = scene.add.image(0, 0, CORE_ART.glowTexture).setDepth(0);
    this.image = scene.add.image(0, 0, CORE_ART.texture)
      .setOrigin(0, 0)
      .setScale(CORE_ART.artScale)
      .setDepth(0);

    this.setDepth(this.lastCell());
    this.draw();
    this.update(0);
  }

  lastCell() {
    return this.x + this.size - 1 + this.y + this.size - 1;
  }

  setDepth(last) {
    this.glow.setDepth(last + 0.25);
    this.image.setDepth(last + 0.45);
  }

  // Coloca el ancla del PNG en el centro de la huella, sobre la cara superior
  // del bloque del núcleo (CORE_HEIGHT), con el desplazamiento del editor.
  draw() {
    const lift = this.floating ? this.lift || 0 : 0;
    const center = iso(this.x + this.size / 2, this.y + this.size / 2, CORE_HEIGHT + lift);
    const px = CORE_ART.artScale;

    this.image.setPosition(
      center.x - CORE_ART.anchor.x * px,
      center.y - CORE_ART.anchor.y * px,
    );
    this.glow
      .setPosition(center.x, center.y - CORE_ART.glow.lift * px)
      .setDisplaySize(CORE_ART.glow.size * px, CORE_ART.glow.size * px);
  }

  // El editor puede retirar y recolocar el núcleo; su vista sigue a def.x/y.
  placeAt(x, y) {
    this.x = x;
    this.y = y;
    this.setDepth(this.lastCell());
    this.draw();
    this.update(this.scene.time.now);
  }

  setFloating(gx, gy, lift, time) {
    this.floating = true;
    this.lift = lift;
    this.x = gx;
    this.y = gy;
    this.setDepth(this.lastCell());
    this.draw();
    this.update(time);
  }

  clearFloating() {
    if (!this.floating) return;
    this.floating = false;
    this.lift = 0;
    this.placeAt(this.x, this.y);
  }

  setHidden(on = true) {
    this.hidden = on;
    this.glow.setVisible(!on);
    this.image.setVisible(!on);
  }

  setVisible(on = true) { this.setHidden(!on); }

  update(time) {
    const pulse = (Math.sin(time / PULSE_MS) + 1) / 2;
    this.glow.setAlpha(0.42 + pulse * 0.26);
  }
}
