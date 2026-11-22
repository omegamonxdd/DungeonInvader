# Generador de arte de la ballesta

`generate.mjs` implementa el pipeline `coc-25d-pipeline` sin dependencias
externas: construye un modelo 3D estilizado (cajas biseladas, tubos, conos y
amarres helicoidales), lo ilumina con clave cálida + relleno frío y lo renderiza
con una cámara **ortográfica isométrica real** (azimut 45°, elevación 30°).

```bash
npm run art:ballista
```

Cada fotograma se renderiza a 1024×1024 (supersampling 4×) con z-buffer y
sombra de contacto; luego se reduce a 256×256 con promediado
alfa-premultiplicado, se añade un contorno de 1 px sobre la silueta y se
escribe PNG RGBA8 con `zlib`. El sombreado se aplica **después** de rotar la
geometría para que la luz sea fija de mundo y no gire con la torreta.

Salidas en `front/assets/estructuras/ballesta/`:

- `ballista-base.png` — pedestal estático + sombra.
- `ballista-head-sheet.png` — hoja canónica de 24 ángulos × 3 estados.
- `ballista-head-g0..g3.png` — la hoja partida en 4 atlas de 6 columnas para
  que ninguna textura supere los 4096 px (los que carga Phaser).
- `ballista-art.json` — anclas, `headLift`, `artScale` y cajas de contenido.

`crop.mjs` es una utilidad de inspección sin dependencias: recorta celdas de
una hoja o compone una cuadrícula de ángulos para revisar el resultado.
`preview.png` y `inspect-grid.png` son las verificaciones visuales del último
horneado.

La rotación de cada frame se resuelve numéricamente para que el eje +X de la
cabeza se proyecte exactamente en el ángulo de pantalla `frame × 15°`, que es
lo que calcula `Ballista.yawToTarget()`. Si cambias la cámara o el modelo,
revisa los valores de `back/config/defenses.js` (`model`, `artScale`) y
actualiza la documentación de `front/assets/estructuras/ballesta/README.md`.
