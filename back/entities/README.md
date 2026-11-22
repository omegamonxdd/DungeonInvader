# `back/entities/` — Vistas de la escena

Cada archivo crea los objetos Phaser que representan una parte del mundo. La
lógica que los decide vive en `../systems/` y `../scenes/MainScene.js`.

| Archivo | Contenido |
|---|---|
| `TerrainView.js` | Una imagen por casilla (1691), profundidad `x+y`, caras laterales y `refresh()` al excavar/rellenar |
| `CoreView.js` | Sprite 2.5D del núcleo (pilares de piedra + cristal cian) sobre la huella 3×3, con resplandor pulsante |
| `EntranceView.js` | Soportes de madera de la entrada con Graphics nítidos |
| `StructureView.js` | Vista 2.5D genérica de todas las estructuras (suelo, sombra, burbuja y estados de flotar/obrar/destruir) |
| `InteractionView.js` | Resaltados de selección, hover, herramienta y anillo de alcance |
| `WorkView.js` | Andamios, cimientos que crecen, barra de progreso y tiempo restante |
| `topoArt.js` | Texturas pixeladas de los topos, horneadas en Canvas |
| `TopoView.js` | Sprites y animación de los topos |

La ballesta, el lanzadardos y el núcleo usan arte 2.5D horneado offline desde
modelos 3D (`tools/ballista-art/`, `tools/turret-art/` y `tools/core-art/`);
las dos defensas conservan su clase en `../towers/` y el núcleo su vista
dedicada en este directorio. `StructureView` mantiene el dibujo del
lanzadardos solo como referencia histórica: ya no se usa en el juego.
