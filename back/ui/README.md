# `back/ui/` — Puente con la interfaz DOM

| Archivo | Contenido |
|---|---|
| `InterfaceController.js` | Conecta la DOM con la escena: HUD, menú Construir, barra de acciones, Información/Mejorar, recursos, invasión, invocación y editor |
| `ShortcutsUI.js` | Diálogo de atajos reasignables (`#settings-btn`, 5 contextos) y confirmación reutilizable |
| `buildIcons.js` | Dibuja los iconos pixelados de las 15 ranuras del menú Construir |
| `UpgradeMenu.js` | Menú "Mejoras" del legacy: botón bajo los recursos y panel con edificios/tropas pendientes |

El HTML está en el `index.html` de la raíz y los estilos en `front/css/`
(`ui.css` importa `front/css/tokens/`, `base/`, `hud/`, `menus/`, `modales/` e
`invasion/`). Los números que muestra la interfaz salen de `../balance/`.
