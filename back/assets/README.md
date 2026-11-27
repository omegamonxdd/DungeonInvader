# `back/assets/` — Assets importados

| Archivo | Contenido |
|---|---|
| `index.js` | Exporta `ASSETS.ballista`, `ASSETS.turret` y `ASSETS.catapult` (pedestal + 4 atlas de cabeza cada uno), `ASSETS.core` (imagen + resplandor) `ASSETS.vaultCoins`, `ASSETS.vaultCrystals` y `ASSETS.workshop`, importados desde `front/assets/estructuras/` |

`BootScene` registra `ballista-base`, `turret-base`, `catapult-base`, los
spritesheets `ballista-head-0..3`, `turret-head-0..3` y `catapult-head-0..3`
(24 ángulos × 3 estados por defensa), las texturas `core` / `core-glow` y las
imágenes estáticas `vault-coins` / `vault-crystals` / `workshop`. Es la
única dependencia de archivos binarios del código: el resto de las texturas se
hornean en memoria (`systems/textures.js`, `systems/ballistaTextures.js`,
`systems/turretTextures.js`, `systems/catapultTextures.js`,
`enemies/troopArt.js`, `entities/topoArt.js`).
