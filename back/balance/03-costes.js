/* ==========================================================
 * BALANCE 03 — COSTES DE CONSTRUCCIÓN Y MEJORA
 * ----------------------------------------------------------
 * construccion: clave = id de la ranura del menú sin "build-".
 *   {} = gratis. Se cobra al CONFIRMAR la colocación.
 * mejora: clave = kind del edificio, dentro el NIVEL AL QUE se sube.
 *   Se cobra al INICIAR la obra.
 * Espejo de js/balance/03-costes.js (legacy, no se toca).
 * ========================================================== */

export const costes = {
  construccion: {
    'vault-coins':    { crystals: 750 },
    'vault-crystals': { coins: 750 },
    'prod-coins':     { crystals: 250 },
    'prod-crystals':  { coins: 250 },
    rift:             {},
    lab:              { crystals: 2000 },
    ballista:         { coins: 200 },
    turret:           { coins: 2500 },
    catapult:         { coins: 7500 },
    banner:           { crystals: 500 },
    bannerslime:      { crystals: 2500 },
    bomb:             { coins: 100 },
    electro:          { coins: 7500 },
    incubator:        { crystals: 10000 },
    rocktrap:         { coins: 500 },
  },

  mejora: {
    core:        { 2: { coins: 2000, crystals: 2000 }, 3: { coins: 6000, crystals: 6000 } },
    entrance:    { 2: { coins: 1500 }, 3: { coins: 5000 } },
    ballista:    { 2: { coins: 400 }, 3: { coins: 1000 } },
    turret:      { 2: { coins: 3000 }, 3: { coins: 6000 }, 4: { coins: 12000 } },
    catapult:    { 2: { coins: 12000 } },
    rift:        { 2: { crystals: 500 }, 3: { crystals: 2000 }, 4: { crystals: 6000 } },
    lab:         { 2: { crystals: 4000 } },
    incubator:   { 2: { crystals: 15000 } },
    vault:       { 2: { coins: 1000, crystals: 1000 }, 3: { coins: 3000, crystals: 3000 } },
    mine:        { 2: { coins: 600 }, 3: { coins: 1500 }, 4: { coins: 4000 } },
    workshop:    { 2: { crystals: 600 }, 3: { crystals: 1500 }, 4: { crystals: 4000 } },
    banner:      { 2: { crystals: 300 }, 3: { crystals: 800 }, 4: { crystals: 2000 }, 5: { crystals: 4000 } },
    bannerslime: { 2: { crystals: 3000 }, 3: { crystals: 6000 } },
    bomb:        { 2: { coins: 150 }, 3: { coins: 300 }, 4: { coins: 600 } },
    rocktrap:    { 2: { coins: 700 }, 3: { coins: 1500 } },
    electro:     { 2: { coins: 10000 } },
  },
};
