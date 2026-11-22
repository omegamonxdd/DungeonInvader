# Sprites del lanzadardos (torreta, nivel 1)

Arte 2.5D estilo Clash of Clans horneado desde un **modelo 3D estilizado** con
cámara ortográfica isométrica verdadera (elevación 30°, azimut 45°). No hay
transformaciones 2D en tiempo de ejecución: cada uno de los 24 ángulos es un
render distinto de la geometría. La paleta, el bisel, el grano, la luz y las
anclas son los mismos que los de la ballesta, para que ambas defensas se lean
como un único set.

## Regenerar

```bash
npm run art:turret
```

El generador es `tools/turret-art/generate.mjs`. Renderiza con supersampling 4×
y escribe también `turret-art.json` con las medidas derivadas.

## Archivos

| Archivo | Uso |
|---|---|
| `turret-base.png` | Armazón de madera con cuerdas, apoyado en el suelo, y sombra de contacto. 256×256 RGBA. |
| `turret-head-sheet.png` | Hoja canónica: 24 columnas (15°) × 3 filas (idle, fire, recover). Referencia de arte. |
| `turret-head-g0..g3.png` | La misma hoja repartida en 4 atlas de 6 ángulos × 3 estados. **Estos los carga Phaser.** |
| `turret-art.json` | Medidas del render: `baseGround`, `headPivot`, `headLift`, `artScale`. |

Cada frame mide 256×256 con 4 px de margen transparente por lado (8 px entre
celdas). Los atlas usan `frameWidth/Height = 256`, `margin = 4` y `spacing = 8`.

## Modelo y paleta

- **Chunky**: piezas gruesas y bien asentadas, sin aristas vivas; bisel en
  toda la madera. No hay zócalo de piedra: las zapatas de madera apoyan
  directamente en el suelo.
- **Madera cálida** (`#ec9c58` luz / `#cc7a40` frente / `#9e4e24` sombra),
  idéntica a la ballesta, con vetas sutiles y gradiente vertical.
- **Cuerdas y amarres** con volumen real (`#e4ce9e` / `#b89a68`) enrollados en
  todas las uniones y en el cable de armado.
- **Metal mate** (`#8c8a94` / `#64626c` / `#3e3c46`) reducido a cinchas del
  cañón, eje del tambor y remaches semiesféricos.
- **Dardo rojo** saturado (`#d03024` / `#f65240`) con destello cálido en `fire`.
- Iluminación y contorno de 1 px calculados igual que en la ballesta; sombra de
  contacto `rgba(15, 10, 25, 0.38)` horneada bajo la huella.

## Anclas

| Punto | Posición en el PNG |
|---|---|
| Centro de la huella 2×2 en `base.png` | `(128, 170)` |
| Pivote de la cabeza en cada frame | `(128, 128)` |
| Elevación del pivote sobre el suelo | `56 px` de arte (`1.05 u. × 0.866 × 62`) |
| Escala en el juego | `0.67` px de mundo por px de arte |

`back/config/defenses.js` (constante `TURRET`) y `back/towers/DartTurret.js`
consumen esos números. `DartTurret.yawToTarget()` cuantiza a `round(deg/15)%24`
y selecciona atlas/frame igual que la ballesta.

## Boca de disparo

El fogón del estado `fire` está en `[1.10, 0, 0.47]` unidades del modelo
(`fx`, `barrelZ` en `tools/turret-art/generate.mjs`). `back/systems/muzzle.js`
lo gira con `yawDegPerFrame` y lo convierte a coordenadas de casilla: el dardo
sale por la boca del cañón, no del centro de la huella.
