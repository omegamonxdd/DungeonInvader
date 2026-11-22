/* ==========================================================
 * REPOSITORIO DE GUARDADOS
 * ----------------------------------------------------------
 * Una tabla, una fila por (usuario, ranura). El estado completo viaja
 * en `state` (jsonb) con su `schema_version`, de modo que un cambio de
 * formato no obliga a alterar la tabla: las migraciones viven en JS.
 * Si Supabase no está disponible, todo se resuelve en localStorage.
 * ========================================================== */

import { DEFAULT_SLOT, SAVES_TABLE } from './config.js';
import { getSupabase } from './client.js';
import { loadLocal, saveLocal } from './storage.js';
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
