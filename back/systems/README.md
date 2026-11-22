# `back/systems/` — Lógica del juego

Toda la lógica interna, independiente de Phaser y de la DOM salvo los puentes
indicados. Agrupados por responsabilidad:

**Mundo y geometría**
- `iso.js` — proyección isométrica (`iso()`). Los antiguos `project()`, `tileDiamond()` y `screenToCell()` no tenían consumidores y se eliminaron.
- `muzzle.js` — boca de disparo de ballesta/lanzadardos/catapulta: convierte el punto 3D del modelo (cañón, arco o cazo) y el ángulo real del frame a coordenadas de mundo, para que el proyectil nazca donde el arte dibuja el fogonazo.
- `map.js` — celdas `EMPTY/DIRT/CORE`, mapa 41×41, zona despejada, núcleo y entrada.
- `TerrainState.js` — cupo de excavación, celdas ocupadas y BFS entrada→núcleo.
- `picking.js` — `pickCell()`, siluetas y selección por huella.
- `rangeRing.js` — anillos de alcance isométricos; con radio interior deja sin
  teñir la zona muerta de la catapulta (se usa al seleccionar y al mover).
  El trazo es un camino cerrado (`closePath()`) y el relleno del anillo se
  hace con una tira de cuadrisláteros: no queda abertura en la unión ni
  rendija radial en la costura del agujero.

**Cámara e interacción**
- `CameraController.js` — zoom centrado en cursor, WASD, arrastre y límites.
- `InteractionController.js` — enrutamiento de puntero/teclado y prioridad de Escape.
- `MoveController.js` — modo Mover con copia flotante, huella verde/roja y `canCommit`.
- `keyboard.js` — normalización de atajos (con y sin `event.code`).
- `ShortcutController.js` — 19 acciones reasignables (Mejoras = Alt izquierdo) y detección de solapes. Con el menú Construir abierto solo mandan los atajos del menú y E para cerrarlo.

**Economía y progreso**
- `Resources.js` — monedas/cristales vivos, `canAfford`, `pay()` atómico y capacidad.
- `WorkController.js` — obras `build`/`upgrade` con `Date.now()`, bloqueos y subida de nivel; calcula los edificios que faltan para mejorar el núcleo (`missingBuildings()`) y los que se desbloquean con el siguiente nivel (`unlockingBuildings()`).
- `Army.js` — invocar, criar, mutar, espacio de tropas y `snapshot()`.
- `ProductionController.js` — mina/taller con producción pasiva y recolección.
- `structureSpecs.js` / `StructureFactory.js` — catálogo común y creación de estructuras.

**Herramientas de diseño**
- `EditorController.js` — retirar/recoger, guardados, vista invasor y validación de camino.
- `TopoController.js` — topos que trabajan en obras y se pausan en editor/invasción.

**Generación de texturas**
- `textures.js` — teselas de suelo de mazmorra (ladrillo), piedra excavada y huella del núcleo, horneadas en Canvas.
- `defenseTextures.js` — **implementación compartida** de las tres defensas: piedra de mazmorra de la huella (`makeDungeonRockTexture`, semilla fija, 2×), filtro según zoom y `createDefenseTextures(config, keys)` que devuelve claves de atlas, índices de frame y comprobación de preload.
- `ballistaTextures.js`, `turretTextures.js`, `catapultTextures.js` — envoltorios delgados: cada uno define sus claves (`ballista-head-`, `turret-head-`, `catapult-head-`, etc.) y reexpone los helpers con los nombres que ya consumen `BootScene` y `back/towers/`. Antes cada módulo triplicaba la lógica de atlas y de roca.
