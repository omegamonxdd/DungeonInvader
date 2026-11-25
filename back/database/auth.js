/* ==========================================================
 * AUTENTICACIÓN (Supabase Auth + modo invitado)
 * ----------------------------------------------------------
 * Expone una única interfaz para ambos modos. Si no hay credenciales,
 * el "usuario" es un id estable de este navegador y el progreso se
 * guarda solo en local. Si las hay, Supabase gestiona sesión,
 * refresh token y persistencia entre pestañas.
 * ========================================================== */

import { getSupabase } from './client.js';
import { getGuestId } from './storage.js';

const asUser = raw => ({
  id: raw?.id || getGuestId(),
  email: raw?.email || null,
  displayName: raw?.user_metadata?.display_name
    || raw?.display_name || null,
  guest: Boolean(raw?.guest),
});

/** URL base absoluta de la app, tanto en local como bajo /DungeonInvader/.
 *  Se usa como destino del enlace de confirmación de Supabase Auth. */
function appUrl() {
  if (typeof window === 'undefined' || !window.location?.href) return undefined;
  try { return new URL('.', window.location.href).href; }
  catch { return undefined; }
}

export class AuthService {
  constructor() {
    this.client = null;
    this.user = asUser({ guest: true });
    this.listeners = new Set();
    this.recoveryListeners = new Set();
    this._authUnsub = null;
  }

  get isGuest() { return this.user.guest; }
  get id() { return this.user.id; }
  get email() { return this.user.email; }
  get displayName() { return this.user.displayName; }
  get configured() { return Boolean(this.client); }

  /** Suscribe cambios de usuario. Devuelve función de baja. */
  onChange(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Suscribe evento de recuperación de contraseña (link por correo). */
  onRecovery(cb) {
    this.recoveryListeners.add(cb);
    return () => this.recoveryListeners.delete(cb);
  }

  _emit() {
    for (const cb of this.listeners) {
      try { cb(this.user); }
      catch (err) { console.warn('[auth] listener falló:', err); }
    }
  }

  _set(user, force = false) {
    const next = asUser(user);
    if (!force && next.id === this.user.id && next.email === this.user.email) return this.user;
    this.user = next;
    this._emit();
    return this.user;
  }

  /** Restaura la sesión persistida. Llamar una sola vez al arrancar. */
  async restore() {
    this.client = await getSupabase();
    if (this.client) {
      try {
        const { data } = await this.client.auth.getSession();
        if (data?.session?.user) this._set(data.session.user);
      } catch (err) {
        console.warn('[auth] No se pudo restaurar la sesión:', err);
      }
      try {
        const { data } = await this.client.auth.onAuthStateChange((event, session) => {
          if (session?.user) this._set(session.user);
          else this._set({ guest: true });
          if (event === 'PASSWORD_RECOVERY') {
            for (const cb of this.recoveryListeners) {
              try { cb(session?.user); } catch (err) { console.warn('[auth] recovery listener falló:', err); }
            }
          }
        });
        this._authUnsub = data?.subscription || null;
      } catch { /* la suscripción es opcional */ }
    } else {
      this._set({ guest: true }, true);
    }
    return this.user;
  }

  async signIn(email, password) {
    if (!this.client) return { user: null, error: 'Supabase no está configurado en este navegador.' };
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) return { user: null, error: error.message };
    return { user: this._set(data.user), error: null };
  }

  async signUp(email, password, displayName = '') {
    if (!this.client) return { user: null, error: 'Supabase no está configurado en este navegador.' };
    const name = String(displayName || '').trim().slice(0, 24);
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      // Sin esto, Supabase usa su Site URL (http://localhost:3000 por
      // defecto) y la confirmación de email nunca vuelve a la página real.
      options: {
        emailRedirectTo: appUrl(),
        // El trigger de public.profiles guarda este nombre en display_name.
        data: name ? { display_name: name } : undefined,
      },
    });
    if (error) return { user: null, error: error.message };
    // Con confirmación de email, `session` viene null: no cambiamos de usuario
    // hasta que Supabase emita el evento SIGNED_IN.
    if (data?.session?.user) this._set(data.session.user);
    return { user: this.user, error: null, needsConfirmation: !data?.session };
  }

  async requestPasswordReset(email) {
    if (!this.client) return { error: 'Supabase no está configurado en este navegador.' };
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: appUrl(),
    });
    if (error) return { error: error.message };
    return { error: null };
  }

  async verifyRecoveryCode() {
    return { error: 'El flujo por código ya no está activo. Usa el enlace enviado a tu correo.' };
  }

  async updatePassword(password) {
    if (!this.client) return { error: 'Supabase no está configurado en este navegador.' };
    const { data, error } = await this.client.auth.updateUser({ password });
    if (error) return { error: error.message };
    if (data?.user) this._set(data.user);
    return { error: null };
  }

  async signOut() {
    if (this.client) {
      const { error } = await this.client.auth.signOut();
      if (error) return { error: error.message };
    }
    this._set({ guest: true });
    return { error: null };
  }

  /** Pasa a modo invitado sin cerrar sesión en Supabase (solo local). */
  continueAsGuest() {
    this._set({ guest: true });
    return this.user;
  }

  dispose() {
    this._authUnsub?.unsubscribe?.();
    this._authUnsub = null;
    this.listeners.clear();
  }
}
