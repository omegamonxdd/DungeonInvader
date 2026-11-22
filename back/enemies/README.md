# `back/enemies/` — Simulación de invasión

| Archivo | Contenido |
|---|---|
| `pathfinding.js` | Dijkstra en 8 direcciones sin cortar esquinas, `distToRect()` y búsqueda de casilla libre |
| `troopArt.js` | Texturas pixeladas de las siete tropas, saeta, roca de catapulta y destellos de impacto/polvo |
| `Troop.js` | Spawn por carriles, waypoint, ruta ataque/movimiento, cooldown, barra de vida y órdenes |
| `Projectile.js` | Saeta con seguimiento y arco `sin(πk)`; también tiro balístico sin seguimiento para la catapulta |
| `Defender.js` | Guardias de estandarte, trampas y defensores por niveles |
| `InvasionController.js` | Reloj `prep → batalla`, cola y oleadas, bajas, `siege`, victoria/derrota, selección RTS y disparo de ballestas |

La catapulta dispara como un mortero: fija un punto de suelo al lanzar (con
dispersión y `missChance` del balance), no persigue a la tropa y solo hace daño
por salpicadura, así que puede fallar y las tropas pueden esquivarla. El
origen del proyectil es la boca del modelo vía `systems/muzzle.js`.

Todo el daño se escribe en `invasion.siege`, nunca en `state.hp`: al terminar la
simulación la base vuelve intacta. La UI del panel de invasión está en `../ui/`
y los estilos en `front/css/invasion/`.
