---
name: coc-25d-pipeline
description: Pipeline completo para crear estructuras defensivas con acabado estilo Clash of Clans mediante modelado 3D estilizado procedural y horneado de spritesheets ortográficos isométricos para Phaser 3.
---

# Pipeline de Arte y Animación 2.5D Estilo Clash of Clans (`coc-25d-pipeline`)

## 1. Principio Arquitectónico Obligatorio
- **PROHIBIDO simular rotación 2.5D con `scaleX = Math.cos(angle)` o deformaciones 2D** sobre una vista lateral.
- Toda estructura giratoria debe generarse desde un **modelo 3D estilizado** (usando **Blender CLI en Python** o **Three.js headless**) y renderizarse con una **cámara ortográfica isométrica verdadera** para exportar spritesheets PNG RGBA limpios.

## 2. Dirección de Arte (Estilo Clash of Clans / Supercell)
Para lograr el acabado táctil, robusto y colorido característico:
- **Proporciones "Chunky" (Robustas)**: Evita piezas delgadas o tipo alambre. Usa vigas de madera gruesas, bases anchas bien asentadas (relación ancho:alto ~`1.1:1`) y exageración de silueta para que se lea claro a escala pequeña.
- **Bordes Biselados (*Bevel*) Obligatorios**: Ninguna arista debe ser a 90° filosos. Aplica siempre modificador `Bevel` (o geometría biselada) en madera y metal para capturar brillos cenitales en los cantos.
- **Materiales y Texturas Estilizadas**:
  - **Madera cálida (`#e09050` luz / `#9e4f24` sombra)**: Añadir variación de vetas sutiles y gradiente vertical (más oscuro abajo, más cálido arriba).
  - **Cuerdas y amarres (`#e8dfcf` / `#c9b79c`)**: Geometría cilíndrica/toroidal con volumen real enrollada en las uniones (nunca líneas pintadas planas).
  - **Metal y remaches (`#6b6b8c` / `#8f92b5`)**: Acabado mate satinado con remaches semiesféricos visibles.
  - **Proyectiles / Acentos (`#d93829` / `#ff5947`)**: Colores saturados de alto contraste para lectura instantánea en combate.
- **Iluminación y Sombra de Contacto**:
  - Luz principal (*Key Light*) cálida desde arriba-izquierda (`elevación 55°`, `azimut -45°`) + luz de relleno (*Fill Light*) suave azulada/fría desde la derecha para evitar sombras negras muertas.
  - **Oclusión Ambiental (*AO*)**: Activar AO para oscurecer automáticamente los rincones donde las cuerdas aprietan la madera.
  - **Sombra en el suelo**: Renderizar una sombra suave de contacto (`rgba(15, 10, 25, 0.38)`) debajo de la base en el plano del suelo para anclar la torre al mapa isométrico.

## 3. Cámara Isométrica y Renderizado Sin Halos
- **Proyección**: Cámara ortográfica inclinada exactamente a **`30°`** (isometría de videojuegos 2:1, `Math.atan(0.5) ≈ 26.565°` o `30°` según la grilla del mapa).
- **Cero bordes blancos (Alpha Limpio)**: Renderizar siempre sobre fondo transparente puro (`film_transparent = True` en Blender o `alpha: true, premultipliedAlpha: false` en WebGLRenderer). Nunca recortar sobre blanco.
- **Resolución por frame**: `256x256` o `384x384` px con supersampling `2x`/`3x` y downscale Lanczos/Bicubic.

## 4. Separación de Mallas y Spritesheets para Phaser 3
Cada defensa se exporta en dos texturas independientes en `front/assets/estructuras/<id>/`:
1. **`<id>-base.png`**:
   - Contiene exclusivamente el trípode/pedestal estático + su sombra de contacto en el suelo.
   - Ancla (*origin*): centro exacto de la huella en el suelo.
2. **`<id>-head-sheet.png`**:
   - Contiene exclusivamente la torreta superior giratoria centrada en su pivote `(0, 0, 0)` (sin base y sin sombra proyectada al suelo).
   - **Cuadrícula**:
     - **Columnas (`24` ángulos)**: Rotación real en eje vertical `Z`/`Y` desde `0°` hasta `345°` en pasos exactos de **`15°`**.
     - **Filas (`3` estados)**:
       - Fila `0`: `idle` (reposo, proyectil cargado).
       - Fila `1`: `fire` (retroceso máximo de la cabeza + cuerda tensada/liberada, sin proyectil).
       - Fila `2`: `recover` (retorno intermedio hacia reposo).
   - Incluir `sheetPad` de `4 px` entre celdas para evitar *texture bleeding* en Phaser WebGL.

## 5. Integración en Phaser 3 (`anim-defensas`)
- Registrar las texturas en `ballistaTextures.js` / `Preloader` usando `this.textures.addSpriteSheet(...)` o `this.load.spritesheet(...)`.
- En cada `update()` de la torreta (`towers/Ballista.js` y `back/config/defenses.js`):
  - Calcular el ángulo isométrico hacia el objetivo, cuantizar al múltiplo de `15°` más cercano (`Math.round(deg / 15) % 24`) y asignar `frame = estadoRow * 24 + angleCol`.
  - Sincronizar el cambio de fila `fire` con `fireMs` y emitir los FX (destello, humo, proyectil volante) como sprites o partículas independientes de Phaser.
