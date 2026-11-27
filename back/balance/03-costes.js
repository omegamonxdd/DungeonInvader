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
    'vault-rubies':   { coins: 10000, crystals: 10000 },
    'prod-coins':     { crystals: 250 },
    'prod-crystals':  { coins: 250 },
    'prod-rubies':    { coins: 1500, crystals: 1500 },
    rift:             {},
    lab:              { crystals: 2000 },
    ballista:         { coins: 200 },
    turret:           { coins: 2500 },
    catapult:         { coins: 7500 },
    'altar-electrico': { coins: 22500 },
    'altar-igneo':     { coins: 22500 },
    banner:           { crystals: 500 },
    bannerslime:      { crystals: 2500 },
    bomb:             { coins: 100 },
    electro:          { coins: 7500 },
    incubator:        { crystals: 10000 },
    rocktrap:         { coins: 500 },
    'rag-altar':      { rubies: 2500 },
  },

  mejora: {
    core:        { 2: { coins: 2500 }, 3: { coins: 7500 }, 4: { coins: 15000 } },
    entrance:    { 2: { coins: 5000 }, 3: { coins: 15000 }, },
    ballista:    { 2: { coins: 400 }, 3: { coins: 1000 }, 4: { coins: 7500}, 5: { coins: 12500} },
    turret:      { 2: { coins: 3000 }, 3: { coins: 6000 }, 4: { coins: 12000 } },
    catapult:    { 2: { coins: 12500 } },
    'altar-electrico': { 2: { coins: 30000 } },
    'altar-igneo':     { 2: { coins: 30000 } },
    rift:        { 2: { crystals: 750 }, 3: { crystals: 3000 }, 4: { crystals: 7500 } },
    lab:         { 2: { crystals: 7500 }, 3: { crystals: 22500} },
    incubator:   { 2: { crystals: 15000 } },
    'vault-coins':    { 2: {crystals: 1000 }, 3: {crystals: 3000 }, 4: {crystals: 7500 } },
    'vault-crystals': { 2: { coins: 1000}, 3: { coins: 3000}, 4: { coins: 7500 } },
    'vault-rubies':   { 2: { coins: 15000, crystals: 15000 } },
    mine:        { 2: { coins: 300 }, 3: { coins: 750 }, 4: { coins: 1500 }, 5: { coins: 3000 } },
    workshop:    { 2: { crystals: 300 }, 3: { crystals: 750 }, 4: { crystals: 1500 }, 5: { crystals: 3000 } },
    'mine-rubies': { 2: { coins: 3000, crystals: 3000 }, 3: { coins: 7500, crystals: 7500 } },
    banner:      { 2: { crystals: 300 }, 3: { crystals: 800 }, 4: { crystals: 2000 }, 5: { crystals: 4000 }, 6: { crystals: 8000 } }, // TODO balance nv6
    bannerslime: { 2: { crystals: 3000 }, 3: { crystals: 6000 } },
    bomb:        { 2: { coins: 150 }, 3: { coins: 300 }, 4: { coins: 600 } },
    rocktrap:    { 2: { coins: 700 }, 3: { coins: 1500 } },
    electro:     { 2: { coins: 10000 } },
  },

  mutacionTropa: {
    esqueleto:  { 2: { crystals: 200 }, 3: { crystals: 750 }, 4: { crystals: 15000} },
    slime:      { 2: { crystals: 250 }, 3: { crystals: 600 }, 4: { crystals: 20000 } },
    golem:      { 2: { crystals: 800 }, 3: { crystals: 1600 }, 4: { crystals: 30000 } },
    murcielago: { 2: { crystals: 400 }, 3: { crystals: 20000}, 4: { crystals: 25000} },
    armadura:   { 2: { crystals: 1200 }, 3: { crystals: 37500} },
    arana:      { 2: { crystals: 1500 }, 3: { crystals: 30000 }, 4: { crystals: 42500 } },
  },

  mejorasRag: {
    2: { rubies: 3000 },
    3: { rubies: 3500 },
    4: { rubies: 4000 },
    5: { rubies: 5000 },
  },
};
