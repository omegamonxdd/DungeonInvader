# Generador de arte de la catapulta

Hornea el modelo 3D estilizado de la catapulta con una cámara ortográfica
isométrica real (elevación 30°, azimut 45°). Es el mismo pipeline que
`tools/ballista-art/` y `tools/turret-art/`: no hay rotaciones 2D en tiempo de
ejecución, cada ángulo es un render distinto de la geometría.

```bash
npm run art:catapult
```

## Modelo

Tercer hermano del set, con las mismas anclas, biseles, grano y luz de mundo:

- **Roca**: solo el contrapeso facetado en el brazo corto y el proyectil en el
  cazo. Mismo moteado que la piedra del núcleo/mapa. El armazón apoya
  directamente en el suelo, sin zócalo de piedra.
- **Madera**: cuatro postes convergentes con zapata, travesaños, cartelas,
  plato giratorio, cureña, caballete del eje, brazo de tiro y cazo con paredes.
  Todo con bisel obligatorio y las tres tonalidades cálidas de la ballesta
  (`#ec9c58` luz / `#cc7a40` frente / `#9e4e24` sombra).
- **Cuerda**: enrollada con volumen real en tobillos, travesaños, plato,
  eje, brazo, cazo, contrapeso y tambor de armado; dos hebras tensas unen el
  tambor con el brazo y cambian con el estado.
- **Estados**: `idle` (brazo cargado con la roca en el cazo), `fire` (brazo
  lanzado hacia delante/arriba, cazo vacío) y `recover` (retorno a medias).
  La cabeza gira en Z para los 24 ángulos y el brazo balancea en Y.

La luz es fija de mundo (clave cálida arriba-izquierda + relleno frío derecha),
la oclusión ambiental oscurece las uniones y la sombra de contacto se hornea
bajo la huella. Paleta, iluminación, contorno y PNG son exactamente los de los
generadores de la ballesta y el lanzadardos, de modo que las tres defensas
comparten set.

## Salida

En `front/assets/estructuras/catapulta/`:

| Archivo | Uso |
|---|---|
| `catapult-base.png` | Armazón de madera apoyado en el suelo + sombra. 256×256 RGBA. |
| `catapult-head-sheet.png` | Hoja canónica 24 ángulos × 3 estados (referencia). |
| `catapult-head-g0..g3.png` | 4 atlas de 6 ángulos × 3 estados: los carga Phaser. |
| `catapult-art.json` | Anclas, `headLift`, escala y cajas de cada render. |

En esta carpeta se guardan además `preview.png` (base + cabeza a 330°) e
`inspect-grid.png` (muestra de ángulos/estados) para comparar de un vistazo
con las otras defensas.

## Anclas (idénticas a la ballesta y el lanzadardos)

- Huella 2×2 centrada en `(128, 170)` dentro de `catapult-base.png`.
- Pivote de la cabeza en `(128, 128)` de cada frame.
- Elevación del pivote: `61 px` de arte (`1.14 u. × 0.866 × 62`; sin el zócalo
  de piedra que había bajo el armazón).
- Escala en juego: `0.67` px de mundo por px de arte.

Solo se genera el **nivel 1**: los niveles superiores de la catapulta reutilizan
estos frames hasta que se horneen variantes específicas.
