# `front/` — Todo lo visual

Esta carpeta contiene **todo lo que se ve** del juego Phaser: hojas de estilo,
tokens de diseño, fuentes y sprites. No contiene lógica del juego; el código que
la consume vive en [`../back/`](../back/README.md).

Antes de la separación estos archivos estaban repartidos entre el `css/` del
legacy y `back/ui/ui.css` antes de moverlo. Ahora son una copia íntegra y **el proyecto ya no
depende del legacy exportado** a `C:\Users\omegamon\Desktop\DungeonBuild-Legacy`.

## Contenido

```
front/
  css/
    tokens/     01-paleta · 02-medidas · 03-motion · 04-composites · 05-fuentes
    base/       01-reset · 02-botones · 03-paneles · 04-animaciones
    hud/        01-estado · 02-recursos · 03-acciones · 04-mejoras · 05-obras
    menus/      01-construir-items · 02-construir-barra
    modales/    01-info · 02-atajos · 03-editor
    invasion/   01-tropas · 02-fin
    99-responsive.css   Media queries al final de la cascada
    ui.css              Punto de entrada: importa las 22 hojas + ajustes Phaser
  loading/
    splash.js           Controla la pantalla de carga: progreso, error y retirada
  assets/
    estructuras/ballesta/
      ballista-base.png     Pedestal + sombra (256×256)
      ballista-head-g0..g3.png  Atlas de 6 ángulos × 3 estados
      ballista-head-sheet.png   Hoja canónica de 24×3 (referencia)
      ballista-art.json     Anclas y medidas del render
      README.md             Modelo, paleta y convenciones del sprite
  README.md          Este archivo
```

## Punto de entrada

[`css/ui.css`](css/ui.css) es importado por `back/main.js`. Importa las 22 hojas
en el **orden de la migración** (no el del `index.html` legacy): conservar ese
orden es importante porque `05-obras` va antes que `04-mejoras` y
`99-responsive.css` debe quedar al final. Después de los `@import` están los
ajustes específicos de Phaser (`<div id="game">` en vez de `<canvas id="game">`,
cursores y bloqueo de cámara con modales abiertos).

## Pantalla de carga

`loading/splash.js` es la parte visual de la pantalla de carga: recibe el
progreso real del `Loader` de Phaser desde `back/scenes/BootScene.js`, muestra
fallos de carga y retira el overlay cuando `MainScene` está listo. El marcado y
el CSS crítico viven en el `<head>` de `index.html` para que aparezcan antes de
descargar el bundle; ver [`css/README.md`](css/README.md#pantalla-de-carga-excepción-deliberada).

## Reglas de edición

- Colores, medidas, animaciones y fuentes se editan **solo** en `css/tokens/`.
- Las fuentes están incrustadas en base64 dentro de `05-fuentes.css`: no hay
  archivos `.woff`/`.ttf` que copiar. **No tocar el blob base64.**
- El arte de la ballesta se importa desde `back/assets/index.js`; regenerarlo
  con `npm run art:ballista` y no renombrar los archivos sin actualizar ese
  import y `back/config/defenses.js`.
- Ver [css/README.md](css/README.md) y [assets/README.md](assets/README.md).
