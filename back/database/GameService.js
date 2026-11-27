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
import { AUTOSAVE_MS, BASE2_SLOT, DEFAULT_SLOT, SAVE_DEBOUNCE_MS } from './config.js';
import { AuthService } from './auth.js';
import { SaveRepository } from './repository.js';
import { applyLayoutToSnapshot, buildSnapshot, ensureLayoutState, freshSnapshot, layoutRecord, normalizeSnapshot, sameProgress, snapshotHasPath, snapshotWithLayouts } from './snapshot.js';
import { applySnapshot } from './restore.js';
import { SessionLock } from './sessionLock.js';

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
    this.activeSlot = DEFAULT_SLOT;
    this.activeLayout = DEFAULT_SLOT;
    this.status = 'idle';       // idle | loading | saving | saved | offline | error
    this.error = null;
    this.savedAt = null;
    this.listeners = new Set();
    this.sessionLocked = false;
    this.appVersion = typeof __APP_VERSION__ !== 'undefined' ? String(__APP_VERSION__) : 'dev';
    this.updateRequired = false;
    this._versionTimer = null;
    this.sessionLock = new SessionLock({
      onLock: () => {
        this.sessionLocked = true;
        this.ctx?.ui?.showSessionLocked?.();
      },
      onUnlock: () => {
        this.sessionLocked = false;
        this.ctx?.ui?.hideSessionLocked?.();
      },
    });
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

  /* ---------- Control de versión -------------------------------------- */

  isOutdated(serverVersion) {
    return Boolean(serverVersion) && String(serverVersion) !== this.appVersion;
  }

  async checkVersion({ forceReload = false, notify = false } = {}) {
    if (import.meta.env.DEV || this.updateRequired) return false;
    try {
      const base = import.meta.env.BASE_URL || './';
      const url = new URL('version.json', window.location.href);
      // Respeta BASE_URL en despliegues bajo subruta.
      const baseUrl = new URL(base, window.location.href);
      const versionUrl = new URL('version.json', baseUrl);
      const res = await fetch(versionUrl.href || url.href, { cache: 'no-store' });
      if (!res.ok) return false;
      const data = await res.json();
      const serverVersion = String(data?.version || '');
      if (!this.isOutdated(serverVersion)) return false;
      this.updateRequired = true;
      this.ctx?.ui?.showToast?.('Nueva versión disponible. Recargando...');
      if (forceReload) setTimeout(() => window.location.reload(), 250);
      else if (notify) this.ctx?.ui?.showToast?.('Hay una nueva versión. Recarga la página.');
      return true;
    } catch {
      return false;
    }
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
    this.sessionLock.attach(this.auth.isGuest ? null : this.auth.id);

    this.activeLayout = DEFAULT_SLOT;
    this.activeSlot = DEFAULT_SLOT;
    const local = this.repository.loadLocal(this.auth.id, DEFAULT_SLOT);
    if (local) {
      const ready = ensureLayoutState(local);
      this._applyLoaded(ready);
    } else {
      this.applyFresh(DEFAULT_SLOT);
    }

    if (!this.auth.isGuest) await this.syncFromCloud(this.auth.user, local, DEFAULT_SLOT);

    this._onAuthUnsub = this.auth.onChange(user => this.handleAuthChange(user));
    this._timer = setInterval(() => this.tick(), AUTOSAVE_MS);
    this._versionTimer = setInterval(() => this.checkVersion({ forceReload: true }), 60000);
    window.addEventListener('pagehide', this._boundPageHide);
    window.addEventListener('beforeunload', this._boundPageHide);
    document.addEventListener('visibilitychange', this._boundVisibility);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.checkVersion({ forceReload: true });
    });

    this.checkVersion({ forceReload: true });
    this._setStatus(this.repository.remoteEnabled ? 'saved' : 'offline');
  }

  async handleAuthChange(user) {
    if (user.id === this.lastUserId) return;
    const previousId = this.lastUserId;
    this.lastUserId = user.id;
    this.sessionLock.attach(user.guest ? null : user.id);

    // Si el editor estaba abierto, se descarta antes de cargar la nueva identidad.
    // Evita que pendingApply se quede diferido y que leave() restaure/sobrescriba
    // la base equivocada bajo la cuenta nueva.
    if (this.ctx?.editor?.active) {
      try { this.ctx.editor.leave?.(false); } catch { this.ctx.editor.active = false; }
      this.ctx.editor.active = false;
    }

    // Cerrar sesión NO debe re-guardar ni re-subir la base del usuario: era
    // justo lo que recreaba el guardado aunque se borrara en Supabase.
    const signingOut = Boolean(user.guest && previousId && !isGuestId(previousId));
    if (this.dirty && previousId && !signingOut) {
      await this.save({ force: true, ownerId: previousId });
    }
    if (signingOut) this.repository.clearLocal(previousId, DEFAULT_SLOT);

    // Nada del estado anterior puede filtrarse a la nueva identidad.
    this.pendingApply = null;
    this.pendingSave = false;
    this.dirty = false;
    this.lastSaved = null;
    this.savedAt = null;
    this.activeLayout = DEFAULT_SLOT;
    this.activeSlot = DEFAULT_SLOT;

    if (user.guest) {
      if (signingOut) {
        this.applyFresh();
      } else {
        const local = this.repository.loadLocal(user.id, DEFAULT_SLOT);
        if (local) this._applyLoaded(local);
        else this.applyFresh();
      }
      this._setStatus('offline');
      return;
    }
    await this.syncFromCloud(user, null);
  }

  _applyLoaded(snapshot, { emit = true } = {}) {
    const ready = ensureLayoutState(snapshot);
    this.activeLayout = ready.extra?.activeLayout || DEFAULT_SLOT;
    this.activeSlot = DEFAULT_SLOT;
    this.apply(ready);
    this.lastSaved = ready;
    this.savedAt = ready.savedAt;
    this.dirty = false;
    if (emit) this._emit();
    return ready;
  }

  _currentSnapshot(layoutId = this.activeLayout) {
    const snap = buildSnapshot(this.ctx, DEFAULT_SLOT);
    const base = ensureLayoutState(this.lastSaved || snap);
    const layouts = { ...(base.extra?.layouts || {}) };
    layouts[layoutId] = layoutRecord(snap);
    return snapshotWithLayouts(snap, { activeLayout: layoutId, layouts });
  }

  getLayouts() {
    const base = ensureLayoutState(this.lastSaved || buildSnapshot(this.ctx, DEFAULT_SLOT));
    return {
      activeLayout: this.activeLayout || base.extra?.activeLayout || DEFAULT_SLOT,
      layouts: base.extra?.layouts || {},
    };
  }

  /** Partida limpia para una identidad sin guardado propio. */
  applyFresh() {
    const snap = freshSnapshot(DEFAULT_SLOT);
    this._applyLoaded(snap, { emit: false });
    this.lastSaved = snap;
    this.savedAt = null;
    this.dirty = false;
    this.pendingApply = null;
    this.pendingSave = false;
  }

  async activateLayout(layoutId = DEFAULT_SLOT) {
    if (!layoutId) return false;
    if (this.ctx?.editor?.active) {
      this.ctx?.ui?.showToast?.('Guarda o sal del editor antes de cambiar de base.');
      return false;
    }
    if (layoutId === this.activeLayout) return true;
    if (this.dirty) await this.save({ force: true, sync: true });
    const base = ensureLayoutState(this.lastSaved || this._currentSnapshot(this.activeLayout));
    if (!base.extra?.layouts?.[layoutId]) return false;
    const candidate = applyLayoutToSnapshot(base, layoutId);
    const complete = (candidate.structures || []).every(s => s?.placed && !s?.shelved) && snapshotHasPath(candidate);
    if (!complete) {
      this.ctx?.ui?.showToast?.('Coloca todos los edificios y abre un camino al núcleo antes de activar esta base');
      return false;
    }
    this._applyLoaded(candidate);
    await this.save({ force: true, sync: true });
    this.ctx?.ui?.showToast?.(layoutId === BASE2_SLOT ? 'Base 2 activada.' : 'Base 1 activada.');
    return true;
  }

  // Compatibilidad con UI anterior basada en slots.
  async activateSlot(slot = DEFAULT_SLOT) { return this.activateLayout(slot); }
  async getSlotSnapshot(slot = DEFAULT_SLOT) {
    const base = ensureLayoutState(this.lastSaved || this._currentSnapshot(this.activeLayout));
    return applyLayoutToSnapshot(base, slot);
  }
  async ensureSlot(userId = this.auth.id, slot = DEFAULT_SLOT) { return this.getSlotSnapshot(slot); }

  /** Decide entre la copia local y la remota (last-write-wins) y empuja si hace falta.
   *  Ambos bandos se leen SOLO para `user.id`: nunca se usa `lastSaved` de otra
   *  cuenta como origen. */
  async syncFromCloud(user, localHint) {
    const local = localHint || this.repository.loadLocal(user.id, DEFAULT_SLOT);
    const remote = await this.repository.loadRemote(user.id, DEFAULT_SLOT);
    const remoteWins = Boolean(remote && (!local || SaveRepository.newer(remote, local)));
    const chosen = remoteWins ? remote : local;

    if (chosen) {
      this._applyLoaded(chosen);
    } else {
      this.applyFresh();
    }

    const ready = ensureLayoutState(this.lastSaved || this._currentSnapshot(this.activeLayout));
    this.repository.saveLocal(ready, user.id, DEFAULT_SLOT);
    if (remoteWins) {
      this._rememberCheckpoint(ready, user.id);
    } else if (!remote || SaveRepository.newer(ready, remote)) {
      await this.upload(ready, user.id, DEFAULT_SLOT);
    }
  }

  /* ---------- Guardado -------------------------------------------------- */

  markDirty({ reload = false } = {}) {
    if (!this.started || this.sessionLocked || this.applying) return;
    // En modo editor no se persiste nada: al salir se guarda o se restaura.
    if (this.ctx?.editor?.active) return;
    this.dirty = true;
    clearTimeout(this._debounce);
    if (reload && !import.meta.env.DEV) {
      this._debounce = setTimeout(async () => {
        await this.save({ force: true });
        window.location.reload();
      }, 150);
      return;
    }
    this._debounce = setTimeout(() => this.save(), SAVE_DEBOUNCE_MS);
  }

  tick() { if (this.dirty && !this.sessionLocked) this.save(); }

  async save({ force = false, sync = true, ownerId = null, userId = null, editorCommit = false, layoutId = this.activeLayout, activeLayout = this.activeLayout } = {}) {
    if (!this.ctx || !this.started || this.sessionLocked) return false;
    if (await this.checkVersion({ forceReload: true })) return false;
    // Durante edición no se guarda nada automáticamente; solo el commit explícito del editor.
    if (this.ctx?.editor?.active && !editorCommit) {
      this.pendingSave = false;
      return false;
    }
    if (this._combatActive()) {
      this.pendingSave = true;
      return false;
    }
    if (this.saving) return false;

    const snapshot = this._currentSnapshot(layoutId);
    snapshot.extra = { ...(snapshot.extra || {}), ...(this.ctx.extra || {}), activeLayout };
    if (devResources() !== null) {
      const fallback = this.lastSaved?.resources || BALANCE.recursos.inicio;
      snapshot.resources = { coins: fallback.coins, crystals: fallback.crystals, rubies: fallback.rubies };
    }
    if (!force && !this.dirty && sameProgress(snapshot, this.lastSaved)) return false;

    this.saving = true;
    this._setStatus('saving');
    const effectiveUserId = ownerId ?? userId ?? this.auth.id;
    this.repository.saveLocal(snapshot, effectiveUserId, DEFAULT_SLOT);
    if (!this.ctx?.editor?.active || editorCommit) {
      this._rememberCheckpoint(snapshot, effectiveUserId);
    }

    if (sync && !isGuestId(effectiveUserId) && this.repository.remoteEnabled) {
      await this.upload(snapshot, effectiveUserId, DEFAULT_SLOT);
    } else {
      this.savedAt = snapshot.savedAt;
      this._setStatus(this.repository.remoteEnabled ? 'saved' : 'offline');
    }

    this.lastSaved = snapshot;
    this.activeLayout = activeLayout;
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

  async upload(snapshot, userId, slot = DEFAULT_SLOT) {
    const result = await this.repository.saveRemote(userId, { ...snapshot, slot: DEFAULT_SLOT });
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
    if (this.sessionLocked) return;
    if (this.pendingApply) {
      const snap = this.pendingApply;
      this.pendingApply = null;
      this.apply(snap);
    }
    // En editor no se flushea: solo se guarda al pulsar Guardar (editorCommit).
    if (this.ctx?.editor?.active) return;
    if (this.pendingSave || this.dirty) await this.save({ force: true });
  }

  invasionActive() {
    return Boolean(this.invasionPreparing
      || this.ctx?.editor?.active
      || this.ctx?.invasion?.baseSwap
      || (this.ctx?.invasion?.active && !this.ctx?.invasion?.over));
  }

  _combatActive() {
    return Boolean(this.invasionPreparing
      || this.ctx?.moveController?.active
      || this.ctx?.invasion?.baseSwap
      || (this.ctx?.invasion?.active && !this.ctx?.invasion?.over));
  }

  /* ---------- Carga en caliente ---------------------------------------- */

  apply(snapshot, { force = false } = {}) {
    if (!this.ctx) return;
    if (!force && this.invasionActive()) {
      this.pendingApply = snapshot;
      return;
    }
    this.applying = true;
    try {
      const applied = applySnapshot(snapshot, this.ctx);
      this.lastSaved = applied;
      this.savedAt = applied.savedAt;
      this.dirty = false;
      this.pendingApply = null;
      if (!this.ctx?.editor?.active) this._rememberCheckpoint(applied);
    } finally {
      this.applying = false;
    }
  }

  /* ---------- APIs que usa la UI --------------------------------------- */

  signIn(email, password) { return this.auth.signIn(email, password); }
  signUp(email, password, displayName) { return this.auth.signUp(email, password, displayName); }
  requestPasswordReset(email) { return this.auth.requestPasswordReset(email); }
  verifyRecoveryCode(email, token) { return this.auth.verifyRecoveryCode(email, token); }
  updatePassword(password) { return this.auth.updatePassword(password); }
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
    this.markDirty({ reload: false });
  }

  dispose() {
    this.sessionLock.dispose();
    clearInterval(this._timer);
    clearInterval(this._versionTimer);
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
