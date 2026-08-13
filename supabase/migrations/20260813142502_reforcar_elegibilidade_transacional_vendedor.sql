-- ANGROLINK — identidade necessária para qualquer operação transacional.
-- Não altera vendedores existentes: protege somente novas encomendas.

begin;

create or replace function public.vendedor_pode_receber_encomendas(
  p_vendedor_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vendedores v
    join auth.users u on u.id = v.user_id
    join public.profiles p on p.id = v.user_id
    where v.id = p_vendedor_id
      and v.status_aprovacao = 'aprovado'
      and coalesce(v.conta_ativa, false) = true
      and p.papel = 'vendedor'
      and coalesce(p.ativo, true) = true
      and p.apagado_em is null
  );
$$;

-- A função apenas expõe uma capacidade booleana, sem dados pessoais. Poderá
-- ser usada no futuro para distinguir anúncios compráveis de contactáveis.
revoke all on function public.vendedor_pode_receber_encomendas(uuid) from public;
grant execute on function public.vendedor_pode_receber_encomendas(uuid) to anon, authenticated;

create or replace function public.validar_vendedor_elegivel_em_encomenda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.vendedor_pode_receber_encomendas(new.vendedor_id) then
    raise exception 'O vendedor deste produto não está elegível para receber encomendas.';
  end if;

  return new;
end;
$$;

-- A trigger é a validação transacional no limite de escrita. A RPC de criação
-- continua a determinar produto, vendedor, preço e snapshots no servidor, e
-- só consegue inserir a encomenda se esta regra central devolver true.
drop trigger if exists validar_vendedor_elegivel_em_encomenda on public.encomendas;
create trigger validar_vendedor_elegivel_em_encomenda
before insert on public.encomendas
for each row execute function public.validar_vendedor_elegivel_em_encomenda();

revoke all on function public.validar_vendedor_elegivel_em_encomenda() from public, anon, authenticated;

commit;
