-- Esquema do painel GODOI CT. Execute no SQL Editor do seu projeto Supabase.
-- A grade é pública para leitura; somente os usuários explicitamente listados
-- em admin_users podem criar, editar ou excluir horários.

create extension if not exists pgcrypto;

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  modality text not null check (modality in ('Kids', 'Juvenil', 'Adulto', 'Feminino', 'Avançado')),
  day text not null check (day in ('Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo')),
  time time without time zone not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.schedules enable row level security;
alter table public.admin_users enable row level security;

-- Horários publicados podem ser consultados sem login.
drop policy if exists "public can read schedules" on public.schedules;
create policy "public can read schedules"
  on public.schedules for select
  to anon, authenticated
  using (true);

-- A tabela de autorização só revela ao usuário a própria associação.
drop policy if exists "admins can read own membership" on public.admin_users;
create policy "admins can read own membership"
  on public.admin_users for select
  to authenticated
  using (user_id = (select auth.uid()));

-- A leitura desta allowlist é limitada pela política acima. Apenas pessoas
-- com acesso administrativo ao projeto Supabase devem inserir/remover membros.
drop policy if exists "allowlisted admins can manage schedules" on public.schedules;
create policy "allowlisted admins can manage schedules"
  on public.schedules for all
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users
      where admin_users.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.admin_users
      where admin_users.user_id = (select auth.uid())
    )
  );

grant select on public.schedules to anon, authenticated;
grant insert, update, delete on public.schedules to authenticated;
grant select on public.admin_users to authenticated;
