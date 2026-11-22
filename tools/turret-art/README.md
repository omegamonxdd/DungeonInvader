# Generador de arte del lanzadardos

Hornea el modelo 3D estilizado de la torreta lanza dardos con una cámara
ortográfica isométrica real (elevación 30°, azimut 45°). Es el mismo pipeline
que `tools/ballista-art/`: no hay rotaciones 2D en tiempo de ejecución, cada
ángulo es un render distinto de la geometría.

```bash
npm run art:turret
```

## Modelo

- **Sin piedra**: se eliminó el zócalo de tres hiladas y las claves de los
  postes; el armazón baja 0.5 u. y apoya directamente en el suelo.
- **Madera**: postes convergentes, zapatas, travesaños, cartelas diagonales,
  cureña, yugo, cañón tubular con ánima oscura, tambor de armado y manivela.
  Todo con bisel obligatorio, veta procedural y las mismas tres tonalidades
  cálidas que la ballesta (`#ec9c58` luz / `#cc7a40` frente / `#9e4e24` sombra).
- **Cuerda**: enrollada con volumen real en tobillo, travesaños, plato
  giratorio, cureña, cañón y tambor; cable de armado tenso/suelto según estado.
- **Detalles**: cinchas y remaches de metal mate (acabado idéntico al de la
  ballesta) y dardo rojo saliente con emplumado, destello cálido al disparar.

La luz es fija de mundo (clave cálida arriba-izquierda + relleno frío derecha),
la oclusión ambiental oscurece las uniones y la sombra de contacto se hornea
bajo la huella. Paleta, iluminación, `.blend`, contorno y PNG son exactamente
los del generador de la ballesta, de modo que ambas defensas comparten set.

## Salida

En `front/assets/estructuras/lanzadardos/`:

| Archivo | Uso |
|---|---|
| `turret-base.png` | Armazón de madera a ras de suelo + sombra. 256×256 RGBA. |
| `turret-head-sheet.png` | Hoja canónica 24 ángulos × 3 estados (referencia). |
| `turret-head-g0..g3.png` | 4 atlas de 6 ángulos × 3 estados: los carga Phaser. |
| `turret-art.json` | Anclas, `headLift`, escala y cajas de cada render. |

En esta carpeta se guarda además `preview.png` (base + cabeza a 330°) para
comparar de un vistazo con `tools/ballista-art/preview.png`.

## Anclas (idénticas a la ballesta)

- Huella 2×2 centrada en `(128, 170)` dentro de `turret-base.png`.
- Pivote de la cabeza en `(128, 128)` de cada frame.
- Elevación del pivote: `56 px` de arte (`1.05 u. × 0.866 × 62`).
- Escala en juego: `0.67` px de mundo por px de arte.

Solo se genera el **nivel 1**: los niveles superiores del lanzadardos reutilizan
estos frames hasta que se horneen variantes específicas.
