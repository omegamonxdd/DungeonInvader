# Generador de arte del núcleo

`generate.mjs` aplica el pipeline `coc-25d-pipeline` al núcleo de la mazmorra,
con el mismo enfoque sin dependencias que `tools/ballista-art/generate.mjs`:
modelo 3D estilizado → cámara **ortográfica isométrica real** (azimut 45°,
elevación 30°) → z-buffer → downsample → contorno de 1 px → PNG RGBA8.

```bash
npm run art:core
```

## Modelo

- **Plataforma**: tres escalones de piedra gris con juntas y grietas, que
  asientan el conjunto sobre la huella 3×3 del terreno. Su altura está
  recortada a la mitad (`BASE_H_SCALE = 0.5`); el zócalo y el cristal bajan con
  ella para seguir apoyados en el escalón superior.
- **4 pilares** en las esquinas: zapata ancha, fuste biselado en dos tramos,
  remate partido en dos alturas y grietas quebradas en las caras visibles.
  Proporciones *chunky* y biseles que capturan la luz cenital, igual que la
  ballesta.
- **Cristal**: octaedro de 6 caras en cian saturado (`#5cdcfc`), con facetas
  de tono distinto, un destello interior y dos astillas menores.
- **Resplandor**: gradiente radial cian horneado aparte; `CoreView` anima solo
  su alfa (latido de 650 ms).

La clave cálida y el relleno frío son luces **de mundo** fijas: el sombreado se
aplica después de colocar la geometría, como en la ballesta. La sombra de
contacto se hornea en el PNG.

## Salidas

En `front/assets/estructuras/nucleo/`:

| Archivo | Contenido |
|---|---|
| `core.png` | 384×384 RGBA. Ancla del centro de la huella en `(192, 306)`. |
| `core-glow.png` | 256×256 RGBA. Resplandor cian. |
| `core-art.json` | `artScale` (1.0947), ancla, `glow.lift` (43 px) y caja de contenido. |

En `tools/core-art/preview.png`: composición de verificación sobre color de
mazmorra. La consola imprime también una vista ASCII al hornear.

## Integración

- `back/assets/index.js` importa los PNG y `BootScene` los registra como
  `core` y `core-glow`.
- `back/config/coreArt.js` replica ancla/escala del JSON generado.
- `back/entities/CoreView.js` coloca la imagen sobre `iso(x+1.5, y+1.5,
  CORE_HEIGHT)` y pulsa el resplandor. Ya no dibuja el cristal con Graphics
  ni usa la textura `core-glow` roja antigua (eliminada de `textures.js`).

Si se cambia el modelo o la cámara, regenera y actualiza `back/config/coreArt.js`.
