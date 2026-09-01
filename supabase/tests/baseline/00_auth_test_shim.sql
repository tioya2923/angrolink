-- TEST-ONLY — NÃO APLICAR EM PRODUÇÃO
-- NÃO É MIGRATION. NÃO REPRESENTA O HISTÓRICO REMOTO.
-- Shim PostgreSQL puro do subconjunto de Auth necessário aos testes locais.

create schema if not exists auth;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Roles são objetos do cluster, fora da transação por base. A baseline nunca
-- as cria nem remove automaticamente: o administrador local deve provisionar
-- previamente `anon` e `authenticated` no cluster descartável de testes.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise exception 'A baseline requer as roles locais anon e authenticated; provisione-as no cluster de testes antes de executar.';
  end if;
end;
$$;

create table auth.users (
  id uuid primary key,
  email text unique,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user)
$$;

grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.uid(), auth.role() to anon, authenticated;
