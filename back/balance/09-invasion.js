/* ==========================================================
 * BALANCE 09 — INVASIÓN (reloj, cola y despliegue)
 * ----------------------------------------------------------
 * preparacionS = s antes de desplegar · batallaS = límite de combate
 * · gapDespliegueS = s entre tropas de la cola · rally = reunión.
 * Tiempos reales: no los afecta obras.escalaTiempo.
 * Los cuatro primeros campos son espejo de js/balance/09-invasion.js
 * (legacy, no se toca). `ejercitoPrueba` es el ejército inicial de la
 * simulación; las tropas se despliegan una a una desde el panel de invasión
 * (no hay oleadas: esto es una simulación RTS, no un tower defense).
 * ========================================================== */

export const invasion = {
  preparacionS: 30,
  batallaS: 300,
  gapDespliegueS: 0.45,
  rally: { x: 38.5, y: 20.5 },

  // Ejército inicial de la simulación (Fase 8), igual que en el legacy.
  ejercitoPrueba: { esqueleto: 0, slime: 0 },

  // Botín al destruir una estructura: el atacante se lleva el 25 % de los
  // almacenes y el 50 % de lo producido por talleres/minas. El dueño conserva
  // el resto: solo pierde lo que efectivamente se roban.
  botinAlmacenes: 0.25,
  botinProductores: 0.5,
};
