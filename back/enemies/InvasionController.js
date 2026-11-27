/* ==========================================================
 * FASE 8 + FASE 10 — CONTROLADOR DE INVASIÓN
 * ----------------------------------------------------------
 * Reúne el reloj, la cola de despliegue, las tropas, los proyectiles,
 * las defensas, las trampas, los guardias de estandarte y la victoria/derrota.
 * Es el equivalente a los archivos 16–19 del legacy, pero sin tocar nunca la
 * vida real de la base: el daño vive en `siege`, así que al terminar todo
 * vuelve intacto.
 * ========================================================== */

import { BALANCE, levelRow } from '../balance/index.js';
import { CORE_HEIGHT, SCALE } from '../config/world.js';
import { OVERLAY_DEPTH } from '../config/interaction.js';
import { pickCell, pointInPolygon, structureAt, footprintPoly } from '../systems/picking.js';
import { iso } from '../systems/iso.js';
import {
  attackOf, maxHpOf as specMaxHp, pausedByWork, specFor,
} from '../systems/structureSpecs.js';
import { distToRect, PathFinder } from './pathfinding.js';
import {
  BOLT_TEX, DUST_TEX, IMPACT_TEX, STONE_TEX, ensureTroopTextures,
} from './troopArt.js';
import { shotOrigin } from '../systems/muzzle.js';
import { Projectile } from './Projectile.js';
import { Troop } from './Troop.js';
import { Defender } from './Defender.js';
import { getService } from '../database/GameService.js';
import {
  applyInvasionBase, captureOwnBase, loadInvasionBase, restoreOwnBase,
} from './invasionBase.js';

export class InvasionController {
  constructor(scene, deps) {
    this.scene = scene;
    this.terrain = deps.terrain;
    this.structures = deps.structures;
    this.armyRef = deps.army || null;
    this.resources = deps.resources || null;
    this.clearSelection = deps.clearSelection || (() => {});
    this.onToast = deps.onToast || (() => {});
    this.onState = deps.onState || (() => {});
    this.onEnd = deps.onEnd || (() => {});
    this.service = deps.service || getService();
    this.getContext = deps.getContext || (() => ({
      scene: this.scene,
      terrain: this.terrain,
      structures: this.structures,
      resources: this.resources,
      army: this.armyRef,
      invasion: this,
      stats: deps.stats,
    }));
    // Fuera de reset(): la base prestada/snapshot propio tiene que sobrevivir
    // a los reset() internos de start()/end()/applySnapshot().
    this.baseSwap = null;
    this.ownSnapshot = null;
    this.opponent = null;

    this.path = new PathFinder(this.terrain);
    // Estandartes, trampas y cualquier estructura sin vida son atravesables
    // en la simulación (leer passable desde PathFinder.walkable).
    this.path.passable = new Set();
    ensureTroopTextures(scene);
    this.fxG = scene.add.graphics().setDepth(OVERLAY_DEPTH + 30);
    this.reset();
  }

  // Un único sitio de reset, como invFresh() en el legacy.
  reset() {
    const snap = this.armyRef?.snapshot?.();
    this.active = false;
    this.phase = 'idle';           // idle | prep | battle | won | lost
    this.timeLeft = 0;
    this.army = snap ? { ...snap.counts } : { ...BALANCE.invasion.ejercitoPrueba };
    this.armyLevels = snap ? { ...snap.levels } : {};
    this.deployed = {};
    this.dead = {};
    this.queue = [];
    this.spawnT = 0;
    this.seq = 0;
    this.troops = [];
    this.defenders = [];
    this.bolts = [];
    this.effects = [];
    this.siege = {};
    this.hitAt = {};          // Último golpe recibido por cada estructura (para las barras)
    this.defs = {};
    this.traps = {};
    this.open = new Set();
    this.coreHitAt = -Infinity;
    this.coreDestroyed = false;
    this.lootGained = { coins: 0, crystals: 0, rubies: 0 };
    this.orderPreview = null;   // { kind: 'move'|'attack', x, y, defId? }
    this.fxG?.clear();
  }

  get over() { return this.phase === 'won' || this.phase === 'lost'; }

  get coreLevel() { return this.getContext?.()?.works?.coreLevel?.() || 1; }

  get vaultLootRate() { return BALANCE.invasion.botinAlmacenes ?? 0.25; }
  get producerLootRate() { return BALANCE.invasion.botinProductores ?? 0.5; }
  get coreLootRate() { return BALANCE.invasion.botinNucleo ?? 0.3; }

  troopDef(id) { return BALANCE.tropas.tipos[id]; }

  addLoot(resource, amount) {
    if (!this.resources || !resource || amount <= 0) return;
    // El botín se aplica al terminar la invasión, tras restaurar la base propia.
    // Durante la simulación solo se acumula para no mutar/doblar recursos reales.
    this.lootGained[resource] = (this.lootGained[resource] || 0) + amount;
  }

  vaultResource(def) {
    if (!def) return null;
    if (def.kind === 'vault-coins' || (def.kind === 'vault' && (def.resource || 'coins') === 'coins')) return 'coins';
    if (def.kind === 'vault-crystals' || (def.kind === 'vault' && def.resource === 'crystals')) return 'crystals';
    if (def.kind === 'vault-rubies' || (def.kind === 'vault' && def.resource === 'rubies')) return 'rubies';
    return null;
  }

  /** Botín que aún guarda una estructura viva. */
  lootOf(def) {
    if (!def?.placed || (this.siege[def.id] ?? this.maxHpOf(def)) <= 0) {
      return { resource: null, amount: 0 };
    }
    const spec = specFor(def);
    const vaultRes = this.vaultResource(def);
    if (vaultRes) {
      return {
        resource: vaultRes,
        amount: Math.max(0, Math.floor((def.stored || 0) * this.vaultLootRate)),
      };
    }
    if (spec?.producer) {
      return {
        resource: spec.producer.resource,
        amount: Math.max(0, Math.floor((def.pending || 0) * this.producerLootRate)),
      };
    }
    return { resource: null, amount: 0 };
  }

  /** Botín total que se ve en el panel; incluye base fija y núcleo vivo. */
  availableLoot() {
    const out = { coins: 0, crystals: 0, rubies: 0 };
    if (!this.active) return out;
    const base = BALANCE.invasion.botinBase || {};
    const rubiesUnlocked = this.coreLevel >= 4;
    out.coins = Math.max(0, Math.floor(base.coins || 0));
    out.crystals = Math.max(0, Math.floor(base.crystals || 0));
    out.rubies = rubiesUnlocked ? Math.max(0, Math.floor(base.rubies || 0)) : 0;
    for (const def of this.structures) {
      if (def?.kind === 'core') {
        if (!def.placed || (this.siege[def.id] ?? this.maxHpOf(def)) <= 0) continue;
        out.coins += Math.max(0, Math.floor((def.stored || 0) * this.coreLootRate));
        out.crystals += Math.max(0, Math.floor((def.storedCrystals || 0) * this.coreLootRate));
        if (rubiesUnlocked) out.rubies += Math.max(0, Math.floor((def.storedRubies || 0) * this.coreLootRate));
        continue;
      }
      const { resource, amount } = this.lootOf(def);
      if (resource === 'rubies' && !rubiesUnlocked) continue;
      if (resource && amount) out[resource] = (out[resource] || 0) + amount;
    }
    return out;
  }

  /** Se lleva el porcentaje de una estructura al destruirla. */
  takeLootFrom(def) {
    if (!def || !this.resources) return;
    const spec = specFor(def);
    const rubiesUnlocked = this.coreLevel >= 4;
    let resource = null;
    let current = 0;
    let rate = 0;
    const vaultRes = this.vaultResource(def);
    if (vaultRes) {
      resource = vaultRes;
      current = def.stored || 0;
      rate = this.vaultLootRate;
    } else if (spec?.producer) {
      resource = spec.producer.resource;
      current = def.pending || 0;
      rate = this.producerLootRate;
    }
    if (!resource) return;
    if (resource === 'rubies' && !rubiesUnlocked) return;
    const amount = Math.max(0, Math.floor(current * rate));
    if (amount <= 0) return;
    this.addLoot(resource, amount);
    if (vaultRes) def.stored = Math.max(0, current - amount);
    else def.pending = Math.max(0, current - amount);
  }

  takeCoreLoot(def) {
    if (!def || !this.resources) return;
    const rate = this.coreLootRate;
    const rubiesUnlocked = this.coreLevel >= 4;
    const coins = Math.max(0, Math.floor((def.stored || 0) * rate));
    const crystals = Math.max(0, Math.floor((def.storedCrystals || 0) * rate));
    const rubies = rubiesUnlocked ? Math.max(0, Math.floor((def.storedRubies || 0) * rate)) : 0;
    if (coins) this.addLoot('coins', coins);
    if (crystals) this.addLoot('crystals', crystals);
    if (rubies) this.addLoot('rubies', rubies);
    def.stored = Math.max(0, (def.stored || 0) - coins);
    def.storedCrystals = Math.max(0, (def.storedCrystals || 0) - crystals);
    if (rubiesUnlocked) def.storedRubies = Math.max(0, (def.storedRubies || 0) - rubies);
  }

  onCoreDestroyed(def) {
    if (this.coreDestroyed) return;
    this.coreDestroyed = true;
    this.takeCoreLoot(def);
    const base = BALANCE.invasion.botinBase || {};
    const rubiesUnlocked = this.coreLevel >= 4;
    if (base.coins > 0) this.addLoot('coins', Math.floor(base.coins));
    if (base.crystals > 0) this.addLoot('crystals', Math.floor(base.crystals));
    if (rubiesUnlocked && base.rubies > 0) this.addLoot('rubies', Math.floor(base.rubies));
    this.collapseBase();
  }

  /** Colapso de la mazmorra: al caer el núcleo se destruyen todos los
   *  edificios vivos, pero el botín aplica los mismos porcentajes de siempre
   *  (25 % almacenes, 50 % minas y talleres). */
  collapseBase() {
    for (const def of this.structures) {
      if (def.kind === 'core') {
        def.view?.setDestroyed?.(true);
        continue;
      }
      if ((this.siege[def.id] ?? this.maxHpOf(def)) <= 0) continue;
      this.takeLootFrom(def);
      this.siege[def.id] = 0;
      this.hitAt[def.id] = this.scene.time.now;
      def.view?.setDestroyed?.(true);
      const r = this.rectOf(def);
      for (let j = r.y0; j < r.y1; j++) {
        for (let i = r.x0; i < r.x1; i++) this.open.add(this.terrain.key(i, j));
      }
    }
  }

  guardRangeFor(typeId) {
    let range = 3;
    for (const def of this.structures) {
      const guard = specFor(def)?.guard;
      if (guard?.troop === typeId) range = Math.max(range, guard.range);
    }
    return range;
  }

  structureById(id) { return this.structures.find(d => d.id === id) || null; }

  // La huella de golpes sigue a la posición real de la estructura, incluido
  // el núcleo: si se ha movido, su hurtbox se mueve con él.
  rectOf(def) {
    return { x0: def.x, y0: def.y, x1: def.x + (def.w || def.size), y1: def.y + (def.h || def.size) };
  }

  maxHpOf(def) {
    if (def.kind === 'core') {
      const row = levelRow(BALANCE.nucleo.niveles, def.level || 1);
      return row?.hp ?? 1000;
    }
    return specMaxHp(def) || 1;
  }

  targetable(def) {
    if (!def || def.kind === 'entrance' || !def.placed) return false;
    const spec = specFor(def);
    if (!spec?.targetable || spec.hiddenInInvasion) return false;
    return (this.siege[def.id] ?? this.maxHpOf(def)) > 0;
  }

  targets() { return this.structures.filter(d => this.targetable(d)); }

  nearestTarget(x, y, range) {
    let best = null;
    let bestD = Infinity;
    for (const def of this.targets()) {
      const d = distToRect(x, y, this.rectOf(def));
      if (d <= range && d < bestD) {
        best = { def, dist: d };
        bestD = d;
      }
    }
    return best;
  }

  reserve() {
    let n = 0;
    for (const [id, total] of Object.entries(this.army)) {
      n += Math.max(0, total - (this.deployed[id] || 0));
    }
    return n;
  }

  inField() { return this.troops.length + this.queue.length; }

  /* ---------- Ciclo de vida --------------------------------------------- */

  async start({ opponentId = null, opponentName = '' } = {}) {
    if (this.active) return false;

    // No se puede invadir con el ejército vacío. La grieta es gratuita, así
    // que siempre se puede invocar algo antes: no hay bloqueo posible.
    const army = this.armyRef?.snapshot?.();
    const troops = Object.values(army?.counts || {})
      .reduce((n, count) => n + Math.max(0, count || 0), 0);
    if (!troops) {
      this.onToast('Invoca al menos 1 tropa antes de invadir');
      return false;
    }

    if (opponentId && String(opponentId) === String(this.service?.auth?.id)) {
      this.onToast('No puedes invadir tu propia base');
      return false;
    }

    const ctx = this.getContext();
    const service = this.service || getService();
    let own = null;

    // Sin rival (invitado / sin nube) se mantiene la simulación de siempre
    // sobre la propia base. Con rival se monta su copia en la escena.
    if (opponentId && service?.repository?.remoteEnabled) {
      service.invasionPreparing = true;
      try {
        const loaded = await loadInvasionBase(service, opponentId);
        if (!loaded.ok) {
          this.onToast(loaded.reason === 'blocked'
            ? 'Ese jugador dejó el camino bloqueado y no tiene copia válida'
            : 'No se pudo cargar la base del rival');
          return false;
        }
        own = captureOwnBase(ctx);
        // Se marca el cambio ANTES de aplicar la copia: así el HUD congela
        // los totales del jugador en vez de leer los almacenes del rival.
        this.baseSwap = { own };
        this.scene?.ui?.cacheOwnResources?.();
        applyInvasionBase(ctx, loaded.snapshot);
        this.opponent = {
          id: opponentId,
          name: opponentName || 'Rival',
          usedCheckpoint: loaded.usedCheckpoint,
        };
      } catch (err) {
        console.warn('[invasion] No se pudo preparar la base del rival:', err);
        this.onToast('No se pudo cargar la base del rival');
        if (own) restoreOwnBase(ctx, own);
        this.baseSwap = null;
        this.opponent = null;
        return false;
      } finally {
        if (service) service.invasionPreparing = false;
      }
    }

    // La comprobación se hace ya sobre la base que se va a invadir: el
    // terreno prestado recalcula pathValid al aplicar el snapshot.
    if (!this.terrain.pathValid) {
      this.onToast('El núcleo está bloqueado: abre un camino desde la entrada');
      if (own) {
        restoreOwnBase(ctx, own);
        this.baseSwap = null;
        this.opponent = null;
      }
      return false;
    }
    // En invasión sin rival se simula sobre la base real: guardamos snapshot
    // para restaurarla al terminar y aplicar el botín una sola vez.
    if (!opponentId) this.ownSnapshot = captureOwnBase(ctx);
    this.reset();
    this.clearSelection();
    this.active = true;
    this.phase = 'prep';
    this.timeLeft = BALANCE.invasion.preparacionS;
    this.path.passable.clear();
    for (const def of this.structures) {
      const spec = specFor(def);
      if (!def.placed || !spec) continue;
      if (this.targetable(def)) this.siege[def.id] = this.maxHpOf(def);
      if (!spec.hp || spec.category === 'trampas' || spec.category === 'estandartes') {
        for (let j = 0; j < (def.h || def.size); j++) {
          for (let i = 0; i < (def.w || def.size); i++) {
            this.path.passable.add(this.terrain.key(def.x + i, def.y + j));
          }
        }
      }
      if (spec.hiddenInInvasion) def.view?.setHidden?.(true);
    }
    this.spawnGuards();
    this.terrain.setTool(null);
    document.body.classList.add('invading');
    document.body.classList.remove('inv-end');
    if (this.opponent) {
      this.onToast(`Invadiendo la base de ${this.opponent.name}`);
      if (this.opponent.usedCheckpoint) {
        this.onToast('El camino del rival estaba bloqueado: se usó su última base válida');
      }
    }
    this.onState(this);
    return true;
  }

  end() {
    if (!this.active) return;
    for (const t of this.troops) t.destroy();
    for (const b of this.bolts) b.destroy();
    for (const g of this.defenders) g.destroy();
    for (const def of this.structures) {
      def.view?.setDestroyed?.(false);
      def.view?.setHidden?.(false);
    }
    const swap = this.baseSwap;
    const own = swap?.own || this.ownSnapshot;
    const loot = this.pendingLoot || {
      coins: Math.max(0, Math.floor(this.lootGained?.coins || 0)),
      crystals: Math.max(0, Math.floor(this.lootGained?.crystals || 0)),
      rubies: Math.max(0, Math.floor(this.lootGained?.rubies || 0)),
    };
    this.pendingLoot = null;
    // Solo se entrega el botín obtenido destruyendo núcleo/almacenes/productores.
    const granted = { coins: 0, crystals: 0, rubies: 0 };
    const grantLoot = (resources) => {
      if (!resources) return;
      if (loot.coins) granted.coins = resources.add('coins', loot.coins);
      if (loot.crystals) granted.crystals = resources.add('crystals', loot.crystals);
      if (loot.rubies) granted.rubies = resources.add('rubies', loot.rubies);
    };
    this.baseSwap = null;
    this.ownSnapshot = null;
    this.opponent = null;
    document.body.classList.remove('invading', 'inv-end');
    if (own) {
      const ctx = this.getContext();
      restoreOwnBase(ctx, own);
      // restoreOwnBase reaplica el snapshot propio, que tiene los recursos
      // de ANTES del botín: se suman aquí para que flushPending() los guarde.
      grantLoot(ctx.resources || this.resources);
    } else {
      grantLoot(this.resources);
    }
    // applySnapshot ya refrescó el HUD con los recursos anteriores al botín:
    // se vuelve a sincronizar después de re-sumirlo.
    this.scene?.ui?.syncResources?.();
    if (granted.coins || granted.crystals || granted.rubies || loot.coins || loot.crystals || loot.rubies) {
      const lostCoins = Math.max(0, loot.coins - granted.coins);
      const lostCrystals = Math.max(0, loot.crystals - granted.crystals);
      const lostRubies = Math.max(0, loot.rubies - granted.rubies);
      const lost = lostCoins + lostCrystals + lostRubies;
      const msg = `Botín: +${granted.coins} oro · +${granted.crystals} cristales · +${granted.rubies} rubíes`;
      this.onToast(lost > 0 ? `${msg} · Almacenes llenos (${lost} descartado)` : msg);
    }
    this.reset();
    if (own) {
      // finish() pudo dejar guardados/cargas pospuestos mientras la simulación
      // estaba montada. Se aplican ya con la base propia de vuelta y con
      // `active` en falso, para que save() no se vuelva a diferir.
      (this.service || getService())?.flushPending?.();
    }
    this.onState(this);
  }

  finish(kind, sub) {
    if (this.over) return;
    this.phase = kind;
    this.timeLeft = Math.max(0, this.timeLeft);
    for (const b of this.bolts) b.destroy();
    this.bolts = [];
    this.pendingLoot = {
      coins: Math.max(0, Math.floor(this.lootGained?.coins || 0)),
      crystals: Math.max(0, Math.floor(this.lootGained?.crystals || 0)),
      rubies: Math.max(0, Math.floor(this.lootGained?.rubies || 0)),
    };
    document.body.classList.add('inv-end');
    this.onEnd({ kind, sub });
    this.onState(this);
  }

  /* ---------- Ejército y guardias -------------------------------------- */

  deploy(typeId) {
    if (!this.active || this.over || !this.army[typeId]) return false;
    if (typeId === 'rag' && this.armyRef?.isRagUpgrading?.()) return false;
    if ((this.deployed[typeId] || 0) >= this.army[typeId]) return false;
    this.deployed[typeId] = (this.deployed[typeId] || 0) + 1;
    this.queue.push(typeId);
    if (this.phase === 'prep') {
      this.phase = 'battle';
      this.timeLeft = BALANCE.invasion.batallaS;
    }
    this.onState(this);
    return true;
  }

  spawn(typeId) {
    const level = this.armyLevels[typeId] || 1;
    const t = new Troop(this.scene, this, typeId, level, ++this.seq);
    this.troops.push(t);
  }

  // Port de spawnBabySpiders(): saltan junto a la madre, en su casilla, para
  // que siempre tengan un suelo válido por el que caminar.
  spawnBabies(mother, n) {
    const ix = Math.floor(mother.x);
    const iy = Math.floor(mother.y);
    const babyLvl = levelRow(BALANCE.tropas.nivelBebePorNivel, mother.level) || 1; // TODO balance
    for (let i = 0; i < n; i++) {
      const jitter = (span) => (Math.random() - 0.5) * span;
      const x = Math.min(ix + 0.9, Math.max(ix + 0.1, mother.x + jitter(0.6)));
      const y = Math.min(iy + 0.9, Math.max(iy + 0.1, mother.y + jitter(0.6)));
      this.troops.push(new Troop(this.scene, this, 'arana-bebe', babyLvl, ++this.seq, {
        spawn: { x, y }, summoned: true, face: mother.face,
      }));
    }
    mother.babiesLeft -= n;
    this.effects.push({
      type: 'ring', x: mother.x, y: mother.y, r: 0.4,
      born: this.scene.time.now, life: 300, color: 0xa58cff,
    });
  }

  // Port de assignSummonedTarget(): la cría elige por camino más corto la
  // estructura *alcanzable* más cercana y va a por ella sin recibir órdenes.
  assignSummonedTarget(t) {
    const rects = this.targets().map(def => [def, this.rectOf(def)]);
    if (!rects.length) return;
    let hit = null;
    const cells = this.path.find(
      Math.floor(t.x), Math.floor(t.y),
      (x, y) => {
        for (const [def, r] of rects) {
          if (distToRect(x + 0.5, y + 0.5, r) <= t.range - 0.1) {
            hit = def;
            return true;
          }
        }
        return false;
      },
      this.open,
    );
    if (!cells || !hit) return;
    t.target = hit.id;
    t.auto = false;
    t.path = cells.length
      ? cells
      : [{ x: Math.floor(t.x) + 0.5, y: Math.floor(t.y) + 0.5 }];
  }

  spawnGuards() {
    for (const def of this.structures) {
      const guard = specFor(def)?.guard;
      if (!guard || !def.placed || pausedByWork(def)) continue;
      if (guard.troop === 'rag' && this.armyRef?.isRagUpgrading?.()) continue;
      const n = guard.count(def.level || 1);
      const level = guard.levelFrom === 'army'
        ? (this.armyRef?.levelOf?.(guard.troop) || 1)
        : guard.level(def.level || 1);
      const cx = def.x + (def.w || def.size) / 2;
      const cy = def.y + (def.h || def.size) / 2;
      for (let i = 0; i < n; i++) {
        const col = i % 2 ? 0.28 : -0.28;
        const row = Math.floor(i / 2) * 0.3;
        const x = cx + col;
        const y = cy + row;
        this.defenders.push(new Defender(
          this.scene, this, guard.troop, level,
          { x, y }, x, y,
        ));
      }
    }
  }

  /* ---------- Paso de simulación ---------------------------------------- */

  step(deltaMs, time) {
    if (!this.active) return;
    const dt = Math.min(0.05, Math.max(0, deltaMs) / 1000);
    if (!this.over) {
      this.stepClock(dt);
      this.spawnT -= dt;
      if (this.queue.length && this.spawnT <= 0) {
        this.spawn(this.queue.shift());
        this.spawnT = BALANCE.invasion.gapDespliegueS;
      }
      for (const t of this.troops) t.update(dt, time);
      for (const g of this.defenders) g.update(dt, time);
      this.stepDefenses(dt, time);
      this.stepTraps(time);
      const alive = [];
      for (const b of this.bolts) {
        if (!b.update(dt)) alive.push(b);
      }
      this.bolts = alive;
      this.removeDead();
      this.checkLoss();
    }
    this.drawEffects(time);
    this.onState(this);
  }

  stepClock(dt) {
    this.timeLeft -= dt;
    if (this.timeLeft > 0) return;
    if (this.phase === 'prep') {
      this.phase = 'battle';
      this.timeLeft = BALANCE.invasion.batallaS;
    } else {
      this.timeLeft = 0;
      this.finish('lost', 'Se acabó el tiempo');
    }
  }

  stepDefenses(dt, time) {
    for (const def of this.structures) {
      const attack = attackOf(def);
      if (!attack || !def.placed || !def.view) continue;
      // En mejora siguen atacando las estructuras que no son defensas (no
      // tienen ataque); las defensas se detienen hasta que acaba la obra.
      if (pausedByWork(def)) continue;
      if ((this.siege[def.id] ?? 1) <= 0) continue;
      const st = this.defs[def.id] || (this.defs[def.id] = { cd: 0, target: null, beamTargets: [] });
      st.cd = Math.max(0, st.cd - dt);
      if (st.cd > 0) continue;

      const r = this.rectOf(def);
      const cx = (r.x0 + r.x1) / 2;
      const cy = (r.y0 + r.y1) / 2;
      const inRange = (u, range = attack.range, minRange = attack.minRange || 0) => {
        const d = Math.hypot(u.x - cx, u.y - cy);
        return d <= range && d >= minRange;
      };
      const pickPrimary = () => {
        let target = null;
        let targetHitting = false;
        let bestD = Infinity;
        for (const t of this.troops) {
          if (t.hp <= 0 || !inRange(t)) continue;
          const hitting = t.target === def.id && distToRect(t.x, t.y, r) <= t.range;
          const d = Math.hypot(t.x - cx, t.y - cy);
          if (!target || (hitting && !targetHitting) || (hitting === targetHitting && d < bestD)) {
            target = t;
            targetHitting = hitting;
            bestD = d;
          }
        }
        return target;
      };

      let target = st.target;
      const keep = target && target.hp > 0 && this.troops.includes(target) && inRange(target);
      if (!keep) target = pickPrimary();
      st.target = target;
      if (!target) {
        st.beamTargets = [];
        def.view.aimAtEntrance?.();
        continue;
      }

      def.view.aimAt?.(target.x, target.y);
      def.view.fire?.(time);
      const origin = def.view.shotOrigin?.() || { x: cx, y: cy, z: attack.z ?? 16 };

      if (attack.mode === 'chain') {
        const hit = [];
        let cur = target;
        let from = { x: cx, y: cy };
        const maxTargets = Math.max(1, attack.targets || 1);
        for (let i = 0; cur && i < maxTargets; i++) {
          hit.push(cur);
          const dmg = i === 0 ? attack.damage : attack.damage * (attack.chainFactor ?? 0.25);
          if (cur.takeDamage(dmg) && cur.selected) cur.selected = false;
          this.effects.push({
            type: 'arc', from: { ...from }, to: { x: cur.x, y: cur.y },
            born: time + i * 35, life: attack.rayMs || 300, color: attack.color || 0x9be0ff,
          });
          from = { x: cur.x, y: cur.y };
          let next = null;
          let bestD = attack.chain || 0;
          for (const t of this.troops) {
            if (t.hp <= 0 || hit.includes(t)) continue;
            const d = Math.hypot(t.x - from.x, t.y - from.y);
            if (d <= bestD) { bestD = d; next = t; }
          }
          cur = next;
        }
        st.cd = attack.cooldown;
        continue;
      }

      if (attack.mode === 'beam') {
        const maxTargets = Math.max(1, attack.targets || 1);
        const keepBeam = (st.beamTargets || []).filter(t => t && t.hp > 0 && this.troops.includes(t) && inRange(t));
        const selected = [];
        for (const t of keepBeam) {
          if (selected.length >= maxTargets) break;
          if (!selected.includes(t)) selected.push(t);
        }
        if (!selected.includes(target) && selected.length < maxTargets) selected.unshift(target);
        if (!selected.includes(target) && selected.length >= maxTargets) selected[0] = target;
        if (selected.length < maxTargets) {
          const candidates = this.troops
            .filter(t => t.hp > 0 && !selected.includes(t) && inRange(t))
            .map(t => ({ t, d: Math.hypot(t.x - cx, t.y - cy) }))
            .sort((a, b) => a.d - b.d);
          for (const c of candidates) {
            if (selected.length >= maxTargets) break;
            selected.push(c.t);
          }
        }
        st.beamTargets = selected.slice(0, maxTargets);
        st.target = st.beamTargets[0] || target;
        const dmg = attack.damage; // dps * cooldown, same for all targets
        for (let i = 0; i < st.beamTargets.length; i++) {
          const t = st.beamTargets[i];
          if (!t || t.hp <= 0) continue;
          if (t.takeDamage(dmg) && t.selected) t.selected = false;
          this.effects.push({
            type: 'arc', from: { x: origin.x, y: origin.y }, to: { x: t.x, y: t.y },
            born: time + i * 10, life: attack.rayMs || 120, color: attack.color || 0xff9a3d,
          });
        }
        st.cd = attack.cooldown;
        continue;
      }

      // Tiro de mortero: la catapulta fija un punto de suelo al lanzar y no
      // persigue a la tropa. Con dispersión y un fallo explícito puede fallar;
      // además, una tropa que se mueva puede salir de la zona de salpicadura.
      const ballistic = Boolean(attack.accuracy || attack.missChance);
      let impact = target;
      if (ballistic) {
        const missed = attack.missChance > 0 && Math.random() < attack.missChance;
        const spread = (attack.accuracy || 0.5) * (missed ? 2.6 : 1);
        const angle = Math.random() * Math.PI * 2;
        const radius = spread * Math.sqrt(Math.random());
        impact = {
          x: target.x + Math.cos(angle) * radius,
          y: target.y + Math.sin(angle) * radius,
          missed,
        };
      }

      const stone = attack.projectile === 'stone';
      this.bolts.push(new Projectile(this.scene, {
        x0: origin.x,
        y0: origin.y,
        z0: origin.z,
        speed: attack.speed,
        damage: attack.damage,
        splash: attack.splash || 0,
        target: impact,
        homing: !ballistic,
        arc: stone ? 18 : 6,
        spin: stone,
        texture: stone ? STONE_TEX : BOLT_TEX,
        impactTexture: stone ? DUST_TEX : IMPACT_TEX,
        onHit: (u, dmg, point) => {
          // En tiro balístico `u` es el punto de suelo: el daño llega
          // exclusivamente por la salpicadura.
          if (u?.hp > 0 && u.takeDamage(dmg) && u.selected) u.selected = false;
          if (point?.splash) {
            for (const other of this.troops) {
              if (other === u || other.hp <= 0) continue;
              if (Math.hypot(other.x - point.x, other.y - point.y) <= point.splash) {
                if (other.takeDamage(dmg) && other.selected) other.selected = false;
              }
            }
          }
          if (point?.missed) {
            this.effects.push({
              type: 'ring', x: point.x, y: point.y, r: 0.5,
              born: this.scene.time.now, life: 420, color: 0xb9a68f,
            });
          }
        },
      }));
      st.cd = attack.cooldown;
    }
  }

  /* ---------- Trampas (Fase 10) ----------------------------------------- */

  centerOf(def) {
    return {
      x: def.x + (def.w || def.size) / 2,
      y: def.y + (def.h || def.size) / 2,
    };
  }

  stepTraps(time) {
    for (const def of this.structures) {
      const spec = specFor(def);
      const trap = spec?.trap;
      if (!trap || !def.placed || pausedByWork(def)) continue;
      const state = this.traps[def.id] || (this.traps[def.id] = { used: false, cd: 0, inside: new Map() });
      const c = this.centerOf(def);
      const level = def.level || 1;

      if (trap.type === 'bomb') {
        if (state.used) continue;
        const act = trap.activation(level);
        const near = this.troops.some(t => t.hp > 0 && Math.hypot(t.x - c.x, t.y - c.y) <= act);
        if (!near) continue;
        state.used = true;
        const range = trap.range(level);
        const damage = trap.damage(level);
        for (const t of this.troops) {
          if (t.hp > 0 && Math.hypot(t.x - c.x, t.y - c.y) <= range) t.takeDamage(damage);
        }
        this.effects.push({
          type: 'ring', x: c.x, y: c.y, r: range,
          born: time, life: trap.explosionMs, color: 0xff7a4a,
        });
        continue;
      }

      if (trap.type === 'electro') {
        // cooldown 0 del balance = una descarga por invasión; > 0 = repetible.
        state.cd = Math.max(0, (state.cd || 0) - (time - (state.last || time)) / 1000);
        state.last = time;
        if (state.cd > 0 || (state.used && !trap.cooldown)) continue;
        const nearest = (px, py, maxD, hit) => {
          let best = null;
          let bestD = maxD;
          for (const t of this.troops) {
            if (t.hp <= 0 || hit.includes(t)) continue;
            const d = Math.hypot(t.x - px, t.y - py);
            if (d <= bestD) { bestD = d; best = t; }
          }
          return best;
        };
        let cur = nearest(c.x, c.y, trap.range(level), []);
        if (!cur) continue;
        const hit = [];
        const damage = trap.damage(level);
        const chain = trap.chain(level);
        let from = c;
        for (let i = 0; cur && i < trap.targets(level); i++) {
          hit.push(cur);
          cur.takeDamage(damage);
          this.effects.push({
            type: 'arc', from: { ...from }, to: { x: cur.x, y: cur.y },
            born: time + i * trap.chainMs, life: trap.arcMs, color: 0x9be0ff,
          });
          from = { x: cur.x, y: cur.y };
          cur = nearest(cur.x, cur.y, chain, hit);
        }
        state.used = true;
        state.cd = trap.cooldown || 0;
        continue;
      }

      if (trap.type === 'rocktrap') {
        const dmg = trap.damage(level);
        const r = this.rectOf(def);
        for (const t of this.troops) {
          if (t.hp <= 0 || t.flying) continue; // las tropas voladoras son inmunes
          const on = t.x >= r.x0 && t.x <= r.x1 && t.y >= r.y0 && t.y <= r.y1;
          if (on) {
            const was = state.inside.get(t.id);
            if (was === undefined) {
              t.takeDamage(dmg);
              state.inside.set(t.id, time);
            } else if (time - was > trap.interval * 1000) {
              t.takeDamage(dmg);
              state.inside.set(t.id, time);
            }
          } else if (state.inside.has(t.id) && time - state.inside.get(t.id) > trap.reentry * 1000) {
            state.inside.delete(t.id);
          }
        }
      }
    }
  }

  drawEffects(time) {
    const g = this.fxG;
    g.clear();
    const alive = [];
    for (const fx of this.effects) {
      const k = (time - fx.born) / fx.life;
      if (k >= 1) continue;
      alive.push(fx);
      if (fx.type === 'ring') {
        const p = iso(fx.x, fx.y, 0);
        g.lineStyle(3, fx.color, 0.9 * (1 - k));
        g.strokeEllipse(p.x, p.y, fx.r * 2 * 48 * (0.4 + k * 0.6), fx.r * 2 * 30 * (0.4 + k * 0.6));
      } else if (fx.type === 'mark') {
        // Destello de la orden recién dada: verde al mover, rojo al atacar.
        const p = iso(fx.x, fx.y, 0);
        const grow = fx.kind === 'move' ? 0.6 + k * 0.8 : 1.4 - k * 0.6;
        g.lineStyle(2.5, fx.color, 0.95 * (1 - k));
        g.strokeEllipse(p.x, p.y, 46 * grow, 23 * grow);
        g.beginPath();
        g.moveTo(p.x - 12 * grow, p.y); g.lineTo(p.x + 12 * grow, p.y);
        g.moveTo(p.x, p.y - 6 * grow); g.lineTo(p.x, p.y + 6 * grow);
        g.strokePath();
      } else if (fx.type === 'arc') {
        const a = iso(fx.from.x, fx.from.y, 16);
        const b = iso(fx.to.x, fx.to.y, 10);
        g.lineStyle(2, fx.color, 1 - k);
        const steps = 5;
        g.beginPath();
        g.moveTo(a.x, a.y);
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          const jitter = (i % 2 ? 5 : -5) * (1 - k);
          g.lineTo(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + jitter);
        }
        g.lineTo(b.x, b.y);
        g.strokePath();
      }
    }
    this.effects = alive;
    this.drawStructureBars(time);
    this.drawOrderIndicators(time);
  }

  /* Barras de vida del asedio: viven en la capa de efectos (por encima de los
   * sprites) y solo se muestran cuando la estructura ha sido golpeada. Usan
   * `siege`, nunca `def.hp`: la base real sigue intacta al terminar.
   * Se mantienen un rato tras la destrucción para que el golpe sea visible. */
  drawStructureBars(time) {
    if (!this.active) return;
    const g = this.fxG;
    const z = this.scene.cameras.main.zoom || 1;
    const w = 48 / z;
    const h = 8 / z;
    const flashMs = 220;
    const keepMs = 2400;

    for (const def of this.structures) {
      const hp = this.siege[def.id];
      if (hp === undefined || def.view?.hidden) continue;
      const max = this.maxHpOf(def);
      const last = this.hitAt[def.id] ?? -Infinity;
      const since = time - last;
      if (hp >= max && since > keepMs) continue;
      if (hp <= 0 && since > keepMs) continue;

      const r = this.rectOf(def);
      const lift = def.kind === 'core'
        ? CORE_HEIGHT + 32 * SCALE + 12              // por encima del cristal
        : (def.height || 30) * SCALE + 14;           // por encima del arte
      const p = iso((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, lift);
      const x = p.x - w / 2;
      const y = p.y - h / 2;
      const ratio = Math.max(0, Math.min(1, hp / Math.max(1, max)));
      const color = ratio > 0.6 ? 0x5ad46a : ratio > 0.3 ? 0xf0c14a : 0xd45a5a;

      g.fillStyle(0x14100d, 0.92);
      g.fillRect(x - 1 / z, y - 1 / z, w + 2 / z, h + 2 / z);
      g.fillStyle(0x3b3b3b, 1);
      g.fillRect(x, y, w, h);
      g.fillStyle(color, 1);
      g.fillRect(x + 1 / z, y + 1 / z, Math.max(0, (w - 2 / z) * ratio), h - 2 / z);
      if (since < flashMs) {
        g.lineStyle(2 / z, 0xffffff, 0.9 * (1 - since / flashMs));
        g.strokeRect(x - 2 / z, y - 2 / z, w + 4 / z, h + 4 / z);
      }
    }
  }

  removeDead() {
    const dead = this.troops.filter(t => t.hp <= 0);
    if (dead.length) {
      for (const t of dead) {
        // Las crías que le faltaban a una araña madre salen al caer.
        if (t.babiesLeft > 0) this.spawnBabies(t, t.babiesLeft);
        // Las crías no cuentan como bajas del ejército (igual que en el legacy).
        if (!t.summoned) this.dead[t.typeId] = (this.dead[t.typeId] || 0) + 1;
        t.destroy();
      }
      this.troops = this.troops.filter(t => t.hp > 0);
      for (const st of Object.values(this.defs)) {
        if (st.target && !this.troops.includes(st.target)) st.target = null;
      }
    }
    const fallen = this.defenders.filter(g => g.hp <= 0);
    if (fallen.length) {
      for (const g of fallen) g.destroy();
      this.defenders = this.defenders.filter(g => g.hp > 0);
    }
  }

  hitStructure(t, damage) {
    const id = t.target;
    if (!id) return;
    const def = this.structureById(id);
    if (!def) return;
    const max = this.siege[id] ?? this.maxHpOf(def);
    const hp = Math.max(0, max - damage);
    this.siege[id] = hp;
    this.hitAt[id] = this.scene.time.now;
    if (id === 'core') this.coreHitAt = this.scene.time.now;

    if (hp > 0) return;
    if (id === 'core') {
      if (this.coreDestroyed) return;
      this.onCoreDestroyed(def);
      this.finish('won', 'El núcleo ha caído');
      return;
    }
    // Botín por edificio: 25 % del almacén, 50 % de la burbuja del productor.
    this.takeLootFrom(def);
    // Estructura caída: deja de defenderse y sus casillas son transitables.
    def.view?.setDestroyed?.(true);
    for (let j = 0; j < (def.h || def.size); j++) {
      for (let i = 0; i < (def.w || def.size); i++) {
        this.open.add(this.terrain.key(def.x + i, def.y + j));
      }
    }
  }

  checkLoss() {
    if (this.phase !== 'battle' || this.over) return;
    if (!this.troops.length && !this.queue.length && this.reserve() === 0) {
      this.finish('lost', 'Te quedaste sin tropas');
    }
  }

  /* ---------- Selección y órdenes (RTS básico) --------------------------- */

  clearTroopSelection() {
    for (const t of this.troops) t.selected = false;
    this.clearOrderPreview();
  }

  commandable() { return this.troops.filter(t => !t.summoned); }

  // Tropas que el jugador puede mandar (las crías no obedecen órdenes).
  commandSelected() { return this.troops.filter(t => t.selected && t.hp > 0); }

  /* ---------- Previsualización de la orden bajo el cursor ---------------- */

  setOrderPreview(wx, wy) {
    if (!this.active || this.over || !this.commandSelected().length) {
      this.orderPreview = null;
      return;
    }
    const def = structureAt(wx, wy, this.structures);
    if (def && this.targetable(def)) {
      const r = this.rectOf(def);
      this.orderPreview = {
        kind: 'attack', defId: def.id,
        x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2,
      };
      return;
    }
    const cell = pickCell(this.terrain.map, wx, wy);
    this.orderPreview = cell
      ? { kind: 'move', x: cell.x + 0.5, y: cell.y + 0.5 }
      : null;
  }

  clearOrderPreview() { this.orderPreview = null; }

  selectAtWorld(wx, wy, additive = false) {
    if (!additive) this.clearTroopSelection();
    let best = null;
    let bestD = this.troopPickRadius();
    for (const t of this.commandable()) {
      const p = iso(t.x, t.y, 0);
      const d = Math.hypot(p.x - wx, p.y - wy) / 48; // ~1 casilla base; radio compensado por zoom
      if (d < bestD) { best = t; bestD = d; }
    }
    if (!best) return 0;
    best.selected = additive ? !best.selected : true;
    return this.troops.filter(t => t.selected).length;
  }

  selectBox(rect, additive = false) {
    if (!additive) this.clearTroopSelection();
    const cam = this.scene.cameras.main;
    const x0 = Math.min(rect.x0, rect.x1);
    const x1 = Math.max(rect.x0, rect.x1);
    const y0 = Math.min(rect.y0, rect.y1);
    const y1 = Math.max(rect.y0, rect.y1);
    const a = cam.getWorldPoint(x0, y0);
    const b = cam.getWorldPoint(x1, y0);
    const c = cam.getWorldPoint(x1, y1);
    const d = cam.getWorldPoint(x0, y1);
    const poly = [a, b, c, d];
    for (const t of this.commandable()) {
      if (pointInPolygon(iso(t.x, t.y, 0), poly)) t.selected = true;
    }
    return this.commandable().filter(t => t.selected).length;
  }

  selectAll() {
    const list = this.commandable();
    for (const t of list) t.selected = true;
    return list.length;
  }

  troopPickRadius() {
    const zoom = this.scene?.cameras?.main?.zoom || 1;
    // Mantener objetivo ~43px en pantalla; en zoom bajo ampliar en mundo.
    return Math.max(0.9, 0.9 / zoom);
  }

  troopUnder(wx, wy) {
    let best = null;
    let bestD = this.troopPickRadius();
    for (const t of this.commandable()) {
      const p = iso(t.x, t.y, 0);
      const d = Math.hypot(p.x - wx, p.y - wy) / 48;
      if (d < bestD) { best = t; bestD = d; }
    }
    return best;
  }

  /** Toque simple en móvil: selecciona una tropa o, si ya hay seleccionadas,
   *  da la orden sobre el edificio/suelo tocado (equivale al clic derecho). */
  tapAtWorld(wx, wy, additive = false) {
    const def = structureAt(wx, wy, this.structures);
    if (def && this.targetable(def) && this.commandSelected().length) {
      return this.orderAtWorld(wx, wy);
    }
    // Con selección activa y toque en suelo vacío: mover, sin borrar selección.
    if (!additive && this.commandSelected().length && !this.troopUnder(wx, wy)) {
      return this.orderAtWorld(wx, wy);
    }
    return Boolean(this.selectAtWorld(wx, wy, additive));
  }

  orderAtWorld(wx, wy) {
    const chosen = this.troops.filter(t => t.selected);
    if (!chosen.length) return false;
    const def = structureAt(wx, wy, this.structures);
    if (def && this.targetable(def)) {
      let ordered = 0;
      for (const t of chosen) if (t.orderAttack(def)) ordered++;
      if (!ordered) return false;
      const r = this.rectOf(def);
      const x = (r.x0 + r.x1) / 2;
      const y = (r.y0 + r.y1) / 2;
      const now = this.scene.time.now;
      this.effects.push({ type: 'ring', x, y, r: 0.9, born: now, life: 420, color: 0xff6a5a });
      this.effects.push({ type: 'mark', kind: 'attack', x, y, born: now, life: 900, color: 0xff6a5a });
      this.setOrderPreview(wx, wy);
      return true;
    }
    const cell = pickCell(this.terrain.map, wx, wy);
    if (!cell) return false;
    const x = cell.x + 0.5;
    const y = cell.y + 0.5;
    let ordered = 0;
    chosen.forEach((t, i) => {
      const col = (i % 3) - 1;
      const row = (Math.floor(i / 3) % 2) ? 1 : -1;
      if (t.orderMove({ x: x + col * 0.35, y: y + row * 0.3 })) ordered++;
    });
    if (!ordered) return false;
    const now = this.scene.time.now;
    this.effects.push({ type: 'ring', x, y, r: 0.7, born: now, life: 420, color: 0x8fffc0 });
    this.effects.push({ type: 'mark', kind: 'move', x, y, born: now, life: 900, color: 0x8fffc0 });
    this.setOrderPreview(wx, wy);
    return true;
  }

  /* ---------- Dibujo de indicadores de mando ----------------------------- */

  // Phaser Graphics no tiene setLineDash: los guiones se dibujan a mano.
  dashedLine(points, color, alpha, width, dash = 8, gap = 6) {
    const g = this.fxG;
    g.lineStyle(width, color, alpha);
    g.beginPath();
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.5) continue;
      const step = dash + gap;
      for (let d = 0; d < len; d += step) {
        const t0 = d / len;
        const t1 = Math.min(1, (d + dash) / len);
        g.moveTo(a.x + dx * t0, a.y + dy * t0);
        g.lineTo(a.x + dx * t1, a.y + dy * t1);
      }
    }
    g.strokePath();
  }

  // Retícula sobre una estructura: se ve tanto al apuntar como mientras las
  // tropas seleccionadas siguen targeteándola.
  drawTargetMark(def, time, hover = false) {
    const g = this.fxG;
    const z = this.scene.cameras.main.zoom || 1;
    const r = this.rectOf(def);
    const w = r.x1 - r.x0;
    const h = r.y1 - r.y0;
    const poly = footprintPoly(r.x0, r.y0, w, h);
    const pulse = 0.5 + 0.5 * Math.sin(time / 170);
    const color = hover ? 0xffc16a : 0xff5a4a;

    g.fillStyle(color, (hover ? 0.12 : 0.07) + pulse * 0.06);
    g.fillPoints(poly, true);

    const len = 14 / z;
    g.lineStyle((hover ? 3 : 2.5) / z, color, 0.95);
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const p = poly[i];
      const toward = q => {
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        return { x: p.x + dx / d * len, y: p.y + dy / d * len };
      };
      const a = toward(poly[(i + 3) % 4]);
      const b = toward(poly[(i + 1) % 4]);
      g.moveTo(a.x, a.y);
      g.lineTo(p.x, p.y);
      g.lineTo(b.x, b.y);
    }
    g.strokePath();

    const aim = iso((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, (def.height || 20) * 0.65);
    const rad = (9 + pulse * 3) / z;
    g.lineStyle(2 / z, color, 0.9);
    g.strokeCircle(aim.x, aim.y, rad);
    g.beginPath();
    g.moveTo(aim.x - rad - 5 / z, aim.y); g.lineTo(aim.x - rad + 1 / z, aim.y);
    g.moveTo(aim.x + rad - 1 / z, aim.y); g.lineTo(aim.x + rad + 5 / z, aim.y);
    g.moveTo(aim.x, aim.y - rad - 5 / z); g.lineTo(aim.x, aim.y - rad + 1 / z);
    g.moveTo(aim.x, aim.y + rad - 1 / z); g.lineTo(aim.x, aim.y + rad + 5 / z);
    g.strokePath();
  }

  // Casilla de destino resaltada cuando el cursor está sobre suelo.
  drawMoveMark(x, y, time, hover = false) {
    const g = this.fxG;
    const z = this.scene.cameras.main.zoom || 1;
    const pulse = 0.5 + 0.5 * Math.sin(time / 170);
    const color = hover ? 0x9fffd0 : 0x8fffc0;
    const poly = [
      iso(x - 0.5, y - 0.5), iso(x + 0.5, y - 0.5),
      iso(x + 0.5, y + 0.5), iso(x - 0.5, y + 0.5),
    ];
    g.fillStyle(color, 0.14 + pulse * 0.08);
    g.fillPoints(poly, true);
    this.dashedLine([...poly, poly[0]], color, 0.9, 2 / z, 9 / z, 6 / z);

    const c = iso(x, y, 0);
    g.lineStyle(2 / z, color, 0.85);
    g.strokeEllipse(c.x, c.y, (22 + pulse * 8) / z, (11 + pulse * 4) / z);
    g.beginPath();
    g.moveTo(c.x, c.y - 16 / z);
    g.lineTo(c.x - 5 / z, c.y - 8 / z);
    g.moveTo(c.x, c.y - 16 / z);
    g.lineTo(c.x + 5 / z, c.y - 8 / z);
    g.strokePath();
  }

  drawOrderIndicators(time) {
    if (!this.active) return;
    const z = this.scene.cameras.main.zoom || 1;
    const selected = this.commandSelected().slice(0, 16);
    if (!selected.length && !this.orderPreview) return;

    // Rutas ya ordenadas y estructuras targeteadas por las tropas elegidas.
    const marked = new Set();
    for (const t of selected) {
      if (t.path.length) {
        const pts = [iso(t.x, t.y, 0)];
        for (const w of t.path) pts.push(iso(w.x, w.y, 0));
        this.dashedLine(pts, 0xffd28a, 0.4, 1.4 / z, 7 / z, 7 / z);
      }
      if (t.target && !marked.has(t.target)) {
        const def = this.structureById(t.target);
        if (def && this.targetable(def)) {
          marked.add(t.target);
          this.drawTargetMark(def, time, false);
          const r = this.rectOf(def);
          const aim = iso((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, (def.height || 20) * 0.65);
          this.dashedLine([iso(t.x, t.y, 6), aim], 0xff7a6a, 0.35, 1.4 / z, 6 / z, 8 / z);
        }
      }
    }

    const p = this.orderPreview;
    if (!p) return;
    if (p.kind === 'attack') {
      const def = this.structureById(p.defId);
      if (def && this.targetable(def)) {
        this.drawTargetMark(def, time, true);
        const r = this.rectOf(def);
        const aim = iso((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, (def.height || 20) * 0.65);
        for (const t of selected) {
          this.dashedLine([iso(t.x, t.y, 6), aim], 0xffc16a, 0.5, 1.4 / z, 6 / z, 7 / z);
        }
      }
    } else {
      this.drawMoveMark(p.x, p.y, time, true);
      const c = iso(p.x, p.y, 0);
      for (const t of selected) {
        this.dashedLine([iso(t.x, t.y, 0), c], 0x9fffd0, 0.45, 1.4 / z, 6 / z, 7 / z);
      }
    }
  }
}
