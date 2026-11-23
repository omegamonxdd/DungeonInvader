# `back/database/` — Supabase, inicio de sesión y guardado

Capa de persistencia del prototipo. Todo el progreso (recursos, edificios y
sus niveles, obras en curso, terreno, tropas y estadísticas) se serializa en
un **snapshot versionado** que se guarda:

1. siempre en `localStorage` (caché + modo invitado);
2. y, si hay credenciales, en la tabla `saves` de Supabase.

Si Supabase no está configurado el juego funciona igual: el progreso se
mantiene entre sesiones en el navegador. No hay que tocar ningún archivo para
ese modo.

## Archivos

| Archivo | Responsabilidad |
| --- | --- |
| `config.js` | URLs, claves, claves de localStorage, versión del snapshot e intervalos |
| `client.js` | Creación perezosa del cliente `@supabase/supabase-js` |
| `auth.js` | `signIn` / `signUp` / `signOut` / sesión persistida / invitado |
| `storage.js` | Guardado local (fallback y caché offline) |
| `repository.js` | Lectura/escritura de `saves` (Supabase) + decisiones de versión |
| `snapshot.js` | `buildSnapshot()` y `normalizeSnapshot()`: fuente de verdad |
| `restore.js` | Aplica un snapshot a los sistemas vivos de `MainScene` |
| `migrations.js` | Cadena de migraciones por número de versión |
| `GameService.js` | Orquestador: arranque, autoguardado, cambios de usuario |
| `AuthUI.js` | Modal de acceso y chip de estado del guardado |
| `sql/001-saves.sql` | Tablas, índices, trigger de `updated_at` y políticas RLS |
| `sql/002-invasion-targets.sql` | RPC de solo lectura para invadir bases ajenas |
| `index.js` | API pública del módulo |

## Puesta en marcha con Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ejecuta `sql/001-saves.sql` en el SQL Editor. Para habilitar la invasión
   contra otros jugadores ejecuta después `sql/002-invasion-targets.sql` (tres RPC
   `security definer` que solo leen la lista de rivales, su guardado `main` y su
   checkpoint; no relajan las políticas RLS de `saves`).
3. Copia `.env.example` a `.env` y rellena:

   ```env
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=TU-ANON-KEY
   ```

   La *anon key* es pública y está pensada para el navegador; la seguridad la
   dan las políticas RLS de `sql/001-saves.sql`. **Nunca** pongas la *service role
   key* en el front.

4. `npm run dev`. En el arranque aparece el modal de acceso (también se puede
   continuar como invitado).

Sin esas variables: modo local, sin errores y sin dependencia de red.

## Ciclo de vida

```
main.js crea GameService → AuthUI → Phaser.Game
MainScene.create() llama service.attach(ctx) y service.start()
  ├─ restaura sesión de Supabase (o invitado local)
  ├─ carga guardado local y lo aplica
  ├─ si hay usuario: compara con la nube (last-write-wins) y aplica/sube
  └─ arrange autoguardado (15 s + 1,2 s tras cambio + pagehide/visibilitychange)
```

Los cambios se marcan con `service.markDirty()` desde las acciones relevantes
de `MainScene` (obras, tropas, terreno, editor, fin de invasión). Durante una
invasión los guardados/cargas se posponen y se aplican al terminar, para no
alterar la simulación.

## Escalabilidad

- El snapshot guarda **ids y niveles**, nunca vida/daño/rango: esos se
  recalculan desde `balance/` al cargar (`restore.js → derive()`). Añadir un
  nivel 4 a una defensa o una tropa nueva no necesita cambiar el guardado.
- `army.counts` y `army.levels` son mapas abiertos: los ids desconocidos se
  conservan.
- `orphans` y `extra` conservan datos de versiones futuras o tipos que ya no
  existen en este balance.
- `schema_version` viaja en la fila y `migrations.js` aplica los pasos en
  orden. Para cambiar el formato: sube `SNAPSHOT_VERSION` y añade una entrada
  en `MIGRATIONS`.

## Checkpoint de camino válido e invasiones

Cada autoguardado con el núcleo alcanzable (`terrain.pathValid` y
`snapshotHasPath()`) se duplica en la ranura auxiliar `checkpoint:main`:
`localStorage` (`dungeon-build:checkpoint:*`) y tabla `saves` del usuario.
Cuando se va a invadir una base cuyo guardado tiene el camino bloqueado, se
carga ese checkpoint en su lugar; si no hay ninguno válido, la invasión se
cancela. `GameService` mantiene `invasionPreparing` en `true` mientras se
descarga la base prestada para que ningún autoguardado escriba el snapshot del
rival como progreso propio. Ver `../enemies/invasionBase.js`.

## Resolución de conflictos

Se compara `savedAt` (o `updated_at` en Supabase): gana el más reciente. Si el
jugador tiene cambios sin subir, se empuja la copia local en lugar de
sobrescribirla. El guardado local siempre se escribe primero, así que una
desconexión nunca pierde progreso.
