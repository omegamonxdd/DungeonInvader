# `front/assets/` — Recursos visuales

| Ruta | Contenido | Uso |
|---|---|---|
| `estructuras/ballesta/ballista-base.png` | Pedestal + sombra, 256×256 RGBA | `back/assets/index.js` → textura `ballista-base` |
| `estructuras/ballesta/ballista-head-g0..g3.png` | 4 atlas de 6 ángulos × 3 estados | `BootScene` los registra como spritesheets `ballista-head-0..3` |
| `estructuras/ballesta/ballista-head-sheet.png` | Hoja canónica de 24×3 | Referencia de arte; no se carga en runtime |
| `estructuras/ballesta/ballista-art.json` | Anclas y medidas del render | Documentación del generador |
| `estructuras/ballesta/README.md` | Modelo, paleta y convenciones | Referencia de arte |
| `estructuras/ballesta/ballista-nivel1.png` | Sprite legacy 384×448 | Solo histórico; ya no se importa |
| `estructuras/catapulta/catapult-base.png` | Armazón de madera apoyado en el suelo + sombra (sin zócalo de piedra), 256×256 RGBA | `back/assets/index.js` → textura `catapult-base` |
| `estructuras/catapulta/catapult-head-g0..g3.png` | 4 atlas de 6 ángulos × 3 estados | `BootScene` los registra como spritesheets `catapult-head-0..3` |
| `estructuras/catapulta/catapult-head-sheet.png` | Hoja canónica de 24×3 | Referencia de arte; no se carga en runtime |
| `estructuras/catapulta/catapult-art.json` | Anclas y medidas del render | Documentación del generador |
| `estructuras/catapulta/README.md` | Modelo, paleta y convenciones | Referencia de arte |
| `estructuras/nucleo/core.png` | Núcleo 2.5D: plataforma, 4 pilares agrietados y cristal cian, 384×384 RGBA | `back/assets/index.js` → textura `core` |
| `estructuras/nucleo/core-glow.png` | Resplandor cian 256×256 RGBA | `BootScene` → textura `core-glow` (alfa animada en `CoreView`) |
| `estructuras/nucleo/core-art.json` | Ancla, escala y medidas del render | Documentación del generador |

Las imágenes se generan con `npm run art:ballista`, `npm run art:turret`,
`npm run art:catapult` y `npm run art:core` (`tools/*-art/generate.mjs`) desde
modelos 3D con cámara isométrica real. No hay fuentes sueltas:
`front/css/tokens/05-fuentes.css` las incrusta en base64. El terreno (incluida
la huella de mazmorra del núcleo), la entrada, las tropas, los topos y las
estructuras genéricas se generan en memoria desde código en `back/`.
