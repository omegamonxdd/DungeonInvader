# `back/scenes/` — Escenas de Phaser

| Archivo | Contenido |
|---|---|
| `BootScene.js` | Carga pedestales y 4 atlas de cabeza de las tres defensas + núcleo/resplandor, y arranca `MainScene`. Los tres bloques de carga se generan con un bucle sobre `DEFENSE_GROUPS`. |
| `MainScene.js` | Crea el mapa 41×41, terreno, núcleo, entrada, ballesta/lanzadardos de demostración y todos los controladores; ejecuta `update()` (cámara, invasión, obras, topos, producción) y conecta la UI DOM. |

Es el punto de composición del juego: recibe los eventos de `systems/` y `ui/`
y decide qué vistas de `entities/` se dibujan. `MainScene.update()` coordina
los relojes en tiempo real (obra e invasión) antes del dibujo de estructuras.

## Pantalla de carga

`BootScene.preload()` llama a `beginLoading()` y conecta tres eventos del
`Loader` de Phaser con [`front/loading/splash.js`](../../front/loading/splash.js):

- `progress` → `setLoadingProgress(valor)` (barra real, no animada).
- `filecomplete` → añade el nombre del archivo como detalle.
- `loaderror` → `failLoading()` deja el mensaje de error visible.

`MainScene.create()` llama a `finishLoading()` al terminar de montar la UI, y
la pantalla se retira con una transición. El marcado y el CSS crítico están en
`index.html` (raíz) para que se pinte antes de descargar el bundle.
