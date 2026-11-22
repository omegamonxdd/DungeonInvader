# `back/towers/` — Defensas con sprite propio

| Archivo | Contenido |
|---|---|
| `DefenseTower.js` | **Base común** de las tres defensas: pedestal, sombra, suelo de roca, movimiento flotante, obra/escombros, apuntado cuantizado a 15°, ciclo de disparo y destrucción. Antes había tres copias de ~240 líneas; ahora vive aquí una sola vez. |
| `Ballista.js` | Ballesta de nivel 1: elige `BALLISTA`, sus claves y el ritmo `[110, 320]` ms del destello/recuperación. |
| `DartTurret.js` | Lanzadardos de nivel 1: mismas anclas/atlas que la ballesta; cooldown más corto (`fireMs × 0.32 / 0.9`). |
| `Catapult.js` | Catapulta de nivel 1: brazo con cazo y contrapeso; el retorno termina antes del siguiente disparo (`fireMs × 0.22 / 0.62`). |

Cada subclase se reduce a pasar `(config, keys, fireStages)` al constructor de
`DefenseTower`. El arte se hornea **offline** (`npm run art:ballista`,
`npm run art:turret`, `npm run art:catapult`): un modelo 3D estilizado se
renderiza con cámara ortográfica isométrica a 24 ángulos × 3 estados.
`BootScene` carga el pedestal y los 4 atlas de cada una y la base elige el frame
según el ángulo de pantalla. Comparten paleta, luz y escala, así que las tres
se leen como un set coherente. El resto de estructuras usan
`entities/StructureView.js`.

Las tres exponen `shotOrigin()`, que usa `systems/muzzle.js` para devolver el
punto de mundo de la boca del arma en el frame actual. La invasión lo usa como
origen del proyectil (antes se disparaba desde el centro de la huella).

Los helpers de claves/atlas y la piedra de la huella están en
[`../systems/defenseTextures.js`](../systems/defenseTextures.js).
