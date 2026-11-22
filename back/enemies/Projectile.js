/* ==========================================================
 * FASE 8 — PROYECTILES
 * ----------------------------------------------------------
 * stepBolts() del legacy: la saeta sigue a la tropa y acierta siempre.
 * La catapulta es distinta (como el mortero de Clash of Clans): dispara a
 * un punto de suelo fijo, sin seguimiento, con dispersión y daño de área.
 * Las tropas pueden esquivarla moviéndose fuera de la zona de impacto.
 *
 * El vuelo se interpola en coordenadas de casilla y se proyecta con
 * iso(x, y, z) para que la altura se vea en pantalla.
 * ========================================================== */

import { iso } from '../systems/iso.js';
import { BOLT_TEX, IMPACT_TEX } from './troopArt.js';

export class Projectile {
  constructor(scene, {
    x0, y0, z0 = 26, speed = 12, damage, target, onHit, splash = 0,
    homing = true, texture = BOLT_TEX, impactTexture = IMPACT_TEX,
    arc = 6, spin = false,
  }) {
    this.scene = scene;
    this.x0 = x0;
    this.y0 = y0;
    this.z0 = z0;
    this.speed = speed;
    this.damage = damage;
    this.splash = splash;
    this.target = target;
    this.onHit = onHit;
    // Un tiro balístico no persigue a la tropa: recuerda el punto elegido
    // al disparar, aunque la tropa se mueva o muera antes del impacto.
    this.homing = homing;
    this.missed = Boolean(target?.missed);
    this.arc = arc;
    this.spin = spin;
    this.spinAngle = 0;
    this.texture = texture;
    this.impactTexture = impactTexture;
    this.lx = target.x;
    this.ly = target.y;
    this.k = 0;
    this.done = false;

    const p = iso(x0, y0, z0);
    this.sprite = scene.add.image(p.x, p.y, texture)
      .setOrigin(0.5, 0.5)
      .setDepth(x0 + y0 + 0.9);
    this.prev = p;
  }

  update(dt) {
    if (this.done) return true;
    const t = this.target;
    if (this.homing && t && t.hp > 0) {
      this.lx = t.x;
      this.ly = t.y;
    }
    const dist = Math.max(0.5, Math.hypot(this.lx - this.x0, this.ly - this.y0));
    this.k += dt * this.speed / dist;
    const k = Math.min(1, this.k);
    const px = this.x0 + (this.lx - this.x0) * k;
    const py = this.y0 + (this.ly - this.y0) * k;
    const pz = this.z0 + (24 - this.z0) * k + Math.sin(Math.PI * k) * this.arc;
    const p = iso(px, py, pz);
    this.sprite.setPosition(p.x, p.y);
    if (this.spin) {
      this.spinAngle += dt * 9;
      this.sprite.setRotation(this.spinAngle);
    } else {
      this.sprite.setRotation(Math.atan2(p.y - this.prev.y, p.x - this.prev.x));
    }
    this.sprite.setDepth(px + py + 0.9);
    this.prev = p;

    if (this.k < 1) return false;
    this.done = true;
    this.onHit?.(t, this.damage, {
      x: this.lx, y: this.ly, splash: this.splash, missed: this.missed,
    });
    this.impact(p, px + py + 0.92);
    this.sprite.destroy();
    return true;
  }

  impact(p, depth) {
    const fx = this.scene.add.image(p.x, p.y, this.impactTexture)
      .setDepth(depth);
    this.scene.tweens.add({
      targets: fx,
      alpha: 0,
      scale: this.splash ? 2.1 : 1.8,
      duration: this.splash ? 320 : 220,
      onComplete: () => fx.destroy(),
    });
  }

  destroy() {
    if (!this.done) this.sprite.destroy();
    this.done = true;
  }
}
