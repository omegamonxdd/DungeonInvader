/* ==========================================================
 * FASE 8 — TROPA INVASORA
 * ----------------------------------------------------------
 * Equivale al objeto de js/invasion/17 + updateTroop() del legacy.
 * Toda estadística sale de balance/08-tropas.js; aquí solo está el
 * movimiento por el camino, el ataque a estructuras y el dibujo.
 * ========================================================== */

import { tropaAt } from '../balance/index.js';
import { ENTRANCE_X, ENTRANCE_Y_MIN } from '../config/world.js';
import { iso } from '../systems/iso.js';
import { distToRect } from './pathfinding.js';
import { specFor } from '../systems/structureSpecs.js';
import { TROOP_ART, troopTextureKey } from './troopArt.js';

export class Troop {
  constructor(scene, invasion, typeId, level, seq, opts = {}) {
    this.scene = scene;
    this.invasion = invasion;
    this.typeId = typeId;
    this.level = level;
    this.id = seq;

    const def = invasion.troopDef(typeId);
    const row = tropaAt(typeId, level);
    this.def = def;
    this.art = TROOP_ART[typeId] || TROOP_ART.esqueleto;
    this.maxHp = row.hp;
    this.hp = row.hp;
    this.damage = row.damage ?? Math.round(row.dps * def.interval);
    this.speed = def.speed;
    this.interval = def.interval;
    this.range = def.range;
    this.flying = Boolean(def.flying);
    this.structMult = def.structMult || 1;

    // Las crías de araña nacen junto a la madre: no salen por la entrada,
    // no se seleccionan y no obedecen órdenes (como en 19b-aranas.js).
    this.summoned = Boolean(opts.summoned || def.source === 'summoned');
    this.babiesLeft = row.babies || 0;
    this.babyStep = def.danoPorCria || 50;
    this.dmgAcc = 0;
    this.hpPrev = this.hp;

    const iy = ENTRANCE_Y_MIN + (seq % 3);
    this.laneY = iy + 0.5;
    this.x = opts.spawn?.x ?? ENTRANCE_X + 1.6;
    this.y = opts.spawn?.y ?? this.laneY;
    this.path = opts.spawn ? [] : [{ x: ENTRANCE_X + 0.5, y: this.laneY }];
    this.dest = null;
    this.target = null;
    this.auto = false;
    this.entering = !opts.spawn;
    this.cd = 0;
    this.atk = 0;
    this.hurt = 0;
    this.repath = 0;
    this.face = opts.face ?? -1;
    this.anim = Math.random() * 6;
    this.selected = false;
    this.dead = false;

    const texKey = scene.textures.exists(troopTextureKey(typeId))
      ? troopTextureKey(typeId) : troopTextureKey('esqueleto');
    this.sprite = scene.add.image(0, 0, texKey).setOrigin(0.5, 0.82);
    this.gfx = scene.add.graphics();

    if (!opts.spawn) {
      const slot = invasion.rallySlot(seq);
      const cell = invasion.path.nearestFree(slot.x, slot.y, invasion.open);
      if (cell) {
        const cells = invasion.path.find(ENTRANCE_X, iy, (x, y) => x === cell.x && y === cell.y, invasion.open);
        if (cells) {
          this.path.push(...cells, slot);
          this.dest = slot;
        }
      }
    }
    this.render(0);
  }

  // Órdenes del jugador (Fase 8: clic derecho sobre suelo o estructura).
  orderMove(dest) {
    const cell = this.invasion.path.nearestFree(dest.x, dest.y, this.invasion.open);
    if (!cell) return false;
    const cells = this.invasion.path.find(
      Math.floor(this.x), Math.floor(this.y),
      (x, y) => x === cell.x && y === cell.y,
      this.invasion.open,
    );
    if (!cells) return false;
    this.target = null;
    this.auto = false;
    this.entering = false;
    this.path = cells;
    this.dest = { x: cell.x + 0.5, y: cell.y + 0.5 };
    this.repath = 0;
    return true;
  }

  orderAttack(def) {
    const r = this.invasion.rectOf(def);
    const cells = this.invasion.path.find(
      Math.floor(this.x), Math.floor(this.y),
      (x, y) => distToRect(x + 0.5, y + 0.5, r) <= this.range - 0.1,
      this.invasion.open,
    );
    if (!cells) return false;
    this.target = def.id;
    this.auto = false;
    this.entering = false;
    this.path = cells;
    this.dest = null;
    this.repath = 0.5;
    return true;
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.hurt = 1;
    // Araña madre: 1 cría por cada `danoPorCria` de vida perdida (hasta su
    // límite por nivel). Las que falten salen al morir, en removeDead().
    if (this.babiesLeft > 0 && this.hp > 0) {
      this.dmgAcc += Math.max(0, this.hpPrev - this.hp);
      const n = Math.min(this.babiesLeft, Math.floor(this.dmgAcc / this.babyStep));
      if (n > 0) {
        this.dmgAcc -= n * this.babyStep;
        this.invasion.spawnBabies(this, n);
      }
    }
    this.hpPrev = this.hp;
    return this.hp <= 0;
  }

  update(dt, time) {
    this.cd = Math.max(0, this.cd - dt);
    this.atk = Math.max(0, this.atk - dt / 0.3);
    this.hurt = Math.max(0, this.hurt - dt / 0.18);
    this.repath -= dt;
    if (this.entering && this.x <= ENTRANCE_X + 0.99) this.entering = false;

    // Las tropas responden al defensor que las golpeó, como en el legacy.
    const guard = this.guardAttacker;
    if (guard && guard.hp > 0 && Math.hypot(guard.x - this.x, guard.y - this.y) <= this.range) {
      if (this.cd <= 0) {
        guard.takeDamage(this.damage);
        this.cd = this.interval;
        this.atk = 1;
      }
      this.render(time);
      return;
    }
    if (guard && guard.hp <= 0) this.guardAttacker = null;

    if (this.target) {
      const def = this.invasion.structureById(this.target);
      if (!def || (this.invasion.siege[this.target] ?? 1) <= 0) {
        this.target = null;
        this.auto = false;
      } else {
        const r = this.invasion.rectOf(def);
        if (distToRect(this.x, this.y, r) <= this.range) {
          this.path.length = 0;
          const dx = (r.x0 + r.x1) / 2 - this.x;
          const dy = (r.y0 + r.y1) / 2 - this.y;
          if (dx - dy) this.face = dx - dy > 0 ? 1 : -1;
          if (this.cd <= 0) {
            // El murciélago solo hace el doble de daño a edificios de recursos.
            const multi = this.structMult > 1 && specFor(def)?.category === 'recursos'
              ? this.structMult : 1;
            this.invasion.hitStructure(this, this.damage * multi);
            this.cd = this.interval;
            this.atk = 1;
          }
          this.render(time);
          return;
        }
        if (this.auto) {
          this.target = null;
          this.auto = false;
        } else if (!this.path.length && this.repath <= 0) {
          const cells = this.invasion.path.find(
            Math.floor(this.x), Math.floor(this.y),
            (x, y) => distToRect(x + 0.5, y + 0.5, r) <= this.range - 0.1,
            this.invasion.open,
          );
          if (cells?.length) this.path = cells;
          else this.target = null;
          this.repath = 0.5;
        }
      }
    }

    // Las crías van solas a por la estructura alcanzable más cercana.
    if (this.summoned) {
      if (!this.target && !this.path.length) this.invasion.assignSummonedTarget(this);
    } else if (!this.target && !this.path.length && !this.entering) {
      // Objetivo automático solo si está quieta, como en updateTroop().
      const near = this.invasion.nearestTarget(this.x, this.y, this.range);
      if (near) {
        this.target = near.def.id;
        this.auto = true;
      }
    }

    if (this.path.length) {
      const w = this.path[0];
      const dx = w.x - this.x;
      const dy = w.y - this.y;
      const d = Math.hypot(dx, dy);
      const step = this.speed * dt;
      if (dx - dy) this.face = dx - dy > 0 ? 1 : -1;
      if (d <= step) {
        this.x = w.x;
        this.y = w.y;
        this.path.shift();
      } else {
        this.x += dx / d * step;
        this.y += dy / d * step;
      }
      this.anim += dt * this.speed * 2.2;
    }
    if (!this.path.length) this.dest = null;
    this.render(time);
  }

  render(time) {
    const bob = (this.flying ? Math.sin(time / 150) * 3 : Math.sin(this.anim) * 1.2) + (this.atk ? -1.5 : 0);
    const p = iso(this.x, this.y, bob);
    const depth = this.x + this.y + 0.55;
    this.sprite.setPosition(p.x, p.y)
      .setDepth(depth)
      .setFlipX(this.face < 0)
      .setAlpha(this.atk ? 1 : 0.96);
    if (this.hurt > 0) this.sprite.setTintFill(0xff6a5a);
    else if (this.sprite.isTinted) this.sprite.clearTint();

    const g = this.gfx;
    g.setDepth(depth + 0.02);
    g.clear();
    if (this.selected) {
      const foot = iso(this.x, this.y, 0);
      g.lineStyle(1.5, 0xffd28a, 0.95);
      g.strokeEllipse(foot.x, foot.y + 2, 22, 11);
    }
    const barY = p.y - this.art.h * 0.82;
    g.fillStyle(0x14100d, 0.9);
    g.fillRect(p.x - 11, barY, 22, 4);
    g.fillStyle(this.hp / this.maxHp > 0.4 ? 0x5ad46a : 0xd45a5a, 1);
    g.fillRect(p.x - 10, barY + 1, Math.max(0, Math.round(20 * this.hp / this.maxHp)), 2);
  }

  destroy() {
    this.sprite.destroy();
    this.gfx.destroy();
  }
}
