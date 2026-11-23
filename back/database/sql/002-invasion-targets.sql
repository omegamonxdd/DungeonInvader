-- ==========================================================
-- INVASIÓN CONTRA OTROS JUGADORES — LECTURA CONTROLADA
-- ----------------------------------------------------------
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de schema.sql.
--
-- RLS impide que un usuario lea los `saves` de otro. En vez de abrir la
-- tabla, se exponen tres funciones `security definer` (se ejecutan con los
-- permisos del dueño de la función y no están sujetas a RLS) que devuelven
-- SOLO lo necesario: una lista de rivales y el snapshot de uno de ellos.
-- Los permisos se dan únicamente a `authenticated`: los invitados siguen
-- jugando en local y no pueden consultar estas funciones.
-- ==========================================================

-- Lista de bases invadibles (ranura principal, excluyendo la propia).
create or replace function public.list_invasion_targets()
returns table (user_id uuid, display_name text, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.user_id,
         coalesce(p.display_name, 'Jugador') as display_name,
         s.updated_at
  from public.saves s
  left join public.profiles p on p.id = s.user_id
  where s.slot = 'main'
    and s.user_id <> auth.uid()
  order by s.updated_at desc
  limit 50;
$$;

-- Base completa de un rival, tal como la guardó.
create or replace function public.get_invasion_target_state(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select state
  from public.saves
  where user_id = p_user_id and slot = 'main'
  limit 1;
$$;

-- Última base del rival en la que el camino al núcleo estaba libre.
create or replace function public.get_invasion_target_checkpoint(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select state
  from public.saves
  where user_id = p_user_id and slot = 'checkpoint:main'
  limit 1;
$$;

-- El rol anon NO debe poder leer bases ajenas; solo usuarios autenticados.
revoke all on function public.list_invasion_targets() from public;
revoke all on function public.get_invasion_target_state(uuid) from public;
revoke all on function public.get_invasion_target_checkpoint(uuid) from public;

grant execute on function public.list_invasion_targets() to authenticated;
grant execute on function public.get_invasion_target_state(uuid) to authenticated;
grant execute on function public.get_invasion_target_checkpoint(uuid) to authenticated;
