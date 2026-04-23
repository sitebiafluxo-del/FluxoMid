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

-- Tabela de Contagens (Dia atual/Sincronização em tempo real)
create table if not exists public.contagens (
  id text primary key, -- Formato: user_id-data
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  total integer default 0,
  intervals jsonb default '[]'::jsonb,
  city text,
  subsidiary text,
  collaborator_name text,
  collaborator_cpf text,
  period text,
  month_reference text,
  updated_at timestamptz default now()
);

alter table public.contagens enable row level security;

create policy "users_manage_own_contagens"
  on public.contagens
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Tabela de Histórico (Registros finalizados)
create table if not exists public.historico (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  total integer default 0,
  data jsonb default '[]'::jsonb,
  city text,
  subsidiary text,
  collaborator_name text,
  cpf text,
  period text,
  mes_referencia text,
  saved_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.historico enable row level security;

create policy "users_manage_own_historico"
  on public.historico
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger para atualizar o campo updated_at automaticamente
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language 'plpgsql';

create trigger update_contagens_modtime
    before update on public.contagens
    for each row execute function update_updated_at_column();

create trigger update_historico_modtime
    before update on public.historico
    for each row execute function update_updated_at_column();

