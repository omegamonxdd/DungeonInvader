# Sprites de la catapulta (nivel 1)

Arte 2.5D estilo Clash of Clans horneado desde un **modelo 3D estilizado** con
cámara ortográfica isométrica verdadera (elevación 30°, azimut 45°). No hay
transformaciones 2D en tiempo de ejecución: cada uno de los 24 ángulos es un
render distinto de la geometría. La paleta, el bisel, el grano, la luz y las
anclas son los mismos que los de la ballesta y el lanzadardos, para que las tres
defensas se lean como un único set.

## Regenerar

```bash
npm run art:catapult
```

El generador es `tools/catapult-art/generate.mjs`. Renderiza con supersampling 4×
y escribe también `catapult-art.json` con las medidas derivadas.

## Archivos

| Archivo | Uso |
|---|---|
| `catapult-base.png` | Armazón de madera con cuerdas apoyado directamente en el suelo + sombra de contacto (sin zócalo de piedra). 256×256 RGBA. |
| `catapult-head-sheet.png` | Hoja canónica: 24 columnas (15°) × 3 filas (idle, fire, recover). Referencia de arte. |
| `catapult-head-g0..g3.png` | La misma hoja repartida en 4 atlas de 6 ángulos × 3 estados. **Estos los carga Phaser.** |
| `catapult-art.json` | Medidas del render: `baseGround`, `headPivot`, `headLift`, `artScale`. |

Cada frame mide 256×256 con 4 px de margen transparente por lado (8 px entre
celdas). Los atlas usan `frameWidth/Height = 256`, `margin = 4` y `spacing = 8`.

## Modelo y paleta

- **Chunky**: piezas gruesas y bien asentadas, sin aristas vivas; bisel en
  toda la madera. El armazón apoya directamente en el suelo con cuatro zapatas
  de madera, sin zócalo de piedra, igual que la ballesta y el lanzadardos.
- **Madera cálida** (`#ec9c58` luz / `#cc7a40` frente / `#9e4e24` sombra),
  idéntica a la ballesta, con vetas sutiles y gradiente vertical.
- **Cuerdas y amarres** con volumen real (`#e4ce9e` / `#b89a68`) enrollados en
  todas las uniones, el brazo, el cazo, el contrapeso y el cable de armado.
- **Roca gris** de la misma familia que el mapa/zócalo del núcleo: bloques del
  zócalo, contrapeso facetado en el brazo corto y proyectil dentro del cazo.
- **Metal mate** (`#8c8a94` / `#64626c` / `#3e3c46`) solo en casquillos del
  eje, manivela y remaches semiesféricos.
- Iluminación y contorno de 1 px calculados igual que en la ballesta; sombra de
  contacto horneada bajo la huella.

## Anclas

| Punto | Posición en el PNG |
|---|---|
| Centro de la huella 2×2 en `base.png` | `(128, 170)` |
| Pivote de la cabeza en cada frame | `(128, 128)` |
| Elevación del pivote sobre el suelo | `61 px` de arte (`1.14 u. × 0.866 × 62`, sin zócalo de piedra) |
| Escala en el juego | `0.67` px de mundo por px de arte |

`back/config/defenses.js` (constante `CATAPULT`) y `back/towers/Catapult.js`
consumen esos números. `Catapult.yawToTarget()` cuantiza a `round(deg/15)%24` y
selecciona atlas/frame igual que la ballesta.

## Boca de disparo

La roca sale del cazo en el instante del lanzamiento (`state === 1`, brazo a
~112°): `[0.37, 0, 1.80]` unidades del modelo. `back/systems/muzzle.js` lo gira
con `yawDegPerFrame` y lo convierte a coordenadas de casilla. El tiro es
balístico (punto de suelo fijo, dispersión y fallo, sin seguimiento), como un
mortero de Clash of Clans: puede fallar y las tropas pueden esquivarlo.
