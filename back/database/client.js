/* ==========================================================
 * CLIENTE DE SUPABASE (creación perezosa)
 * ----------------------------------------------------------
 * El import de @supabase/supabase-js se hace de forma dinámica y solo
 * cuando hay credenciales. Así el modo local no descarga nada extra
 * y un fallo de red no impide arrancar el juego.
 * ========================================================== */

import { SUPABASE_ENABLED, SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let clientPromise = null;

/** Devuelve el cliente (o null si no está configurado / falla su creación). */
export async function getSupabase() {
  if (!SUPABASE_ENABLED) return null;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }))
      .catch(err => {
        console.warn('[database] No se pudo crear el cliente de Supabase:', err);
        return null;
      });
  }
  return clientPromise;
}

/** Acceso sincrónico al cliente ya inicializado (para los if rápidos). */
export function hasSupabase() {
  return SUPABASE_ENABLED && Boolean(clientPromise);
}
