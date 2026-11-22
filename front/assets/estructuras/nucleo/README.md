# Sprites del núcleo

Arte 2.5D estilo Clash of Clans horneado desde un **modelo 3D estilizado** con
cámara ortográfica isométrica verdadera (elevación 30°, azimut 45°), con el
mismo pipeline que la ballesta. No hay transformaciones 2D en tiempo de
ejecución: el núcleo no gira, así que basta un render.

## Regenerar

```bash
npm run art:core
```

El generador es `tools/core-art/generate.mjs`. Renderiza con supersampling 4×,
z-buffer, sombra de contacto y contorno de 1 px, y escribe `core-art.json` con
las medidas derivadas.

## Archivos

| Archivo | Uso |
|---|---|
| `core.png` | Núcleo completo + sombra. 384×384 RGBA. **Este lo carga Phaser.** |
| `core-glow.png` | Resplandor cian 256×256 RGBA. **Este también lo carga Phaser.** |
| `core-art.json` | Ancla, escala y caja de contenido. Referencia del generador. |

## Modelo y paleta

- Plataforma de tres escalones de piedra gris de mazmorra (`#97979f` luz,
  `#74747e` frente, `#4c4c57` sombra) con juntas y grietas oscuras. Misma
  piedra, con el alto de la base recortado a la mitad.
- Cuatro pilares desgastados en las esquinas de la huella 3×3: zapata ancha,
  fuste biselado y remate partido; grietas quebradas en las caras visibles.
- Cristal cian pequeño (`#5cdcfc` / `#baf6ff` / `#1e84be`) flotando en el
  centro, con facetas de tonos distintos, astillas menores y resplandor.
- Misma clave cálida y relleno frío que la ballesta, AO en los rincones y
  contorno oscuro calculado tras el *downsample*.

## Anclas (importante si se cambia el modelo)

| Punto | Posición en el PNG |
|---|---|
| Centro de la huella 3×3, sobre `CORE_HEIGHT` | `(192, 306)` |
| Centro del cristal (donde va el resplandor) | 43 px por encima del ancla |
| Escala en el juego | `1.0947` px de mundo por px de arte |

`back/config/coreArt.js` y `back/entities/CoreView.js` consumen esos números.
Si se regenera el modelo, actualiza ambos.
