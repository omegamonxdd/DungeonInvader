/* ==========================================================
 * FASE 10 — DEFENSORES DE ESTANDARTE
 * ----------------------------------------------------------
 * Los estandartes generan defensores al empezar la invasión. Viven solo en
 * la simulación: atacan a la tropa más cercana dentro de suradio y vuelven
 * a su puesto. No reaparecen hasta la siguiente invasión.
 * ========================================================== */

import { tropaAt, troopDamageAt, troopIntervalAt } from '../balance/index.js';
import { iso } from '../systems/iso.js';
import { TROOP_ART, troopTextureKey } from './troopArt.js';

export class Defender {
  constructor(scene, invasion, typeId, level, post, x, y, opts = {}) {
    this.scene = scene;
    this.invasion = invasion;
    this.typeId = typeId;
    this.level = level;
    this.post = { ...post };
    this.x = x;
    this.y = y;
    this.art = TROOP_ART[typeId] || TROOP_ART.esqueleto;
    const def = invasion.troopDef(typeId);
    const row = tropaAt(typeId, level) || tropaAt(typeId, 1);
    this.maxHp = row.hp;
    this.hp = row.hp;
    this.damage = troopDamageAt(typeId, level);
    this.interval = troopIntervalAt(typeId, level);
    this.speed = def.speed || 2;
    this.range = def.range || 1;
    this.guardRange = invasion.guardRangeFor(typeId);
    this.cd = 0;
    this.atk = 0;
    this.hurt = 0;
    this.target = null;
    this.dead = false;
    this.home = Boolean(opts.home);
    this.label = opts.label || null;
    this.maxLabel = Boolean(opts.maxLabel);

    const key = troopTextureKey(typeId);
    this.sprite = scene.add.image(0, 0, scene.textures.exists(key) ? key : troopTextureKey('esqueleto'))
      .setOrigin(0.5, 0.82);
    if (!this.home) this.sprite.setTint(0xbfe0ff);
    this.gfx = scene.add.graphics();
    if (this.home) this.labelText = scene.add.text(0, 0, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(0);
    this.render(0);
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.hurt = 1;
    return this.hp <= 0;
  }

  nearestInvader() {
    let best = null;
    let bestD = this.guardRange;
    for (const t of this.invasion.troops) {
      if (t.hp <= 0) continue;
      const d = Math.hypot(t.x - this.post.x, t.y - this.post.y);
      if (d < bestD) { best = t; bestD = d; }
    }
    return best;
  }

  update(dt, time) {
    this.cd = Math.max(0, this.cd - dt);
    this.atk = Math.max(0, this.atk - dt / 0.3);
    this.hurt = Math.max(0, this.hurt - dt / 0.18);

    const t = this.home ? null : this.nearestInvader();
    this.target = t;
    if (t) {
      const d = Math.hypot(t.x - this.x, t.y - this.y);
      if (d <= this.range) {
        if (this.cd <= 0) {
          t.takeDamage(this.damage);
          t.guardAttacker = this;
          this.cd = this.interval;
          this.atk = 1;
        }
      } else {
        this.stepTowards(t.x, t.y, dt);
      }
    } else {
      this.stepHome(dt, time);
    }
    this.render(time);
  }

  stepHome(dt, time) {
    if (!this.home) { this.stepTowards(this.post.x, this.post.y, dt); return; }
    if (!this.homeTarget || Math.hypot(this.homeTarget.x - this.x, this.homeTarget.y - this.y) < 0.08) {
      const a = (time / 900) + (this.post.x * 1.7 + this.post.y * 0.9);
      const r = 0.35 + ((Math.sin(time / 1300 + this.post.y) + 1) * 0.35);
      this.homeTarget = {
        x: this.post.x + Math.cos(a) * r,
        y: this.post.y + Math.sin(a * 0.8) * r * 0.7,
      };
    }
    this.stepTowards(this.homeTarget.x, this.homeTarget.y, dt * 0.55);
  }

  stepTowards(x, y, dt) {
    const dx = x - this.x;
    const dy = y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.05) return;
    const step = Math.min(d, this.speed * dt);
    this.x += dx / d * step;
    this.y += dy / d * step;
  }

  render(time) {
    const bob = Math.sin(time / 220 + this.post.x) * 1.1 - (this.atk ? 1.5 : 0);
    const p = iso(this.x, this.y, bob);
    const depth = this.x + this.y + 0.56;
    this.sprite.setPosition(p.x, p.y).setDepth(depth);
    if (this.hurt > 0) this.sprite.setTintFill(0xff6a5a);
    else if (this.sprite.isTinted && !this.home) this.sprite.clearTint().setTint(0xbfe0ff);
    else if (this.sprite.isTinted && this.home) this.sprite.clearTint();

    const g = this.gfx;
    g.setDepth(depth + 0.02);
    g.clear();

    if (this.label) {
      const txt = String(this.label);
      const w = Math.max(18, txt.length * 7 + 8);
      const h = 14;
      const y = p.y - this.art.h * 0.9 - 10;
      g.fillStyle(0x14100d, 0.92);
      g.fillRoundedRect(p.x - w / 2, y - h, w, h, 3);
      g.lineStyle(1, this.maxLabel ? 0x77d7ff : 0xd4a017, 1);
      g.strokeRoundedRect(p.x - w / 2, y - h, w, h, 3);
      if (this.maxLabel) {
        // Fuego azul simple (provisional) sobre el badge.
        const flick = Math.sin(time / 90 + this.post.x * 3) * 1.5;
        g.fillStyle(0x4fc3ff, 0.95);
        g.fillTriangle(p.x - 7, y - h - 2, p.x - 3, y - h - 10 - flick, p.x + 1, y - h - 2);
        g.fillStyle(0x4fc3ff, 0.85);
        g.fillTriangle(p.x + 1, y - h - 2, p.x + 4, y - h - 8 + flick, p.x + 7, y - h - 2);
        g.fillStyle(0xdff7ff, 0.9);
        g.fillTriangle(p.x - 4, y - h - 2, p.x - 2, y - h - 7 - flick, p.x, y - h - 2);
      }
      if (this.labelText) {
        this.labelText.setText(txt).setPosition(p.x, y - 1).setDepth(depth + 0.03).setVisible(true);
        this.labelText.setColor(this.maxLabel ? '#bfefff' : '#ffe3a1');
      }
    } else if (this.labelText) this.labelText.setVisible(false);

    if (!this.home) {
      const barY = p.y - this.art.h * 0.82;
      g.fillStyle(0x14100d, 0.9);
      g.fillRect(p.x - 11, barY, 22, 4);
      g.fillStyle(this.hp / this.maxHp > 0.4 ? 0x6aa8ff : 0xd45a5a, 1);
      g.fillRect(p.x - 10, barY + 1, Math.max(0, Math.round(20 * this.hp / this.maxHp)), 2);
    }
  }

  destroy() {
    this.sprite.destroy();
    this.gfx.destroy();
    this.labelText?.destroy();
  }

  destroy() {
    this.sprite.destroy();
    this.gfx.destroy();
    this.labelText?.destroy();
  }
}
