/* ==========================================================
 * REPOSITORIO DE GUARDADOS
 * ----------------------------------------------------------
 * Una tabla, una fila por (usuario, ranura). El estado completo viaja
 * en `state` (jsonb) con su `schema_version`, de modo que un cambio de
 * formato no obliga a alterar la tabla: las migraciones viven en JS.
 * Si Supabase no está disponible, todo se resuelve en localStorage.
 * ========================================================== */

import { CHECKPOINT_SLOT, DEFAULT_SLOT, SAVES_TABLE } from './config.js';
import { getSupabase } from './client.js';
import {
  clearLocal as clearLocalStorage,
  loadCheckpoint as loadCheckpointLocal,
  loadLocal, saveCheckpoint as saveCheckpointLocal, saveLocal,
} from './storage.js';
import { normalizeSnapshot, savedAtMs } from './snapshot.js';

export class SaveRepository {
  constructor() {
    this.client = null;
  }

  async init() {
    this.client = await getSupabase();
    return this.client;
  }

  get remoteEnabled() { return Boolean(this.client); }

  /* ---------- Local ----------------------------------------------------- */

  loadLocal(userId) { return loadLocal(userId); }
  saveLocal(snapshot, userId) { return saveLocal(snapshot, userId); }

  loadCheckpoint(userId) { return loadCheckpointLocal(userId); }
  clearLocal(userId) { return clearLocalStorage(userId); }

  /** Escribe el checkpoint en local y, si hay nube, en su propia ranura. */
  async saveCheckpoint(snapshot, userId) {
    const snap = { ...snapshot, slot: CHECKPOINT_SLOT };
    saveCheckpointLocal(snap, userId);
    return this.saveRemote(userId, snap);
  }

  /* ---------- Supabase -------------------------------------------------- */

  async loadRemote(userId, slot = DEFAULT_SLOT) {
    if (!this.client || !userId || String(userId).startsWith('guest:')) return null;
    try {
      const { data, error } = await this.client
        .from(SAVES_TABLE)
        .select('state, updated_at, schema_version')
        .eq('user_id', userId)
        .eq('slot', slot)
        .maybeSingle();
      if (error) throw error;
      if (!data?.state) return null;
      const snap = normalizeSnapshot(data.state);
      // La marca de la fila manda en conflictos: el reloj del servidor es
      // más fiable que el del navegador.
      if (data.updated_at) snap.savedAt = data.updated_at;
      return snap;
    } catch (err) {
      console.warn('[database] No se pudo leer el guardado remoto:', err);
      return null;
    }
  }

  async saveRemote(userId, snapshot) {
    if (!this.client || !userId || String(userId).startsWith('guest:')) {
      return { ok: false, reason: 'local' };
    }
    const row = {
      user_id: userId,
      slot: snapshot.slot || DEFAULT_SLOT,
      schema_version: snapshot.version,
      balance_version: snapshot.balanceVersion || null,
      state: snapshot,
      updated_at: new Date().toISOString(),
    };
    try {
      const { error } = await this.client
        .from(SAVES_TABLE)
        .upsert(row, { onConflict: 'user_id,slot' });
      if (error) throw error;
      return { ok: true, savedAt: row.updated_at };
    } catch (err) {
      console.warn('[database] No se pudo subir el guardado:', err);
      return { ok: false, error: err?.message || String(err) };
    }
  }

  /** Última partida válida del usuario en la nube (ranura aparte). */
  async loadCheckpointRemote(userId) {
    return this.loadRemote(userId, CHECKPOINT_SLOT);
  }

  /* ---------- Rivales de invasión (RPC de solo lectura) ------------------ */

  async listOpponents() {
    if (!this.client) return [];
    try {
      const { data, error } = await this.client.rpc('list_invasion_targets');
      if (error) throw error;
      return (data || []).map(row => ({
        id: row.user_id,
        name: row.display_name || 'Jugador',
        updatedAt: row.updated_at || null,
      }));
    } catch (err) {
      console.warn('[database] No se pudo listar rivales:', err);
      return [];
    }
  }

  _rpcSnapshot(rpc, userId) {
    if (!this.client || !userId) return Promise.resolve(null);
    return this.client.rpc(rpc, { p_user_id: userId })
      .then(({ data, error }) => {
        if (error) throw error;
        if (!data) return null;
        const raw = typeof data === 'string' ? JSON.parse(data) : data;
        return normalizeSnapshot(raw);
      })
      .catch(err => {
        console.warn(`[database] No se pudo leer ${rpc}:`, err);
        return null;
      });
  }

  loadOpponentBase(userId) { return this._rpcSnapshot('get_invasion_target_state', userId); }

  loadOpponentCheckpoint(userId) {
    return this._rpcSnapshot('get_invasion_target_checkpoint', userId);
  }

  async deleteRemote(userId, slot = DEFAULT_SLOT) {
    if (!this.client || !userId || String(userId).startsWith('guest:')) return false;
    const { error } = await this.client
      .from(SAVES_TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('slot', slot);
    return !error;
  }

  /** Compara por fecha para decidir qué versión gana. */
  static newer(a, b) { return savedAtMs(a) > savedAtMs(b); }
}
