-- ==========================================================
-- NOMBRE DE USUARIO ELEGIDO AL REGISTRARSE
-- ----------------------------------------------------------
-- Ejecutar en el SQL Editor de Supabase después de 001-saves.sql
-- y 002-invasion-targets.sql.
--
-- El front envía el nombre en `raw_user_meta_data.display_name`
-- al llamar a auth.signUp(). Este trigger lo guarda en
-- public.profiles.display_name, que es lo que muestra el selector
-- de rivales. Si no llega nombre, se mantiene el comportamiento
-- anterior (parte del correo).
-- ==========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'Jugador'
    )
  )
  on conflict (id) do update
    set display_name = coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      public.profiles.display_name
    );
  return new;
end;
$$;

-- El trigger `on_auth_user_created` de 001-saves.sql ya apunta a esta función;
-- no hace falta recrearlo.
