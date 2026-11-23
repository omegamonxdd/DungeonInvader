# Dungeon Build — Readme del proyecto (prototipo 2)

> Contexto completo del juego, del legacy exportado y de la migración a Phaser 3.
> Todo el texto del proyecto está en español. Sirve para onboarding y para pegar
> al inicio de una conversación con una IA.

---

## 0. Arranque rápido

```bash
npm install       # solo la primera vez
npm run dev       # http://127.0.0.1:5173/
npm run build     # build estático en dist/
npm run preview   # sirve el build
```

- El proyecto arranca **desde la raíz**: `index.html`, `vite.config.js` y
  `package.json` están aquí.
- El juego legacy ya no está en el repo: se exportó íntegro a
  **`C:\Users\omegamon\Desktop\DungeonBuild-Legacy`** y se abre con doble clic
  (`file://`). Ver [§4](#4-el-legacy-exportado).
- La migración a Phaser está **terminada** (fases 1–11). Ver [§3](#3-estado-de-la-migración).
- Al abrir en el navegador aparece una **pantalla de carga** temática antes del
  bundle: muestra el progreso real de los assets y se retira al entrar en
  `MainScene`. Ver [§12](#12-interfaz).

---

## 1. Qué es

Juego de **construcción de mazmorra + simulador de invasión**, en vista
**isométrica** y estilo **pixel art**.

- El jugador excava y rellena tierra en un mapa de **41×41**, coloca edificios
  (defensas, recursos, militares, estandartes, trampas), invoca/cría tropas y
  las manda a **invadir su propia base** como simulación (RTS básico). Al terminar
  la invasión la base vuelve intacta.
- Legacy: **HTML + CSS + JavaScript puro**, sin librerías, sin bundler, sin
  servidor. Migración: **Phaser 3 + Vite + ES modules**.
- La UI (menús, HUD, ventanas) es DOM + CSS en ambos; Phaser dibuja únicamente
  la escena del juego.
- No hay persistencia: al recargar todo vuelve al estado inicial (incluidos los
  atajos de teclado y los guardados del editor).
- Los archivos están en UTF-8 limpio. **Al editar, conservar UTF-8.**

---

## 2. Estructura actual del proyecto

```
Prototipo2/                         ← raíz: lo necesario para arrancar
  index.html                       Entrada de Vite (antes: HTML del legacy)
  package.json / package-lock.json phaser 3.90.0 + vite 8.3.8
  vite.config.js                   root=".", alias @ → ./back, outDir dist/
  .gitignore
  Readme.md                        Este documento
  dist/                            Build generado (ignorado por Git)
  node_modules/
  front/                           ← TODO LO VISUAL
    README.md
    css/                           22 hojas del legacy + ui.css (entrada)
      tokens/ base/ hud/ menus/ modales/ invasion/ 99-responsive.css
    loading/
      splash.js                    Progreso/error/fin de la pantalla de carga
    assets/
      estructuras/ballesta/ballista-base.png
      estructuras/ballesta/ballista-head-g0..g3.png
      estructuras/ballesta/ballista-head-sheet.png
      estructuras/ballesta/ballista-art.json
      estructuras/ballesta/README.md
      estructuras/lanzadardos/turret-base.png
      estructuras/lanzadardos/turret-head-g0..g3.png
      estructuras/lanzadardos/turret-head-sheet.png
      estructuras/lanzadardos/turret-art.json
      estructuras/lanzadardos/README.md
      estructuras/nucleo/core.png
      estructuras/nucleo/core-glow.png
      estructuras/nucleo/core-art.json
  back/                            ← TODO EL CÓDIGO INTERNO
    README.md
    main.js                        Punto de entrada de la app
    assets/                        Importación de los sprites 2.5D
    balance/                       ÚNICA fuente de números (01…09 + index + README)
    config/ scenes/ systems/ entities/ towers/ enemies/ ui/
      scenes/                      BootScene conecta el progreso de carga
      systems/                     defenseTextures.js: atlas y roca compartidos
      towers/                      DefenseTower.js: base de las 3 defensas
  tools/                           Generadores de arte (no necesarios para arrancar)
```

Cada carpeta importante tiene un `README.md` con su contenido. Las carpetas
`front/`, `front/css/`, `front/assets/` y todas las de `back/` lo tienen.

**El legacy ya no está en el árbol de build.** Sus archivos (`index.html`,
`css/`, `js/`) se exportaron a `C:\Users\omegamon\Desktop\DungeonBuild-Legacy`.
Las hojas CSS que usaba la app se copiaron a `front/css/` y los sprites de la
ballesta viven en `front/assets/`; por eso la app funciona sin la copia exportada.

---

## 3. Estado de la migración

**Fases 1–11 cerradas.** No queda ninguna fase de port pendiente. La verificación
final encontró dos detalles que se cerraron antes de dar el traspaso por terminado:

- **Araña madre:** ahora suelta crías por daño y al morir (`spawnBabies()`), y
  las crías van solas a la estructura alcanzable más cercana
  (`assignSummonedTarget()`), como en el legacy `19b-aranas.js`.
- **Electrostal:** respeta `cooldown` (0 = una descarga por invasión, > 0 =
  repetible) y encadena usando `chain`, `targets` y `chainMs` del balance.

Los trabajos futuros son ajustes de balance y pruebas de regresión.

| Fase | Estado | Resultado |
|---|---|---|
| 1. Análisis | ✅ | Inventario del legacy y comparación visual |
| 2. Configuración | ✅ | Vite + Phaser + ES modules + separación raíz/front/back |
| 3. Mundo y cámara | ✅ | Mapa 41×41, terreno isométrico, núcleo, entrada, zoom/paneo |
| 4. Primera estructura | ✅ | Ballesta real: pedestal fijo, 24 ángulos × 3 estados |
| 5. Interactividad | ✅ | Selección, excavar/rellenar, modo Mover, rotación y animación |
| 6. Pruebas y rendimiento | ✅ | Build correcto, consola limpia, perfil CPU, ballesta huérfana corregida |
| 7. Interfaz DOM/CSS | ✅ | Menú Construir, barra de acciones, HUD y ventana Información/Mejorar |
| 8. Combate / oleadas | ✅ | Tropas, pathfinding 8-dir, saetas, oleadas y victoria/derrota |
| 9. Obras y mejoras reales | ✅ | Recursos vivos, temporizadores, andamios, cobros y desbloqueos |
| 10. Estructuras y tropas completas | ✅ | 15 ranuras, vista genérica, fábrica, ejército, producción, trampas y crías de araña |
| 11. Editor y atajos | ✅ | 19 atajos reasignables, editor con guardados y topos animados |

### 3.1 Verificación acumulada

- `npm run build`: correcto. 94 módulos; único aviso esperado de chunk >500 kB
  por el propio Phaser. Última salida tras la reorganización: `dist/index.html`
  15.69 kB, CSS 58.32 kB, JS 1.398,93 kB (gzip 382,33 kB) y PNG 11.17 kB;
  `built in 4.00s`. El HTML crece por el CSS crítico inline de la pantalla de
  carga; el JS baja al unificar las 3 defensas y sus texturas.
- Consola: 0 errores y 0 warnings tras construir, mover, invocar, simular
  invasiones, editar y reasignar atajos.
- Escena: 1691 objetos y 78 texturas estables, sin fugas. `MainScene.update`
  apenas 6,7 ms acumulados en el perfil CPU; hilo principal ~89 % idle.
  Nota: esa medición es anterior al cierre de las crías de araña y al electrostal
  repetible; el build posterior sigue correcto.
- Regresiones comprobadas: excavar/rellenar con cupo y BFS; mover ballesta con
  liberación de huella y redibujo de suelo/sombra; alta y cancelación sin
  objetos huérfanos; aim y disparo; cámara (rueda y doble clic); obras con
  cobro y subida de nivel; invasión con base intacta al volver; editor con
  restauración al salir sin guardar.
- Correcciones relevantes: ballesta huérfana al repetir el atajo de creación
  justo después de mover (Fase 6) y suelo/sombra de la ballesta al terminar un
  movimiento (Fase 10).

### 3.2 Cómo editar el balance de la app

```
back/balance/
  01-mundo-y-nucleo.js   Mapa, escala, núcleo, entrada, recursos, cámara, topos
  02-estructuras.js      Límites por núcleo, techos y maxNivel
  03-costes.js           Construcción y mejoras
  04-obras.js            Constructores, tiempos y escalaTiempo
  05-edificios.js        Vida, tamaño, capacidad y producción
  06-defensas.js         Ballesta, torreta, catapulta, proyectiles
  07-trampas.js          Bomba, electrostal, rocas
  08-tropas.js           Todas las tropas y laboratorio
  09-invasion.js         Reloj, cola, rally y ejército de prueba
  index.js               Agregador BALANCE + helpers + report()
  README.md              Guía rápida (no modificar el resto de la carpeta)
```

```js
import { BALANCE, defensaAt, buildCost } from '../balance/index.js';

defensaAt('ballista', 1);  // { hp, dps, range, cooldown, damage, size, height }
buildCost('ballista');     // { coins: 200 }
```

En consola (`npm run dev`):

```js
__DUNGEON_BALANCE__                       // todos los datos
__DUNGEON_BALANCE__.report()              // avisos de tiempos/tablas
__DUNGEON_BALANCE__.obras.escalaTiempo = 0.05  // solo para pruebas, volver a 1
```

Reglas: editar solo las tablas `01…09`; `index.js` es el agregador.
`config/defenses.js` conserva las medidas del sprite (arte, no balance).

### 3.3 Estructura de `back/`

```
assets/    importación del sprite existente
balance/   números ajustables + helpers
config/    gameConfig, world, palette, defenses, interaction
scenes/    BootScene, MainScene
systems/   iso, map, textures, ballistaTextures, cámara, picking, terreno,
           movimiento, atajos, recursos, obras, ejército, producción, editor, topos
entities/  terreno, núcleo, entrada, interacción, andamios, vistas genéricas, topos
towers/    Ballista
enemies/   pathfinding, tropas, proyectiles, defensores e invasión
ui/        puente DOM/escena: InterfaceController, ShortcutsUI, buildIcons
```

---

## 4. Diferencias entre el legacy y el traspaso a Phaser

| Aspecto | Legacy (exportado al escritorio) | App Phaser (este repo) |
|---|---|---|
| **Ubicación** | `C:\Users\omegamon\Desktop\DungeonBuild-Legacy` | Raíz del proyecto, con `front/` y `back/` |
| **Arranque** | Doble clic en `index.html`, protocolo `file://` | `npm run dev` (Vite, `http://127.0.0.1:5173/`) o `npm run build` → `dist/` |
| **Módulos** | 45 `<script>` globales en orden crítico + `'use strict'`; sin `fetch` | 62 ES modules con `import`/`export`; un único `<script type="module">` |
| **Render** | Un `<canvas id="game">` 2D; `render()` recorre las 41×41 casillas y pinta suelo → edificio → bloque | Phaser dibuja la escena con sprites y texturas horneadas; el DOM sigueBeing la UI |
| **Escena** | Funciones sueltas en `js/world/`, `js/buildings/`, `js/invasion/` | `BootScene` + `MainScene`; `update()` coordina cámara, invasión, obras, topos y producción |
| **Cámara** | Objeto `{x, y, zoom}` y `stepCamera()` propios | `CameraController` sobre `Phaser.Cameras`; mismos gestos (WASD, rueda, arrastre, doble clic) |
| **Ballesta** | PNG real + composición en memoria con `rotate()`; trípode redibujado | Modelo 3D → 4 atlas de 6 ángulos × 3 estados (24 en total) + pedestal; sin `rotate()` en render |
| **Terreno** | Dibujo directo con `imageSmoothingEnabled` según zoom | Texturas a 2×/3× con filtrado LINEAR/NEAREST según zoom |
| **Física** | Ninguna | Arcade Physics configurada, reservada para proyectiles/efectos; la cuadrícula sigue siendo lógica propia |
| **HTML** | 22 `<link>` CSS + 45 `<script>` en un `index.html` de 20 kB | Un `index.html` en la raíz con un solo entry; el bundle JS y CSS lo genera Vite |
| **CSS** | `css/` (22 hojas) | Copia íntegra en `front/css/`; `ui.css` las importa en el orden de la migración |
| **Balance** | `js/balance/` con global `BALANCE` + `99-compat.js` (nombres históricos) | `back/balance/` con ES modules + `index.js` (helpers y `report()`) |
| **Estado** | Variables globales (`monedas_actuales`, `state.*`) | Controladores: `Resources`, `WorkController`, `Army`, `TerrainState`, `InvasionController`… |
| **Daño de invasión** | Simulación con `invasion.*` y estructuras target | `invasion.siege` exclusivamente; `state.hp` nunca se toca, base intacta al volver |
| **Araña madre** | `19b-aranas.js`: 1 cría por cada 50 HP perdidos, el resto al morir; crías no seleccionables | `Troop.takeDamage()` + `InvasionController.spawnBabies()/assignSummonedTarget()`; mismo comportamiento |
| **Electrostal** | Descarga en cadena; `cooldown 0` = una vez, `>0` = repetible | `stepTraps()` usa `cooldown`, `chain`, `targets` y `chainMs` de `balance/07` |
| **Atajos** | `js/ui/23-atajos.js`, globals y `event.code` | `ShortcutController` + `ShortcutsUI`, 19 acciones (Mejoras = Alt izq.), solapes y `keyboard.js` |
| **Assets** | `css/estructuras/ballesta/ballista-nivel1.png` | `front/assets/estructuras/ballesta/` (generado con `npm run art:ballista`; importado desde `back/assets/`) |
| **Barras de estadísticas** | En Info/Mejorar: barra de avance al nivel máximo y tramo parpadeante del siguiente nivel | Mismo detalle estético en `statsFor()`/`renderStat()` de `back/ui/InterfaceController.js`; CSS ya venía en `front/css/modales/01-info.css` |
| **Persistencia** | Sin `localStorage` | Sin `localStorage` |
| **Idioma** | Español | Español |

**Paridad conservada:** mismas tablas de balance, mismas medidas isométricas,
mismo aspecto de la UI (los tokens CSS son los mismos archivos), mismas reglas
de excavación, camino válido, obras, límites y combate. Las diferencias son de
**arquitectura y render**, no de reglas de juego. Las barras de progreso son un
**detalle puramente estético**: hacen visible el avance del jugador edificio a
edificio, pero no modifican ningún valor ni regla. Estuvieron ausentes en el
traspaso y se incorporaron después replicando el comportamiento del legacy.

**Notas de alcance:** el legacy tiene modelos provisionales dibujados en canvas
(torreta, catapulta, incubadora) y lógica propia de arañas; la app cubre las 15
ranuras y las tropas del balance con vistas genéricas y combate simplificado
dentro de `siege`. Las medidas del sprite de la ballesta están en
`back/config/defenses.js` porque son arte, no balance.

---

## 4b. El legacy exportado

Ruta: **`C:\Users\omegamon\Desktop\DungeonBuild-Legacy`**

```
DungeonBuild-Legacy/
  index.html                  Entrada: 22 <link> + 45 <script>, se abre con doble clic
  css/                        Tokens, base, hud, modales, invasion, menus, 99-responsive
    estructuras/ballesta/     PNG real + README del modelo
  js/                         balance/, core/, world/, buildings/, troops/, invasion/, ui/
```

No depende de Node, de Vite ni de este repo. Si necesitas comparar un valor o
un dibujo, compáralo con esta copia; **no la edites** salvo que quieras cambiar
también el balance de la app (son copias independientes).

### 4b.1 Estructura de archivos del legacy

```
index.html
css/
  tokens/                     ÚNICO sitio donde se editan colores, medidas y movimiento
    01-paleta.css             Colores: --stone/--gold/--red, paneles, recursos, semáforo…
    02-medidas.css            Escala tipográfica, anchos de panel, rejilla de espaciado
    03-motion.css             Duraciones y curva de las transiciones
    04-composites.css         Tramas y biseles compartidos (panel, overlay, hueco)
    05-fuentes.css            @font-face Pixel Digitos + Pixelify Sans (base64, NO editar)
  base/
    01-reset.css              Reset, scrollbar, canvas
    02-botones.css            Caja pixel del botón y variantes gold/red/disabled
    03-paneles.css            Fondo y bisel comunes de barras y ventanas
    04-animaciones.css        @keyframes (una sola definición de cada uno)
  hud/                        Estado, recursos, acciones, Mejoras y obras
  modales/                    Información, atajos/configuración y editor
  invasion/                   Tropas, invocación y pantalla final
  menus/                      Menú Construir (objetos y barra)
  99-responsive.css           Media queries y prefers-reduced-motion (se carga al final)
js/
  balance/                    ÚNICA fuente de números editables a mano
    01-mundo-y-nucleo.js      Mapa, escala, núcleo, entrada, recursos, cámara, topos, ocultos
    02-estructuras.js         BUILD_LIMITS / CORE_LEVEL_CAPS / maxNivel por edificio
    03-costes.js              BUILD_COSTS / UPGRADE_COSTS
    04-obras.js               Constructores, TIME_SCALE, tiempos y avisos
    05-edificios.js           Vida, tamaño, capacidad y producción de edificios
    06-defensas.js            Ballesta, torreta, catapulta y proyectiles
    07-trampas.js             Bomba, electrostal y trampa de rocas
    08-tropas.js              Todas las tropas y requisitos de laboratorio
    09-invasion.js            Reloj, cola y punto de reunión
    99-compat.js              Publica BALANCE.* con los nombres históricos (NO editar)
  core/
    01-config-estado.js       Estado global, matriz map, proyección iso, levelRow
    01b-obras.js              Lectura/validación de obras: balanceReport(), fmtDur()
    03-canvas-camara.js       Canvas, cámara, zoom, WASD, menú Construir
    22-main.js                Inicio (resize, zoom inicial, rAF): SIEMPRE el último
  world/
    02-terreno.js             Excavar/rellenar, estructuras, BFS, pickCell
    04-render.js              Bucle render(), dibujo del terreno y structureAt()
    05-controles.js           Pan, selección, herramientas con arrastre
    07-modo-mover.js          Modo Mover, zoom con rueda, Esc
    21b-topos.js              Topos (ayudantes del núcleo)
  buildings/
    06-estructuras-ui.js      ICONS, STRUCTURES, almacenes, registerBuildable, Info/Mejorar
    08-estructuras-defensivas.js  Ballesta, torreta, catapulta + groundDrawer
    10-almacenes.js            Almacenes de monedas y de cristales
    11-estandarte.js           Estandartes + Estandarte de esqueletos
    11b-estandarte-slimes.js   Estandarte de slimes
    12-bomba.js / 12b-electrostal.js / 13-trampa-rocas.js
    14-laboratorio.js / 14b-produccion-pasiva.js / 14c-incubadora.js
    26-obras.js                Obras: constructores, temporizadores, andamios
  troops/
    09-grieta-tropas.js        defineTroop, TROOPS, ejército, Grieta
    15-panel-invocacion.js     Panel Invocar / Mutar / Criar
  invasion/
    16-invasion-base.js        Estado, pathfinding, escombros, victoria/derrota, cronómetro
    17-invasion-tropas-ordenes.js  Spawn, panel, órdenes
    18-invasion-simulacion.js  stepInvasion, defensas, proyectiles, bombas
    19-invasion-combate.js     Defensores, updateTroop, daño, saqueo
    19b-aranas.js              Araña madre y crías
    20-invasion-dibujo.js      Dibujo de tropas (TROOP_DRAWERS)
    21-invasion-controles.js   Selección por cuadro, entrar/salir
  ui/
    23-atajos.js / 24-mejoras.js / 25-editor.js
```

### 4b.2 Orden de carga del legacy (importa, todo son globales)

Tras el inline que declara `monedas_actuales`/`cristales_actuales`, `index.html`
carga primero los 10 archivos de `js/balance/` (`01…09`, `99-compat`) y luego:
`core/01 → core/01b → world/02 → core/03 → world/04 → world/05 → buildings/06 →
world/07 → buildings/08 → troops/09 → buildings/10 → 11 → 11b → 12 → 12b → 13 →
14 → 14b → 14c → troops/15 → invasion/16 → 17 → 18 → 19 → 19b → 20 → 21 →
world/21b → ui/23 → 25 → buildings/26 → ui/24 → core/22`.

Precedencias críticas: `08` antes de `09`–`14c` (groundDrawer), `16` antes de
`21b` (walkable), `23` antes de `25`, `26` antes de `24`, y `22-main.js` siempre
al final. Las referencias a funciones de archivos posteriores se resuelven en
tiempo de ejecución.

### 4b.3 Cómo editar el CSS del legacy

Todos los valores ajustables están en `css/tokens/`. El resto solo *referencia*
esos tokens. `99-responsive.css` se carga al final. La refactorización se validó
comparando 471 elementos × 70 propiedades computadas: **0 diferencias**.

---

## 5. Mundo y renderizado

- `MAP_SIZE = 41`. `map[y][x]` con `EMPTY=0`, `DIRT=1`, `CORE=2`.
- Escala: `SCALE = 1.5`; baldosa base 64×40 → **96×60 px** (`TILE_W/TILE_H`),
  `DIRT_HEIGHT = 24`, `CORE_HEIGHT = 15` (la roca del núcleo está a media altura).
- Proyección: `iso(x, y, z)` → `{ x: (x-y)*HALF_W, y: (x+y)*HALF_H - z }`.
  Acepta casillas fraccionarias y elevación `z` en px.
- Inicio: zona despejada 5×5 (18..22), núcleo 3×3 (19..21), entrada en
  `x=40, y=19..21` (3 casillas, es un edificio), camino de fábrica de x=23 a
  x=39 (3 de ancho). `INITIAL_DUG = 79` casillas abiertas iniciales.
- **Z-ordering**: recorre de (0,0) a (40,40); por casilla pinta suelo → suelo de
  edificio → bloque de tierra/núcleo. Cada edificio se dibuja justo después de
  la última casilla de su huella (`buildingAnchor`). La entrada va tras (40,22).
- Cámara: punto del mundo en el centro de la pantalla. WASD/flechas siempre
  activos (salvo con ventana de Info abierta). Rueda = zoom centrado en el cursor.
  Doble clic = centrar en el núcleo. Zoom entre 0.3 y 3.
- Selección **por base**: solo se detecta una estructura si el cursor cae sobre
  las casillas que ocupa en el suelo.

### Terreno

- Excavar (`digCell`) y rellenar (`fillCell`); no se puede donde hay estructura.
  Cada excavación cuesta 1 de cupo; rellenar libera 1.
- `DIG_LIMITS = { 1: 100, 2: 115, 3: 150 }` (totales, incluidas las 79 iniciales).
- **Camino válido**: BFS en 4 direcciones desde la entrada hasta una casilla
  pegada al núcleo, solo sobre `EMPTY`. Si no hay camino: el botón Invasión se
  bloquea y el editor no deja guardar.

---

## 6. Convenciones y reglas de diseño

1. **`levelRow(table, lvl)`**: lee tablas por nivel; si no existe la fila usa la
   del nivel más alto. Todas las tablas por nivel se leen así.
2. **`STRUCTURES`**: diccionario `id → definición`. Núcleo y entrada fijos; los
   demás se crean con `make()` y se registran como `${idPrefix}-${seq}`.
3. **Definición de edificio**: `kind, name, selectedText, icon, state, movable,
   size, getPos, setPos, setCells, height, drawFloating, drawGroundCell,
   drawOverlay, summary, stats[], range?, minRange?, attack?, guard?,
   untargetable?, producer?, collect?, unlocks?`.
4. **Huella cuadrada**: `squareFootprint(state, n)` ocupa/libera casillas y pone
   `state.placed`.
5. **REGLA DE ATRAVESABLES**: un edificio **sin** stat `kind:'hp'` es
   atravesable y no objetivo de la invasión. Solo bloquean los que tienen vida.
6. **`hiddenFromInvader(d)`**: estructuras invisibles en invasión (`bomb`,
   `electro`) y en la Vista de invasor del editor.
7. **Estadísticas** `{ label, icon, base|at, kind, desc, colors, scales, unit,
   decimals, max, resource, infoTroop, hideOnUpgrade }`. `kind`: `'hp'`,
   `'value'`, `'storage'`, `'produced'`, `'troops'`, `'text'`.
8. **`registerBuildable({...})`**: conecta la ranura del menú con contador,
   bloqueo, icono, creación y coste.
9. **Coste**: se cobra al **confirmar la colocación**; cancelar es gratis. Mover
   un edificio ya colocado o recolocar uno del editor también es gratis.
10. **Daño de defensas**: `defDamage(dps, cooldown)` = DPS × recarga sin
    redondear a entero.
11. **Estilo UI**: tokens de `front/css/tokens/` en la app, de `css/tokens/`
    en el legacy: cajas pixel, bisel claro arriba/izquierda y oscuro abajo/derecha.
    Fuente `var(--font)` = "Pixel Digitos", "Pixelify Sans".
12. **Accesibilidad**: `aria-*`, `focus-visible`, `prefers-reduced-motion`, foco
    atrapado en modales.
13. **Sin `localStorage`**: el estado vive solo en memoria.

---

## 7. Recursos

- Dos recursos: **monedas** y **cristales** (`'coins'`, `'crystals'`).
- Se guardan en `state.stored[recurso]` de cada estructura con stat
  `kind:'storage'` (núcleo y almacenes). `monedas_actuales`/`cristales_actuales`
  son un reflejo.
- `gainResource(res, n)` reparte parejo respetando capacidad;
  `spendResource(res, n)` quita parejo y devuelve `false` si no alcanza.
- HUD arriba a la derecha: barra con total / capacidad total.
- Inicio: 999999 de prueba (supera la capacidad del núcleo).
- Producción pasiva (mina/taller) va aparte de los almacenes y se recoge con clic.

### 7b. Obras (construcción y mejora con tiempo)

- Se ajusta en `back/balance/03-costes.js` y `04-obras.js` (en el legacy,
  `js/balance/`): `limiteConstructores` (2), costes, tiempos y `escalaTiempo`.
- Una obra vive en `state.work = { kind:'build'|'upgrade', to, start, end }`
  con marcas de `Date.now()`. Máximo 2 a la vez; cada una la martilla un topo.
- El costo de mejora se cobra al iniciar y el nivel sube al terminar. La
  construcción arranca al confirmar la colocación.
- Un edificio en obras **sigue funcionando con su nivel actual** y la mejora
  solo surte efecto al terminar. Las únicas excepciones son las defensas en
  mejora (no atacan), las trampas en mejora (no se activan en la invasión) y
  minas/talleres en mejora (no producen); las obras de construcción permanecen
  inactivas hasta que acaban.
- Estar en obras **no quita la opción de mover**: ni en la barra de acciones ni
  en el editor (Recoger/Retirar). El edificio se recoloca con su obra en curso
  y el andamio aparece en la nueva casilla.
- Los **topos** son 2 constructores + decorativos.

---

## 8. Tablas clave (valores actuales)

### 8.1 Núcleo (`CORE_LEVELS`, `core.maxLevel = 3`)

| Nivel | Vida | Capacidad (c/u) | Límite de excavación |
|---|---|---|---|
| 1 | 1000 | 2500 | 100 |
| 2 | 1250 | 4000 | 115 |
| 3 | 1500 | 10000 | 150 |
| 4 (definido, inalcanzable) | 2000 | 25000 | usa el del nivel 3 |

Para mejorar el núcleo hay que tener **colocados** todos los edificios que
permite su límite actual (`missingBuildings()`). Los edificios **en obras
(construcción o mejora) cuentan como colocados**; solo se excluyen los guardados
en el editor. Al abrir su pantalla de Mejorar se enumera lo que falta (con el
botón bloqueado) o, si ya está todo colocado, una tarjeta por edificio que se
desbloquea con el siguiente nivel (`unlockingBuildings()`).

### 8.2 Entrada

Espacio de tropas: nivel 1 → 20 · 2 → 30 · 3 → 50. Sin vida, no atacable ni movible.

### 8.3 `BUILD_LIMITS`

| Edificio | Núcleo 1 | Núcleo 2 | Núcleo 3 |
|---|---|---|---|
| ballista | 2 | 2 | 4 |
| turret | 0 | 1 | 2 |
| catapult | 0 | 0 | 1 |
| rift | 1 | 1 | 1 |
| vault (por tipo) | 1 | 1 | 1 |
| mine / workshop | 1 | 2 | 2 |
| banner | 1 | 2 | 2 |
| bannerslime | 0 | 1 | 2 |
| bomb | 2 | 3 | 4 |
| electro | 0 | 0 | 1 |
| incubator | 0 | 0 | 1 |
| rocktrap | 0 | 1 | 1 |
| lab | 0 | 1 | 1 |

Un límite 0 = "aún no se puede construir" (se muestra "Núcleo N").

### 8.4 `CORE_LEVEL_CAPS`

```
Núcleo 1: ballista 2, turret 1, entrance 1, rift 1, vault 2, banner 3, bomb 3, rocktrap 1, mine 2, workshop 2
Núcleo 2: entrance 2, ballista 3, turret 2, rift 3, banner 4, bomb 4, rocktrap 2, bannerslime 2, lab 1, mine 3, workshop 3, vault 2
Núcleo 3: incubator 2, rift 4, electro 2, entrance 3, mine 4, workshop 4, vault 3, lab 2, turret 4, catapult 2, banner 5, bannerslime 3, rocktrap 3
```

`allowedMaxLevel(id) = min(state.maxLevel, cap ?? state.maxLevel)`.

### 8.5 `BUILD_COSTS`

| Edificio | Costo | Edificio | Costo |
|---|---|---|---|
| ballista | 200 monedas | vault-crystals | 750 monedas |
| turret | 2500 monedas | prod-coins (taller) | 250 cristales |
| catapult | 7500 monedas | prod-crystals (mina) | 250 monedas |
| rift | gratis | banner | 500 cristales |
| lab | 2000 cristales | bannerslime | 2500 cristales |
| incubator | 10000 cristales | bomb | 100 monedas |
| vault-coins | 750 cristales | rocktrap | 500 monedas |
| electro | 7500 monedas | | |

La clave del coste = id de la ranura sin `build-`.

---

## 9. Edificios

Categorías del menú Construir: **recursos, militar, defensas, estandartes, trampas**.

### 9.1 Defensas

Todas 2×2, con vida (bloquean) y suelo de roca.

| | Ballesta | Torreta | Catapulta |
|---|---|---|---|
| kind / icono | `ballista` / bow | `turret` / dart | `catapult` / catapult |
| maxLevel | 3 | 4 | 2 |
| Vida | 500 / 550 / 580 | 420 / 470 / 520 / 580 | 750 / 800 |
| DPS | 6 / 8 / 9 | 8 / 10 / 12 / 16 | 8 / 10 |
| Recarga | 1.5 s | 0.25 s | 3 s |
| Rango | 4 / 4 / 4.2 | 6.7 / 6.75 / 6.8 / 6.85 | 4–10 (zona muerta <4) |
| Daño | único | único | área (radio 0.6) |
| Proyectil | saeta | dardo (19 cas./s) | piedra con arco (9 cas./s) |

`attack = { range, minRange?, cooldown, damage(nivel), boltHeight, projectile?,
speed?, arc?, splash? }`. Objetivo pegajoso; prioridad a tropas que golpean la
defensa. La catapulta dispara donde estaba la tropa (puede fallar).

**Zona muerta visible:** al seleccionar o mover la catapulta se resalta solo el
anillo entre 4 y 10 casillas (mismo color que el alcance); el disco interior
queda sin teñir, así se aprecia dónde *no* puede disparar. El contorno discontinuo
se cierra en la unión (antes dejaba una abertura en las 5 horas de la vista
isométrica). En Información/Mejorar
sus dos radios se muestran juntos como una única estadística **Rango: 4-10
casillas** y ya no se muestra la stat de **Explosión**. El resto de defensas y
trampas también usan la etiqueta **Rango** en lugar de "Alcance".

**Arte de la ballesta:** horneado desde un modelo 3D estilizado con cámara
ortográfica isométrica (30°) mediante `npm run art:ballista`. Se exportan un
pedestal estático con sombra de contacto y 24 ángulos reales × 3 estados
(reposo/disparo/recuperación), repartidos en 4 atlas para Phaser. No hay
`scaleX = cos()` ni lecturas de píxeles en tiempo de ejecución. Por defecto
mira a la entrada. Modelo, paleta y anclas están en
`front/assets/estructuras/ballesta/README.md`.

**Arte del lanzadardos (torreta, nivel 1):** mismo pipeline y mismas anclas,
estilo y paleta que la ballesta, con `npm run art:turret`
(`tools/turret-art/generate.mjs`). Zócalo de piedra de mazmorra, armazón de
madera con amarres de cuerda y cabeza giratoria con cañón de dardos y dardo
rojo. Se exportan pedestal + sombra y 24 ángulos × 3 estados en 4 atlas. Detalle
en `front/assets/estructuras/lanzadardos/README.md`.

**Arte del núcleo:** horneado con el mismo pipeline (`npm run art:core`,
`tools/core-art/generate.mjs`): plataforma de piedra, 4 pilares desgastados y
agrietados en las esquinas de la huella 3×3 y un cristal cian pequeño en el
centro con resplandor pulsante. Sustituye al antiguo cristal dibujado en
`CoreView`. El suelo de mazmorra con juntas de ladrillo se aplica también a la
huella del núcleo y a la de todos los edificios (`systems/textures.js`,
`entities/StructureView.js` y `systems/ballistaTextures.js`). Ver
`tools/core-art/README.md`.

### 9.2 Grieta de invocación

2×2, `kind 'rift'`, maxLevel 4, vida 400/450/500/550. Botón **Invocar**.

### 9.3 Incubadora de bestias

2×2, `kind 'incubator'`, maxLevel 2, vida 400/450. Botón **Criar**. Nivel 2
desbloquea la Araña madre.

### 9.4 Laboratorio de mutación

2×2, `kind 'lab'`, maxLevel 2, vida 350/400. Botón **Mutar tropa**: sube el
nivel de **todas** las unidades de ese tipo.

### 9.5 Almacenes

3×3, `kind 'vault'` (coins/crystals), maxLevel 3, vida 650/700/850, capacidad
2500/5000/10000.

### 9.6 Mina y Taller

2×2 (`mine` produce cristales, `workshop` monedas), maxLevel 4.

| Nivel | Vida | Por hora | Capacidad |
|---|---|---|---|
| 1 | 300 | 250 | 1250 |
| 2 | 330 | 300 | 1500 |
| 3 | 350 | 360 | 1960 |
| 4 | 380 | 450 | 2700 |

### 9.7 Estandartes

1×1, **sin vida** (atravesables). `guard = { troop, count(nivel), level(nivel) }`.
Defensores dentro de 3 casillas, vuelven a su puesto y no reaparecen hasta la
siguiente invasión.

- Esqueletos (`banner`, maxLevel 5): 1 · 2 · 3 · 3 nv2 · 3 nv3.
- Slimes (`bannerslime`, maxLevel 3): 1 slime de nivel 1 / 2 / 3.

### 9.8 Trampas

- **Bomba** (1×1, maxLevel 4, sin vida): enterrada, invisible en invasión,
  explota una vez. Daño 8 / 10 / 12 / 13 en rango 1 / 1.2 / 1.3 / 1.35.
- **Electrostal** (1×1, maxLevel 2, invisible): descarga en cadena (`targets` golpes,
  salto de `chain` 1.5 casillas), daño 10 / 12, rango 2. `cooldown: 0` = una descarga
  por invasión; si se pone `> 0` en el balance, se recarga y vuelve a disparar.
- **Trampa de rocas** (2×2, maxLevel 3, siempre visible): daño instantáneo al
  entrar y cada 1.5 s; 3 / 4 / 5. Voladoras inmunes.
- Esqueletos/defensores no reciben daño de trampas.

---

## 10. Tropas

`defineTroop(c)` genera la lista `stats` de las ventanas de Info/Mutar. Coste 0.

| Tropa | id | Origen | Req. | Espacio | maxLvl | Velocidad | Ataque | Alcance |
|---|---|---|---|---|---|---|---|---|
| Esqueleto | esqueleto | Grieta | 1 | 1 | 3 | 2.6 | 1 s | 1 |
| Slime | slime | Grieta | 2 | 1 | 3 | 2.4 | 1.2 s | 2.5 |
| Golem de madera | golem | Grieta | 3 | 3 | 3 | 1.9 | 2 s | 1 |
| Armadura de ceniza | armadura | Grieta | 4 | 6 | 2 | 2.0 | 1.1 s | 0.9 |
| Murciélago | murcielago | Incubadora | 1 | 1 | 2 | 3.3 | 0.75 s | 1 |
| Araña madre | arana | Incubadora | 2 | 10 | 2 | 2.6 | 1.3 s | 0.9 |
| Araña bebé | arana-bebe | Summoned | — | 0 | 1 | 3.6 | 0.7 s | 0.8 |

**Vida / daño por nivel**

- Esqueleto: 35/10 · 43/14 · 55/17.
- Slime (hp/dps): 27/14 · 34/16 · 40/20.
- Golem: 180/15 · 210/17 · 275/19.
- Murciélago: 27/7 · 32/9. Voladora, `structMult 2` contra recursos.
- Armadura: 750/16 · 875/20.
- Araña madre: 900/12/10 · 1000/15/14 crías; suelta 1 cría por cada 50 de vida perdida
  (`danoPorCria`) hasta su límite por nivel; las que falten salen al morir.
- Araña bebé: 14 hp / 5 dps. No se invoca ni se controla: va sola a la estructura
  alcanzable más cercana y no cuenta como baja del ejército.

**`TROOP_LAB_REQ`**: esqueleto `{2:1,3:2}`, slime `{2:1,3:2}`, golem `{2:1,3:2}`,
murciélago `{2:2}`, armadura `{2:2}`, araña `{2:2}`.

Helpers: `troopStatsAt`, `troopType`, `maxRiftLevel`, `incubatorLevel`,
`troopUnlocked`, `availableTroops`, `army`, `armySpace`, `armyCapacity`.
Invocar/Criar es instantáneo y ocupa espacio de la entrada; clic derecho en la
tarjeta retira una unidad.

Las tarjetas de tropa llevan un botón **"i"** que abre una ventana de
información con los datos del tipo y su nivel actual (misma ventana y barras
que Información/Mejorar, como en el legacy). Durante la invasión la "i" no se
muestra. Todas las tarjetas (Invocar/Criar/Mutar e invasión) muestran un
recuadrito con el **nivel** de la tropa; al llegar al máximo el recuadro enciende
un **fuego azul** y el número se aclara para seguir siendo legible.

---

## 11. Modo invasión

- Botón "Invasión" (abajo izquierda, atajo Q). Bloqueado si no hay camino válido en la base que se va a invadir.
- Con sesión iniciada y Supabase configurado se abre **Elegir rival**: se ataca
  una copia de la base del jugador elegido, no la propia. Sin sesión (invitado)
  o sin nube se conserva la simulación de siempre sobre la base propia.
  Ver [§11.1](#111-invasión-contra-otro-jugador).
- **Cronómetro**: 30 s de preparación; al desplegar la primera tropa (o al
  acabarse) empiezan 300 s de combate. Derrota por tiempo o por quedarse sin
  tropas. **Victoria** al destruir el núcleo.
- Al empezar: `invasion = {...invFresh()}`, cada目标 estructuro toma su vida en
  `invasion.siege`, se generan defensores y se oculta el HUD de estado.
- Las estructuras y el núcleo muestran una **barra de vida sobre su sprite**
  (`InvasionController.drawStructureBars`) en cuanto reciben daño; usa `siege`,
  así que la base real queda intacta. El panel de despliegue ya no repite la
  vida del núcleo.
- **Despliegue**: panel derecho con las tropas del ejército; clic despliega una
  (cola de 0.45 s) por la entrada hasta `INV_RALLY`.
- **Controles RTS**: clic+arrastrar = cuadro (Shift suma) · clic der. en suelo =
  mover con formación · clic der. en estructura = atacar · Ctrl+A = todas ·
  Esc = deseleccionar. Las crías no se seleccionan.
- **Pathfinding**: Dijkstra en 8 direcciones sin cortar esquinas;
  `walkable()` respeta estructuras, atravesables y escombros.
- **Estructura destruida** → escombros, casillas transitables y saqueo del 25 %
  (`BALANCE.invasion.botinFraccion`) de lo almacenado/producido, sumado a tus
  almacenes reales. El importe robable de la base queda indicado en el panel.
- Durante la invasión se ocultan `#topbar`, Mejoras y el botón del editor.

### 11.1 Invasión contra otro jugador

Trabajo en la rama `feat/invasion-multijugador` (aún no en `main`).

**Puesta en marcha:** además de `sql/001-saves.sql`, ejecutar en el SQL Editor de
Supabase [`back/database/sql/002-invasion-targets.sql`](back/database/sql/002-invasion-targets.sql).
Crea tres RPC de solo lectura (`security definer`, solo para `authenticated`)
para listar rivales y leer su base sin relajar las políticas RLS de `saves`.
Si no se ejecuta, el selector aparece vacío y queda la opción "Simular en mi base".

**Ciclo al invadir a un rival:**

1. Se captura un snapshot de tu base real (con sus obras y temporizadores).
2. Se lee el guardado `main` del rival. Si su camino al núcleo está bloqueado,
   se usa automáticamente su ranura `checkpoint:main` (último guardado con el
   camino libre). Si no existe ninguna copia válida, la invasión se cancela con
   un aviso: nunca se monta un ataque imposible.
3. La copia se aplica a la escena **sin tocar tus recursos ni tu ejército**.
   Toda estructura en obras se "toma": se le elimina el cronómetro (`work`) y
   se marca `frozenUpgrade`, de modo que conserva su nivel actual y sigue
   inactiva como una obra en curso, pero la mejora jamás termina durante la
   invasión (`WorkController.step()` no ve trabajo que completar).
4. Al terminar (victoria, derrota o cancelación) se vuelve a aplicar tu
   snapshot: tus edificios, niveles, obras y tiempos reales regresan y los
   guardados pospuestos se escriben ya con tu base de vuelta.

El checkpoint se actualiza en cada autoguardado en que el núcleo es alcanzable,
tanto en `localStorage` como en la ranura `checkpoint:main` de Supabase. Así, un
jugador que cierra el juego con el camino bloqueado sigue siendo invadible usando
su última base válida.

---

## 12. Interfaz

- **Construir** (E): Excavar/Rellenar, cinco pestañas (1–5), 15 ranuras con
  icono, contador `n/límite` y coste. Con el menú abierto **no se pueden
  seleccionar edificios** y solo responden sus propios atajos (1–5, Z excavar,
  X rellenar) más E para cerrarlo: Q (invasión), Alt y el resto de accesos
  globales no hacen nada.
- **Barra de acciones**: Información (Z), Mejorar (X), Mover (C) y una acción
  especial (V): Invocar / Mutar / Criar. En el **editor** se reduce a tres
  botones, como en el legacy: Información (Z), Mover (X) y Recoger (C), sin
  Mejorar ni acciones especiales.
- **Información/Mejorar** (`openPanel(id, mode)`): `valor » siguiente`,
  desbloqueos y botón bloqueado con motivo. Cada estadística que sube con el
  nivel lleva una **barra de progreso** (detalle estético del legacy, antes
  ausente en la app): en Información la barra mide el valor del nivel actual
  respecto al del nivel máximo (el texto sigue mostrando el valor actual); en
  Mejorar añade, en tono claro y parpadeante, el tramo que se gana al subir de
  nivel. Las stats fijas (recarga, rango constante, intervalos) no llevan
  barra. Se dibuja en `renderStat()` con `.stat-bar/.stat-fill/.stat-next` y se
  anima desde 0 al abrir la ventana. No afecta a las reglas de juego.
- **Mejoras pendientes**: pestañas Edificios y Tropas, centra y selecciona.
- **Atajos configurables**: contextos `global`, `select`, `build`, `editor`,
  `editsel`; 19 acciones en la app (Mejoras usa Alt izquierdo); teclas reservadas y detección de choques;
  confirmación reutilizable `openConfirm({...})`.
- **Modo Mover**: copia flotante sigue al cursor sobre huella verde/roja; anillo
  de alcance; clic der. o Esc cancelan.
- **Editor**: panel de guardados, Retirar (incluido el núcleo), Recoger, Guardar
  todo, Vista invasor y Guardar (exige camino válido). Salir sin guardar restaura
  la copia tomada al entrar.
- **Retirar tropas**: la ventana de Información de la entrada tiene un botón `−`
  por tipo (además del clic derecho en el panel de invocación).
- **Topos**: 6 ayudantes decorativos (2 constructores) que pasean por casillas
  excavadas; ocultos durante la invasión.
- **Pantalla de carga**: aparece en cuanto se abre el HTML (CSS crítico inline
  en `index.html`, antes de descargar el bundle). Muestra «Preparando la
  mazmorra…» con barra indeterminada mientras llega el JS; al arrancar
  `BootScene` pasa al progreso **real** del `Loader` de Phaser (`progress`,
  `filecomplete`) con el nombre del último archivo. Si falla un recurso,
  `loaderror` deja un mensaje de error en lugar de ocultarla. `MainScene.create()`
  la cierra al terminar de montar la UI. Respeta `prefers-reduced-motion` y
  avisa si JavaScript está desactivado (`<noscript>`). Ver
  [`front/loading/splash.js`](front/loading/splash.js).

---

## 13. Guía rápida para extender

### En la app Phaser

1. **Nuevo edificio:** añade su fila en `back/balance/02…06`, su dibujo en
   `back/entities/StructureView.js` (o una clase en `back/towers/`), su entrada
   en `back/systems/structureSpecs.js` y su ranura en `back/ui/InterfaceController.js`.
2. **Nueva tropa:** tabla en `back/balance/08`, textura en `back/enemies/troopArt.js`
   y lógica en `back/enemies/Troop.js` / `back/systems/Army.js`. Si es invocable
   en invasión (como las crías), usa `opts.summoned` y no olvides excluirla de la
   selección en `InvasionController.commandable()`.
3. **Nuevo nivel:** fila en la tabla de `back/balance/`, subir `maxNivel` y
   actualizar `topeNivelPorNucleo` si procede.
4. **Estilo:** solo en `front/css/tokens/`; no repetir valores sueltos.

### En el legacy exportado

1. `js/buildings/NN-nombre.js` con dibujo, `makeXxx()` y `registerBuildable`.
2. `index.html`: añadir el `div role="listitem"` con la ranura y el `<script>`
   en el orden correcto (después de 06 y antes de 15).
3. Tablas en `js/balance/02…04`; si es invisible en invasión, añadir su `kind`
   a `BALANCE.visibilidad.ocultasAlInvadir` en `01`.

---

## 14. Observaciones

- `core.stored` arranca en 999999 (modo pruebas) y `CORE_LEVELS` define nivel 4
  aunque `core.maxLevel = 3`.
- Costes de tropas y mutaciones en 0.
- Modelos provisionales en el legacy: torreta, catapulta e incubadora.
- El menú Construir es una barra centrada al 80 % del ancho disponible.
- Las fuentes están en base64 dentro de `front/css/tokens/05-fuentes.css`.
- No hay `localStorage`: recargar reinicia el juego.

---

## 15. Comandos

```bash
npm run dev       # servidor en http://127.0.0.1:5173/
npm run build     # build estático en dist/
npm run preview   # sirve el build
```

El legacy exportado no necesita comandos: se abre con doble clic desde
`C:\Users\omegamon\Desktop\DungeonBuild-Legacy\index.html`.
