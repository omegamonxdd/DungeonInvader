# Balance de la app Phaser

Esta carpeta es la **única fuente de números ajustables** de la migración.
Es el equivalente en ES modules de `js/balance/` (legacy, que NO se toca).
Los valores son copia exacta del legacy para no alterar el balance ni la
paridad visual.

## Archivos

| Archivo | Qué controla |
|---|---|
| `01-mundo-y-nucleo.js` | Mapa 41×41, escala, núcleo, entrada, recursos, cámara, zoom, topos |
| `02-estructuras.js` | Límites por núcleo, techos de nivel y `maxNivel` |
| `03-costes.js` | Costes de construcción y mejora |
| `04-obras.js` | Constructores, tiempos de obra y `escalaTiempo` |
| `05-edificios.js` | Vida, tamaño, capacidad y producción |
| `06-defensas.js` | Ballesta, torreta, catapulta y proyectiles |
| `07-trampas.js` | Bomba, electrostal y trampa de rocas |
| `08-tropas.js` | Todas las tropas y requisitos de laboratorio |
| `09-invasion.js` | Reloj, cola de despliegue, punto de reunión y ejército de prueba de la Fase 8 |
| `index.js` | Agregador `BALANCE` + helpers + `balanceReport()` |

## Cómo editar

1. Abre el archivo de la tabla, cambia el número y guarda.
2. Vite recarga automáticamente. No hay persistencia: al recargar vuelve
   el estado inicial (excepto el propio archivo editado).
3. Valida en consola con `balanceReport()` o `__DUNGEON_BALANCE__.report()`
   (disponible solo en `npm run dev`).

`obras.escalaTiempo = 0.05` acelera las obras para pruebas. **Volver a 1 al terminar.**

## Helpers (`index.js`)

- `levelRow(tabla, nivel)` — lee tablas por nivel; si falta la fila, usa la última.
- `defDamage(dps, recarga)` — daño por impacto sin redondear a entero.
- `buildCost(slot)` / `upgradeCost(kind, nivel)` / `formatCost(coste)`.
- `buildTime(kind)` / `upgradeTime(kind, nivel)` — ya aplican `escalaTiempo`.
- `structureLimit(kind, nivelNucleo)` / `allowedMaxLevel(kind, nivelNucleo)`.
- `defensaAt(kind, nivel)` / `tropaAt(id, nivel)` / `trampaAt(kind, nivel)`.
- `statAt(tabla, nivel, clave)` — acceso genérico a una estadística.

## Paridad con el legacy

`config/world.js`, `config/interaction.js` y `config/defenses.js` importan
estos datos en lugar de repetirlos. Las medidas del sprite (caja, ancla,
bisagra, fotogramas) siguen en `config/defenses.js` porque son arte, no balance.
