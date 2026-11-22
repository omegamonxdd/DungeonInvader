# Sprites de la ballesta

Arte 2.5D estilo Clash of Clans horneado desde un **modelo 3D estilizado** con
cámara ortográfica isométrica verdadera (elevación 30°, azimut 45°). No hay
transformaciones 2D en tiempo de ejecución: cada uno de los 24 ángulos es un
render distinto de la geometría.

## Regenerar

```bash
npm run art:ballista
```

El generador es `tools/ballista-art/generate.mjs`. Renderiza con
supersampling 4× y escribe también `ballista-art.json` con las medidas
derivadas (anclas, elevación del pivote, escala recomendada).

## Archivos

| Archivo | Uso |
|---|---|
| `ballista-base.png` | Pedestal/trípode estático + sombra de contacto. 256×256 RGBA. |
| `ballista-head-sheet.png` | Hoja canónica: 24 columnas (15°) × 3 filas (idle, fire, recover). Referencia de arte. |
| `ballista-head-g0..g3.png` | La misma hoja repartida en 4 atlas de 6 ángulos × 3 estados. **Estos los carga Phaser.** |
| `ballista-art.json` | Medidas del render: `baseGround`, `headPivot`, `headLift`, `artScale`. |
| `ballista-nivel1.png` | Sprite legacy 384×448; se conserva solo como referencia histórica. |

Cada frame mide 256×256 con 4 px de margen transparente por lado (8 px entre
celdas). Los atlas de Phaser usan `frameWidth/Height = 256`, `margin = 4` y
`spacing = 8` para recortar ese margen.

## Modelo y paleta

- Proporciones **chunky**: madera naranja cálida (`#ec9c58` luz, `#cc7a40`
  frente, `#9e4e24` sombra) con bisel obligatorio en todas las aristas.
- Metal mate satinado (`#8c8a94` / `#64626c` / `#3e3c46`) en abrazadera, placa
  giratoria y remaches semiesféricos.
- Cuerdas y amarres con volumen real (`#e4ce9e` / `#b89a68`): arco, tensores y
  enrollados en las uniones del trípode.
- Acentos rojos saturados (`#d03024` / `#f65240`) en la punta y el emplumado
  de la saeta; destello cálido en `fire`.
- Iluminación: clave cálida arriba-izquierda + relleno frío desde la derecha,
  oclusión ambiental en rincones y contorno oscuro de 1 px calculado tras el
  *downsample* (no ensucia las caras interiores).
- Sombra de contacto `rgba(15, 10, 25, 0.38)` horneada bajo la huella.

## Anclas (importante si se cambia el modelo)

| Punto | Posición en el PNG |
|---|---|
| Centro de la huella 2×2 en `base.png` | `(128, 170)` |
| Pivote de la cabeza en cada frame | `(128, 128)` |
| Elevación del pivote sobre el suelo | `83 px` de arte (`1.55 u. × 0.866 × 62`) |
| Escala en el juego | `0.67` px de mundo por px de arte |

`back/config/defenses.js` y `back/towers/Ballista.js` consumen esos números.
`Ballista.yawToTarget()` cuantiza el ángulo de pantalla a `round(deg / 15) % 24`
y `headGroup()/headFrame()` seleccionan atlas y frame.
