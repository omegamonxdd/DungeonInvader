# Almacén de cristales — cubeta 2.5D

Modelo estático (sin rotación) horneado con `npm run art:vault`
(`tools/vault-art/generate.mjs`), siguiendo el pipeline `coc-25d-pipeline`:
geometría 3D estilizada, cámara ortográfica isométrica (azimut 45°, elevación
30°), supersampling 4× y salida PNG RGBA de 256×256.

## Modelo
- **Cubo de madera abierto** (cubeta): fondo oscuro, cuatro paredes gruesas y
  borde de boca bien marcado para que se lea el interior.
- **Uniones de cuerda** helicoidales con volumen real en las cuatro esquinas y
  dos vueltas que rodean la cubeta, con nudos de remate.
- Los **minerales van dentro de la cubeta**: sus bases quedan ocultas entre las
  paredes y solo asoman las puntas de los cristales cian.

## Convenciones
| Archivo | Uso |
|---|---|
| `vault-crystals.png` | Textura `vault-crystals`, dibujada por `StructureView` |
| `vault-art.json` | `cell`, `artScale`, `anchor` y `bbox` derivados del render |

El suelo de roca compartido no va en el PNG: lo dibuja Phaser con
`makeDungeonRockTexture()` (`back/systems/defenseTextures.js`), igual que el
resto de edificios. La sombra de contacto sí está horneada en la imagen.
