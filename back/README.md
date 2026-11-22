# `back/` — Código interno

Todo el JavaScript de la app Phaser, separado por responsabilidades. No contiene
estilos ni sprites: esos viven en [`../front/`](../front/README.md). La entrada
del programa es [`main.js`](main.js), cargada por el `index.html` de la raíz.

```
back/
  main.js       Arranque: crea Phaser.Game y expone __DUNGEON_* en desarrollo
  database/     Supabase: inicio de sesión, guardado versionado y persistencia
  assets/       Importación de los sprites 2.5D (PNG de defensas y núcleo)
  balance/      ÚNICA fuente de números ajustables (01…09 + index + README)
  config/       Configuración de Phaser, mundo, paleta, defensas e interacción
  scenes/       BootScene (carga + progreso) y MainScene (composición + fin de carga)
  systems/      Mapa, cámara, picking, terreno, movimiento, obras, recursos,
                ejército, producción, editor, atajos, topos y texturas compartidas
  entities/     Vistas Phaser: terreno, núcleo, entrada, estructuras, topos, andamios
  towers/       DefenseTower (base común) + Ballista/DartTurret/Catapult (config)
  enemies/      Pathfinding, tropas, proyectiles, defensores e invasión
  ui/           Puente DOM ↔ escena: InterfaceController, ShortcutsUI, buildIcons
```

Cada carpeta importante tiene su propio `README.md` con el detalle de sus
archivos. En particular, [`balance/README.md`](balance/README.md) explica cómo
editar los números del juego.

## Estado

Migración **completa**: fases 1–11 cerradas. `npm run build` compila sin errores
(único aviso esperado: chunk >500 kB por el propio Phaser). La consola queda
limpia y la base real nunca se modifica durante una invasión: el daño se guarda
en `invasion.siege`.

**Organización y optimización aplicada:**

- Las tres clases de defensas (`Ballista`, `DartTurret`, `Catapult`) se
  unificaron en `towers/DefenseTower.js`; cada una solo aporta `config`, claves
  y los tiempos de su animación de disparo.
- La carga de atlas y la piedra de la huella se centralizaron en
  `systems/defenseTextures.js`; `BootScene` usa un bucle en vez de tres bloques
  copiados.
- Se eliminaron las funciones sin consumidores `project()`, `tileDiamond()`,
  `screenToCell()` (iso.js) y `rangeOf()` / `isHostileStructure()`
  (structureSpecs.js), junto con sus imports ahora innecesarios.
- La pantalla de carga se conecta al `Loader` real de Phaser desde
  `BootScene`/`MainScene` usando `front/loading/splash.js`.

## Dependencias

- `phaser@3.90.0`, `vite@8.3.8` (ver `../package.json`).
- ES modules. No se lee ningún global del legacy: el balance está duplicado de
  forma controlada en `balance/` y la lógica está portada en `systems/`,
  `enemies/`, `entities/` y `ui/`.
- Los estilos se importan desde `front/css/ui.css` y el sprite desde
  `front/assets/`. El proyecto funciona sin la copia del legacy en el escritorio.

## Comandos (desde la raíz del proyecto)

```bash
npm run dev       # http://127.0.0.1:5173/
npm run build     # dist/
npm run preview   # sirve dist/
```
