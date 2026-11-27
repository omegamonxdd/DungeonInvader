/* ==========================================================
 * BALANCE 05 — EDIFICIOS (vida, tamaño, capacidad y producción)
 * ----------------------------------------------------------
 * Unidades: casillas para tamaños/alcances, hp para vida,
 * recursos por hora para rate, segundos para tiempos.
 * `niveles` se indexa por nivel; levelRow() reutiliza la última
 * fila definida si falta el nivel pedido.
 * Espejo de js/balance/05-edificios.js (legacy, no se toca).
 * ========================================================== */

export const edificios = {
  grieta: {
    size: 2, height: 40, maxNivel: 4,
    hp: { 1: 400, 2: 450, 3: 500, 4: 550 },
  },
  laboratorio: {
    size: 2, height: 26, maxNivel: 3,
    hp: { 1: 350, 2: 400, 3: 450 },
  },
  incubadora: {
    size: 2, height: 40, maxNivel: 2,
    hp: { 1: 400, 2: 450 },
  },
  almacen: {
    size: 3, height: 26, inset: 0.3, lid: 6, maxNivel: 4,
    capacidad: { 1: 2500, 2: 5000, 3: 10000, 4: 25000 },
    hp: { 1: 650, 2: 700, 3: 850, 4: 925 },
  },

  almacenRubies: {
    size: 3, height: 26, inset: 0.3, lid: 6, maxNivel: 2,
    capacidad: { 1: 1000, 2: 2500 },
    hp: { 1: 850, 2: 900 },
  },
  produccion: {
    size: 2, height: 26, maxNivel: 5,
    niveles: {
      1: { hp: 300, rate: 250, cap: 1250 },
      2: { hp: 330, rate: 300, cap: 1500 },
      3: { hp: 350, rate: 360, cap: 1960 },
      4: { hp: 380, rate: 450, cap: 2700 },
      5: { hp: 420, rate: 550, cap: 4000 }
    },
  },

  produccionRubies: {
    size: 2, height: 26, maxNivel: 3,
    niveles: {
      1: { hp: 300, rate: 80, cap: 320 },
      2: { hp: 330, rate: 120, cap: 560 },
      3: { hp: 350, rate: 160, cap: 800 },
    },
  },
  banderaEsqueletos: {
    size: 1, height: 56, range: 3, maxNivel: 6,
    niveles: {
      1: { count: 1, skeletonLevel: 1 },
      2: { count: 2, skeletonLevel: 1 },
      3: { count: 3, skeletonLevel: 1 },
      4: { count: 3, skeletonLevel: 2 },
      5: { count: 3, skeletonLevel: 3 },
      6: { count: 3, skeletonLevel: 4 }, 
    },
  },
  banderaSlimes: {
    size: 1, range: 3, maxNivel: 3,
    niveles: {
      1: { count: 1, slimeLevel: 1 },
      2: { count: 1, slimeLevel: 2 },
      3: { count: 1, slimeLevel: 3 },
    },
  },

  ragAltar: {
    size: 2, height: 40, maxNivel: 1,
    hp: { 1: 500 },
    range: 5,
  },
};
