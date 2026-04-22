-- Execute este script no SQL Editor do Supabase
-- Cria tabela de perfis e papel de acesso (manager/collaborator)

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'collaborator' check (role in ('manager', 'collaborator')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cada usuario pode ver apenas o proprio perfil
create policy if not exists "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Cada usuario pode atualizar apenas o proprio nome
create policy if not exists "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Trigger para criar perfil automatico quando novo usuario e criado
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 'collaborator')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Promover um usuario especifico para gestor (ajuste o email)
-- update public.profiles p
-- set role = 'manager'
-- from auth.users u
-- where p.id = u.id and u.email = 'seu-email@empresa.com';
