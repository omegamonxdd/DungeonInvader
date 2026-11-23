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
  constructor(scene, invasion, typeId, level, post, x, y) {
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

    const key = troopTextureKey(typeId);
    this.sprite = scene.add.image(0, 0, scene.textures.exists(key) ? key : troopTextureKey('esqueleto'))
      .setOrigin(0.5, 0.82).setTint(0xbfe0ff);
    this.gfx = scene.add.graphics();
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

    const t = this.nearestInvader();
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
      this.stepTowards(this.post.x, this.post.y, dt);
    }
    this.render(time);
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
    else if (this.sprite.isTinted) this.sprite.setTint(0xbfe0ff);

    const g = this.gfx;
    g.setDepth(depth + 0.02);
    g.clear();
    const barY = p.y - this.art.h * 0.82;
    g.fillStyle(0x14100d, 0.9);
    g.fillRect(p.x - 11, barY, 22, 4);
    g.fillStyle(this.hp / this.maxHp > 0.4 ? 0x6aa8ff : 0xd45a5a, 1);
    g.fillRect(p.x - 10, barY + 1, Math.max(0, Math.round(20 * this.hp / this.maxHp)), 2);
  }

  destroy() {
    this.sprite.destroy();
    this.gfx.destroy();
  }
}
