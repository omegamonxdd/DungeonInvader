# Almacén de monedas — caja fuerte 2.5D

Modelo estático (sin rotación) horneado con `npm run art:vault`
(`tools/vault-art/generate.mjs`), siguiendo el pipeline `coc-25d-pipeline`:
geometría 3D estilizada, cámara ortográfica isométrica (azimut 45°, elevación
30°), supersampling 4× y salida PNG RGBA de 256×256.

## Modelo
- Cuerpo **negro** compacto con biseles gruesos y zócalo de acero oscuro.
- Puerta con marco y panel **grises**, remaches y dial con pequeño cubo de latón.
- **Uniones de cuerda** helicoidales con volumen real en las cuatro esquinas.
- Una **cuerda que ciñe todo el alrededor** a dos alturas, más otra cruzada
  sobre la tapa y nudos de remate en la cara frontal.

## Convenciones
| Archivo | Uso |
|---|---|
| `vault-coins.png` | Textura `vault-coins`, dibujada por `StructureView` |
| `vault-art.json` | `cell`, `artScale`, `anchor` y `bbox` derivados del render |

El suelo de roca compartido no va en el PNG: lo dibuja Phaser con
`makeDungeonRockTexture()` (`back/systems/defenseTextures.js`), igual que el
resto de edificios. La sombra de contacto sí está horneada en la imagen.
