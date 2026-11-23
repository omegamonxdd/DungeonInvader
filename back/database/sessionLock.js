/* ==========================================================
 * UNA SOLA PESTAÑA ACTIVA POR CUENTA
 * ----------------------------------------------------------
 * Las pestañas del mismo navegador se avisan por BroadcastChannel
 * (con fallback a `storage`). Al abrir una pestaña nueva con la misma
 * cuenta, la anterior deja de guardar y muestra una pantalla de aviso.
 * No se cierra de verdad: los navegadores modernos no permiten cerrar
 * una pestaña que el usuario abrió manualmente, así que se desactiva y
 * se intenta `window.close()` por si se abrió desde un enlace.
 * ========================================================== */

const CHANNEL = 'dungeon-build-session';
const STORAGE_KEY = 'dungeon-build:tab-takeover';

const newId = () => (globalThis.crypto?.randomUUID
  ? globalThis.crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export class SessionLock {
  constructor({ onLock = () => {}, onUnlock = () => {} } = {}) {
    this.tabId = newId();
    this.userId = null;
    this.startedAt = 0;
    this.locked = false;
    this.winnerId = null;
    this.onLock = onLock;
    this.onUnlock = onUnlock;

    this.channel = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(CHANNEL) : null;
    if (this.channel) this.channel.onmessage = e => this._receive(e.data);
    else globalThis.addEventListener?.('storage', e => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try { this._receive(JSON.parse(e.newValue)); } catch { /* ignore */ }
      }
    });

    this._boundPageHide = () => {
      if (this.userId) this._send({ type: 'bye', userId: this.userId, tabId: this.tabId });
    };
    globalThis.addEventListener?.('pagehide', this._boundPageHide);
  }

  /** Llamar al restaurar/cambiar la identidad. `null` libera la pestaña. */
  attach(userId) {
    const id = userId && !String(userId).startsWith('guest:') ? String(userId) : null;
    this.userId = id;
    this.startedAt = Date.now();
    if (!id) {
      this._unlock();
      this._send({ type: 'bye', userId: null, tabId: this.tabId });
      return;
    }
    this._unlock();
    this._send({ type: 'takeover', userId: id, tabId: this.tabId, at: this.startedAt });
  }

  /** El usuario recuperó esta pestaña desde el aviso. */
  resume() {
    if (!this.userId) return;
    this.startedAt = Date.now();
    this._unlock();
    this._send({
      type: 'takeover', userId: this.userId, tabId: this.tabId, at: this.startedAt,
    });
  }

  _receivesLater(mine, other) {
    if (other.at !== mine.at) return other.at > mine.at;
    return String(other.tabId) > String(mine.tabId);
  }

  _receive(msg) {
    if (!msg || msg.tabId === this.tabId) return;

    if (msg.type === 'bye') {
      if (this.locked && msg.userId === this.userId && msg.tabId === this.winnerId) {
        this.startedAt = Date.now();
        this._unlock();
        this._send({
          type: 'takeover', userId: this.userId, tabId: this.tabId, at: this.startedAt,
        });
      }
      return;
    }

    if (msg.type !== 'takeover' || !msg.userId || msg.userId !== this.userId) return;
    const mine = { at: this.startedAt, tabId: this.tabId };
    if (this._receivesLater(mine, msg)) {
      this._lock(msg.tabId);
    } else {
      // Esta pestaña es más nueva: la otra debe ceder.
      this._send({
        type: 'takeover', userId: this.userId, tabId: this.tabId, at: Date.now(),
      });
    }
  }

  _lock(winnerId) {
    if (this.locked) return;
    this.locked = true;
    this.winnerId = winnerId;
    this.onLock();
    try { globalThis.window?.close?.(); } catch { /* navegador lo impide */ }
  }

  _unlock() {
    if (!this.locked) return;
    this.locked = false;
    this.winnerId = null;
    this.onUnlock();
  }

  _send(msg) {
    try {
      if (this.channel) this.channel.postMessage(msg);
      else globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(msg));
    } catch { /* canal no disponible: esta pestaña simplemente no avisa */ }
  }

  dispose() {
    this.channel?.close?.();
    globalThis.removeEventListener?.('pagehide', this._boundPageHide);
  }
}
