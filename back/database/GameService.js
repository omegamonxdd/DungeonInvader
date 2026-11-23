/* ==========================================================
 * SERVICIO DE PROGRESO (orquestador)
 * ----------------------------------------------------------
 * Conecta autenticación, guardado local y Supabase con los sistemas
 * vivos de MainScene. Expone una API pequeña para la UI:
 *
 *   service.start()                 arranca y carga la partida
 *   service.signIn/signUp/signOut   identidad
 *   service.markDirty()             avisa de que algo cambió
 *   service.onStatus(cb)            estado para el HUD
 * ========================================================== */

import { BALANCE } from '../balance/index.js';
import { devResources } from '../config/devResources.js';
import { AUTOSAVE_MS, DEFAULT_SLOT, SAVE_DEBOUNCE_MS } from './config.js';
import { AuthService } from './auth.js';
import { SaveRepository } from './repository.js';
import { buildSnapshot, freshSnapshot, sameProgress, snapshotHasPath } from './snapshot.js';
import { applySnapshot } from './restore.js';

const isGuestId = id => String(id || '').startsWith('guest:');

export class GameService {
  constructor() {
    this.auth = new AuthService();
    this.repository = new SaveRepository();
    this.ctx = null;
    this.started = false;
    this.dirty = false;
    this.saving = false;
    this.pendingApply = null;
    this.pendingSave = false;
    // Mientras se carga la base del rival la escena todavía no está en
    // invasión, pero no debe autoguardarse con el snapshot prestado.
    this.invasionPreparing = false;
    this.lastSaved = null;
    this.lastUserId = null;
    this.status = 'idle';       // idle | loading | saving | saved | offline | error
    this.error = null;
    this.savedAt = null;
    this.listeners = new Set();
    this._timer = null;
    this._debounce = null;
    this._onAuthUnsub = null;
    this.startPromise = null;
    this._attachResolve = null;
    this._attached = new Promise(resolve => { this._attachResolve = resolve; });
    this._boundPageHide = () => this.save({ force: true, sync: false });
    this._boundVisibility = () => {
      if (document.visibilityState === 'hidden') this.save({ force: true, sync: false });
    };
  }

  /* ---------- Suscripción de estado ------------------------------------ */

  onStatus(cb) {
    this.listeners.add(cb);
    cb(this.getStatus());
    return () => this.listeners.delete(cb);
  }

  getStatus() {
    return {
      status: this.status,
      error: this.error,
      savedAt: this.savedAt,
      configured: this.repository.remoteEnabled,
      user: { id: this.auth.id, email: this.auth.email, guest: this.auth.isGuest },
    };
  }

  _emit() {
    const state = this.getStatus();
    for (const cb of this.listeners) {
      try { cb(state); }
      catch (err) { console.warn('[database] listener de estado falló:', err); }
    }
  }

  _setStatus(status, error = null) {
    this.status = status;
    this.error = error;
    this._emit();
  }

  /* ---------- Arranque -------------------------------------------------- */

  attach(ctx) {
    this.ctx = ctx;
    this._attachResolve?.();
    this._attachResolve = null;
  }

  start() {
    if (this.startPromise) return this.startPromise;
    this.started = true;
    this._setStatus('loading');
    this.startPromise = this._boot();
    return this.startPromise;
  }

  async _boot() {
    // main.js puede llamar a start() antes de que Phaser cree MainScene.
    await this._attached;

    await this.repository.init();
    await this.auth.restore();
    this.lastUserId = this.auth.id;

    // Caché local: se aplica siempre, esté o no configurada la nube.
    const local = this.repository.loadLocal(this.auth.id);
    if (local) {
      this.apply(local);
      this.lastSaved = local;
      this.savedAt = local.savedAt;
    } else if (this.auth.isGuest) {
      this.applyFresh();
    }

    if (!this.auth.isGuest) await this.syncFromCloud(this.auth.user, local);

    this._onAuthUnsub = this.auth.onChange(user => this.handleAuthChange(user));
    this._timer = setInterval(() => this.tick(), AUTOSAVE_MS);
    window.addEventListener('pagehide', this._boundPageHide);
    window.addEventListener('beforeunload', this._boundPageHide);
    document.addEventListener('visibilitychange', this._boundVisibility);

    this._setStatus(this.repository.remoteEnabled ? 'saved' : 'offline');
  }

  async handleAuthChange(user) {
    if (user.id === this.lastUserId) return;
    const previousId = this.lastUserId;
    this.lastUserId = user.id;

    // Cerrar sesión NO debe re-guardar ni re-subir la base del usuario: era
    // justo lo que recreaba el guardado aunque se borrara en Supabase.
    const signingOut = Boolean(user.guest && previousId && !isGuestId(previousId));
    if (this.dirty && previousId && !signingOut) {
      await this.save({ force: true, userId: previousId });
    }
    if (signingOut) this.repository.clearLocal(previousId);

    // Nada del estado anterior puede filtrarse a la nueva identidad.
    this.pendingApply = null;
    this.pendingSave = false;
    this.dirty = false;
    this.lastSaved = null;
    this.savedAt = null;

    if (user.guest) {
      if (signingOut) {
        this.applyFresh();
      } else {
        const local = this.repository.loadLocal(user.id);
        if (local) {
          this.apply(local);
          this.lastSaved = local;
          this.savedAt = local.savedAt;
        } else {
          this.applyFresh();
        }
      }
      this._setStatus('offline');
      return;
    }
    await this.syncFromCloud(user, null);
  }

  /** Partida limpia para una identidad sin guardado propio. */
  applyFresh() {
    const snap = freshSnapshot(DEFAULT_SLOT);
    this.apply(snap);
    this.lastSaved = null;
    this.savedAt = null;
    this.dirty = false;
    this.pendingApply = null;
    this.pendingSave = false;
  }

  /** Decide entre la copia local y la remota (last-write-wins) y empuja si hace falta.
   *  Ambos bandos se leen SOLO para `user.id`: nunca se usa `lastSaved` de otra
   *  cuenta como origen. */
  async syncFromCloud(user, localHint) {
    const local = localHint || this.repository.loadLocal(user.id);
    const remote = await this.repository.loadRemote(user.id);
    const remoteWins = Boolean(remote && (!local || SaveRepository.newer(remote, local)));
    const chosen = remoteWins ? remote : local;

    if (chosen) {
      this.apply(chosen);
      this.lastSaved = chosen;
      this.savedAt = chosen.savedAt;
      this.dirty = false;
    } else {
      this.applyFresh();
    }

    if (remoteWins) {
      this.repository.saveLocal(remote, user.id);
      this._rememberCheckpoint(remote, user.id);
    } else if (local && (!remote || SaveRepository.newer(local, remote))) {
      await this.upload(local, user.id);
    }
  }

  /* ---------- Guardado -------------------------------------------------- */

  markDirty() {
    if (!this.started) return;
    this.dirty = true;
    clearTimeout(this._debounce);
    this._debounce = setTimeout(() => this.save(), SAVE_DEBOUNCE_MS);
  }

  tick() { if (this.dirty) this.save(); }

  async save({ force = false, sync = true, ownerId = null } = {}) {
    if (!this.ctx || !this.started) return false;
    if (this.invasionActive()) {
      this.pendingSave = true;
      return false;
    }
    if (this.saving) return false;

    const snapshot = buildSnapshot(this.ctx, DEFAULT_SLOT);
    if (devResources() !== null) {
      // El override de pruebas nunca se persiste: al quitarlo debe reaparecer
      // el progreso real del jugador en vez de un guardado de 999999.
      const fallback = this.lastSaved?.resources || BALANCE.recursos.inicio;
      snapshot.resources = { coins: fallback.coins, crystals: fallback.crystals };
    }
    if (!force && !this.dirty && sameProgress(snapshot, this.lastSaved)) return false;

    this.saving = true;
    this._setStatus('saving');
    const userId = ownerId || this.auth.id;
    this.repository.saveLocal(snapshot, userId);
    this._rememberCheckpoint(snapshot, userId);

    if (sync && !isGuestId(userId) && this.repository.remoteEnabled) {
      await this.upload(snapshot, userId);
    } else {
      this.savedAt = snapshot.savedAt;
      this._setStatus(this.repository.remoteEnabled ? 'saved' : 'offline');
    }

    this.lastSaved = snapshot;
    this.dirty = false;
    this.pendingSave = false;
    this.saving = false;
    this._emit();
    return true;
  }

  /** Guarda el checkpoint solo cuando el núcleo era alcanzable. Es
   *  best-effort: un fallo de red nunca debe romper el autoguardado. */
  _rememberCheckpoint(snapshot, userId = this.auth.id) {
    if (!snapshot || this.ctx?.terrain?.pathValid === false || !snapshotHasPath(snapshot)) return;
    try {
      Promise.resolve(this.repository.saveCheckpoint(snapshot, userId))
        .catch(err => console.warn('[database] No se pudo guardar el checkpoint:', err));
    } catch (err) {
      console.warn('[database] No se pudo guardar el checkpoint:', err);
    }
  }

  async loadCheckpointFor(userId = this.auth.id) {
    if (userId && !String(userId).startsWith('guest:') && this.repository.remoteEnabled) {
      const remote = await this.repository.loadCheckpointRemote(userId);
      if (remote) return remote;
    }
    return this.repository.loadCheckpoint(userId);
  }

  /* ---------- Rivales de invasión --------------------------------------- */

  async listOpponents() {
    const list = await this.repository.listOpponents();
    const mine = String(this.auth.id || '');
    return list.filter(r => String(r.id) !== mine);
  }
  loadOpponentBase(userId) { return this.repository.loadOpponentBase(userId); }
  loadOpponentCheckpoint(userId) { return this.repository.loadOpponentCheckpoint(userId); }

  async upload(snapshot, userId) {
    const result = await this.repository.saveRemote(userId, snapshot);
    if (result.ok) {
      this.savedAt = result.savedAt || snapshot.savedAt;
      this._setStatus('saved');
    } else if (result.reason === 'local') {
      this.savedAt = snapshot.savedAt;
      this._setStatus('offline');
    } else {
      this.savedAt = snapshot.savedAt;
      this._setStatus('error', result.error);
    }
  }

  /** Llamar al terminar una invasión: aplica guardados/cargas pospuestos. */
  async flushPending() {
    if (this.pendingApply) {
      const snap = this.pendingApply;
      this.pendingApply = null;
      this.apply(snap);
    }
    if (this.pendingSave || this.dirty) await this.save({ force: true });
  }

  invasionActive() {
    return Boolean(this.invasionPreparing
      || this.ctx?.invasion?.baseSwap
      || (this.ctx?.invasion?.active && !this.ctx?.invasion?.over));
  }

  /* ---------- Carga en caliente ---------------------------------------- */

  apply(snapshot) {
    if (!this.ctx) return;
    if (this.invasionActive()) {
      this.pendingApply = snapshot;
      return;
    }
    const applied = applySnapshot(snapshot, this.ctx);
    this.lastSaved = applied;
    this.savedAt = applied.savedAt;
    this.dirty = false;
    this._rememberCheckpoint(applied);
  }

  /* ---------- APIs que usa la UI --------------------------------------- */

  signIn(email, password) { return this.auth.signIn(email, password); }
  signUp(email, password, displayName) { return this.auth.signUp(email, password, displayName); }
  signOut() { return this.auth.signOut(); }
  continueAsGuest() { return this.auth.continueAsGuest(); }

  /** Estadísticas de partida: se guardan con el resto del progreso. */
  recordInvasion(result) {
    const stats = this.ctx?.stats || (this.ctx ? this.ctx.stats = {} : {});
    stats.invasions = (stats.invasions || 0) + 1;
    if (result === 'won' || result?.kind === 'won' || result?.won || result?.victory) {
      stats.wins = (stats.wins || 0) + 1;
    }
    else stats.losses = (stats.losses || 0) + 1;
    this.markDirty();
  }

  dispose() {
    clearInterval(this._timer);
    clearTimeout(this._debounce);
    this._onAuthUnsub?.();
    this.auth.dispose();
    window.removeEventListener('pagehide', this._boundPageHide);
    window.removeEventListener('beforeunload', this._boundPageHide);
    document.removeEventListener('visibilitychange', this._boundVisibility);
    this.listeners.clear();
  }
}

/* Instancia compartida: main.js la crea antes del Phaser.Game y MainScene
 * la recoge con getService(). Evita depender del orden de boot de Phaser. */
let active = null;
export function setService(service) { active = service; return service; }
export function getService() { return active; }
