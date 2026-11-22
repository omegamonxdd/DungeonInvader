# `front/css/` — Hojas de estilo

Copia íntegra de las 22 hojas CSS del legacy más `ui.css`, el punto de entrada
de la app Phaser. El orden de carga de `ui.css` reproduce el de la migración y
no debe cambiar sin revisar la cascada.

| Carpeta | Archivos | Para qué sirve |
|---|---|---|
| `tokens/` | `01-paleta`, `02-medidas`, `03-motion`, `04-composites`, `05-fuentes` | **Único sitio** donde se editan colores, tipografía, espaciado, duraciones y fuentes |
| `base/` | `01-reset`, `02-botones`, `03-paneles`, `04-animaciones` | Reset, caja pixel de botones, biseles y `@keyframes` |
| `hud/` | `01-estado`, `02-recursos`, `03-acciones`, `04-mejoras`, `05-obras` | Contador de excavación, recursos, barra de acciones, panel de mejoras y obras |
| `menus/` | `01-construir-items`, `02-construir-barra` | Ranuras y barra del menú Construir |
| `modales/` | `01-info`, `02-atajos`, `03-editor` | Información/Mejorar, atajos configurables y editor de mazmorra |
| `invasion/` | `01-tropas`, `02-fin` | Panel de despliegue y letrero de victoria/derrota |
| raíz | `99-responsive.css` | Media queries y `prefers-reduced-motion` (siempre al final) |
| raíz | `ui.css` | Importa todo lo anterior y añade los ajustes de Phaser |

Algunos selectores del legacy no tienen elemento en la UI de Phaser
(`#upg-panel`, `#invasion-select-all`, `#info-missing`, iconos canvas del menú):
se conservan para mantener la paridad de estilos y porque el editor/atajos
pueden crear elementos dinámicamente.

## Pantalla de carga (excepción deliberada)

El CSS de `#loading-screen` **no está aquí**: va inline en el `<head>` de
`index.html` (raíz). Es CSS crítico y debe pintarse antes de descargar el
bundle de Phaser (~1.4 MB) y esta hoja (58 kB). Duplicarlo aquí retrasaría su
aparición. El comportamiento (progreso, error y retirada) está en
[`../loading/splash.js`](../loading/splash.js). Si cambias la paleta de la
pantalla, edita solo el bloque inline de `index.html`.
