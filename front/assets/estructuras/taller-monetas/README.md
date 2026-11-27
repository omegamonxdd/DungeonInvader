# Taller de monedas — edificio 2.5D estático

Modelo sin rotación horneado con `npm run art:workshop`
(`tools/workshop-art/generate.mjs`), siguiendo el pipeline `coc-25d-pipeline`:
geometría 3D estilizada, cámara ortográfica isométrica (azimut 45°, elevación
30°), supersampling 4×, biseles, grano de madera, amarres con volumen y salida
PNG RGBA de 256×256. Misma paleta, luz y contorno que defensas, núcleo y
almacenes. La huella del modelo cabe dentro de la casilla 2×2 del edificio.

## Modelo
- **Taller de madera pequeño** con tablas vistas y armazón de carpintería en las
  esquinas (postes, zócalo y cartabones diagonales), en lugar de los amarres
  helicoidales que usan las defensas.
- **Techo a dos aguas** con caballete sobre el eje Y, aleros gruesos y
  frontón triangular sobre la puerta.
- **Letrero colgado** con una moneda de latón sobre la puerta.
- **Tocón para cortar leña** fuera del edificio, con hachuela y troncos cortados.

## Convenciones
| Archivo | Uso |
|---|---|
| `workshop.png` | Textura `workshop`, dibujada por `StructureView` |
| `workshop-art.json` | `cell`, `artScale`, `anchor` y `bbox` derivados del render |

Como en los almacenes, el suelo de roca compartido lo dibuja Phaser con
`makeDungeonRockTexture()`; la sombra de contacto sí va horneada en el PNG.
