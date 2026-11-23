-- ==========================================================
-- DUNGEON BUILD — ESQUEMA DE SUPABASE
-- ----------------------------------------------------------
-- Ejecutar una vez en el SQL Editor del proyecto de Supabase.
-- La tabla `saves` guarda el progreso completo en jsonb: añadir
-- niveles de edificios, tropas o defensas NO requiere migrar SQL,
-- solo cambiar balance/ y (si cambia el formato) database/migrations.js.
-- Row Level Security: cada usuario solo ve y escribe su propia fila.
-- ==========================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slot text not null default 'main',
  schema_version integer not null default 1,
  balance_version text,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saves_user_slot_key unique (user_id, slot)
);

create index if not exists saves_user_idx on public.saves (user_id);

-- Actualiza `updated_at` automáticamente en cada upsert.
-- gen_random_uuid() requiere la extensión pgcrypto (ya activa en Supabase).

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saves_touch_updated_at on public.saves;
create trigger saves_touch_updated_at
before update on public.saves
for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.saves enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "saves_select_own" on public.saves;
create policy "saves_select_own" on public.saves
  for select using (auth.uid() = user_id);

drop policy if exists "saves_insert_own" on public.saves;
create policy "saves_insert_own" on public.saves
  for insert with check (auth.uid() = user_id);

drop policy if exists "saves_update_own" on public.saves;
create policy "saves_update_own" on public.saves
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "saves_delete_own" on public.saves;
create policy "saves_delete_own" on public.saves
  for delete using (auth.uid() = user_id);

-- Crea un perfil automáticamente al registrarse (opcional pero útil).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.email, split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
