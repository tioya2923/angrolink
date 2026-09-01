-- ANGROLINK — protege a identidade documental do vendedor após a primeira aprovação.
-- A aprovação é histórica: aprovado_em não é limpo em suspensão ou rejeição.

begin;

create or replace function public.proteger_identidade_verificada_vendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.aprovado_em is not null
    and not public.eh_admin()
    and (
      new.nome_responsavel is distinct from old.nome_responsavel
      or new.nome_comercial is distinct from old.nome_comercial
    ) then
    raise exception 'Os nomes verificados não podem ser alterados. Contacte o Apoio ANGROLINK.';
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_identidade_verificada_vendedor on public.vendedores;
create trigger proteger_identidade_verificada_vendedor
before update of nome_responsavel, nome_comercial on public.vendedores
for each row execute function public.proteger_identidade_verificada_vendedor();

revoke all on function public.proteger_identidade_verificada_vendedor() from public, anon, authenticated;

create or replace function public.proteger_marco_aprovacao_vendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.eh_admin()
    and (
      new.aprovado_em is distinct from old.aprovado_em
      or new.aprovado_por is distinct from old.aprovado_por
    ) then
    raise exception 'O marco de aprovação só pode ser alterado por administrador.';
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_marco_aprovacao_vendedor on public.vendedores;
create trigger proteger_marco_aprovacao_vendedor
before update of aprovado_em, aprovado_por on public.vendedores
for each row execute function public.proteger_marco_aprovacao_vendedor();

revoke all on function public.proteger_marco_aprovacao_vendedor() from public, anon, authenticated;

commit;
