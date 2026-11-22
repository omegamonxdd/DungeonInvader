# `back/config/` — Configuración

| Archivo | Contenido |
|---|---|
| `gameConfig.js` | Configuración del `Phaser.Game`: tipo de renderer, tamaño, escala, física Arcade (reservada) y escenas |
| `world.js` | Escala isométrica, tamaño de baldosa y medidas del mundo; lee los números de `../balance/` |
| `palette.js` | Colores del terreno y de las vistas Phaser (espejo del `04-render.js` legacy) |
| `defenses.js` | Medidas del sprite de la ballesta: caja, ancla, bisagra y fotogramas. Son **arte**, no balance |
| `interaction.js` | Umbrales de arrastre, selección y herramientas |
| `buildSlots.js` | Catálogo de ranuras del menú Construir, compartido por la UI y las obras del núcleo |

Regla: los números ajustables van en `../balance/`. Aquí solo se traducen a
configuración de Phaser o se guardan medidas visuales del sprite.
