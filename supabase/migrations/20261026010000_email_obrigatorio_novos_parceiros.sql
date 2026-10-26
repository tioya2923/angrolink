-- Executar como owner da base. Não altera Auth, RLS, grants públicos ou RPCs.
begin;
-- Serializa também reaplicações e fecha a janela entre snapshot e trigger.
select pg_advisory_xact_lock(20261026, 1);
lock table public.parceiros_entrega in share row exclusive mode;

create schema if not exists parceiros_email_privado authorization postgres;
revoke all on schema parceiros_email_privado from public, anon, authenticated;
create table if not exists parceiros_email_privado.ativacao (
  unica boolean primary key default true check (unica),
  ativado_em timestamptz not null default transaction_timestamp()
);
create table if not exists parceiros_email_privado.legados (
  user_id uuid primary key references auth.users(id) on delete cascade,
  parceiro_id_original uuid not null
);
alter table parceiros_email_privado.ativacao owner to postgres;
alter table parceiros_email_privado.legados owner to postgres;
revoke all on all tables in schema parceiros_email_privado from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from parceiros_email_privado.ativacao where unica) then
    insert into parceiros_email_privado.legados(user_id, parceiro_id_original)
    select user_id, id from public.parceiros_entrega;
    insert into parceiros_email_privado.ativacao(unica) values (true);
  end if;
end;
$$;

create or replace function parceiros_email_privado.exigir_email_novo_parceiro()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_email text;
begin
  -- A isenção é por identidade que já era parceira, não por idade de Auth,
  -- metadata, ID da linha recriada ou parâmetro fornecido pelo browser.
  if exists (select 1 from parceiros_email_privado.legados l where l.user_id = new.user_id) then
    return new;
  end if;
  v_email := nullif(lower(btrim(new.email)), '');
  if v_email is null
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or split_part(v_email, '@', 2) = 'telefone.angrolink' then
    raise exception using
      errcode = '23514',
      constraint = 'parceiro_email_nova_candidatura',
      message = 'Indique um email externo válido para a nova candidatura de parceiro.';
  end if;
  new.email := v_email;
  return new;
end;
$$;
alter function parceiros_email_privado.exigir_email_novo_parceiro() owner to postgres;
revoke all on function parceiros_email_privado.exigir_email_novo_parceiro() from public, anon, authenticated;

drop trigger if exists exigir_email_novo_parceiro on public.parceiros_entrega;
create trigger exigir_email_novo_parceiro
before insert or update on public.parceiros_entrega
for each row execute function parceiros_email_privado.exigir_email_novo_parceiro();
commit;
