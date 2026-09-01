-- ANGROLINK — fundação estrutural para entrega de encomendas.
-- Não ativa entrega no checkout, não cria matching, tarifa, atribuição ou tracking.

begin;

-- As colunas geográficas existentes em encomendas continuam a representar o
-- snapshot da origem/local de levantamento do vendedor. O destino de entrega
-- passa a ter entidade própria para nunca reutilizar esses campos.
alter table public.encomendas
  drop constraint if exists encomendas_modalidade_recebimento_check;

alter table public.encomendas
  add constraint encomendas_modalidade_recebimento_check
  check (modalidade_recebimento in ('levantamento', 'entrega'));

-- Nesta V1 não existe tarifa logística aprovada. Uma encomenda de entrega não
-- pode introduzir um valor fictício no domínio financeiro.
alter table public.encomendas
  drop constraint if exists encomendas_entrega_sem_tarifa_v1_check;

alter table public.encomendas
  add constraint encomendas_entrega_sem_tarifa_v1_check
  check (modalidade_recebimento <> 'entrega' or entrega_centimos = 0);

create table if not exists public.enderecos_entrega_encomenda (
  encomenda_id uuid primary key references public.encomendas(id) on delete restrict,
  destinatario_nome text not null,
  destinatario_telefone text not null,
  provincia text not null,
  municipio text not null,
  bairro text not null,
  endereco_detalhado text not null,
  ponto_referencia text,
  instrucoes_entrega text,
  criado_em timestamptz not null default now(),
  constraint endereco_entrega_nome_valido check (char_length(btrim(destinatario_nome)) between 2 and 160),
  constraint endereco_entrega_telefone_valido check (char_length(btrim(destinatario_telefone)) between 6 and 30),
  constraint endereco_entrega_provincia_valida check (char_length(btrim(provincia)) between 2 and 120),
  constraint endereco_entrega_municipio_valido check (char_length(btrim(municipio)) between 2 and 120),
  constraint endereco_entrega_bairro_valido check (char_length(btrim(bairro)) between 2 and 160),
  constraint endereco_entrega_detalhado_valido check (char_length(btrim(endereco_detalhado)) between 3 and 500),
  constraint endereco_entrega_referencia_valida check (ponto_referencia is null or char_length(btrim(ponto_referencia)) <= 500),
  constraint endereco_entrega_instrucoes_validas check (instrucoes_entrega is null or char_length(btrim(instrucoes_entrega)) <= 1000)
);

comment on table public.enderecos_entrega_encomenda is
  'Snapshot imutável do destino de uma encomenda de entrega; a origem permanece no snapshot comercial do vendedor.';

create index if not exists enderecos_entrega_encomenda_localizacao_idx
  on public.enderecos_entrega_encomenda (provincia, municipio, bairro);

create or replace function public.proteger_snapshot_destino_entrega_encomenda()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'O destino de entrega é um snapshot imutável da encomenda.';
end;
$$;

drop trigger if exists proteger_snapshot_destino_entrega on public.enderecos_entrega_encomenda;
create trigger proteger_snapshot_destino_entrega
before update on public.enderecos_entrega_encomenda
for each row execute function public.proteger_snapshot_destino_entrega_encomenda();

-- A relação encomenda/destino é validada no fim da transação. Isto permite que
-- a futura RPC controlada insira ambos os snapshots de forma atómica, mas nunca
-- deixa uma encomenda de entrega persistir sem destino, nem um destino numa
-- encomenda de levantamento.
create or replace function public.validar_integridade_destino_entrega_encomenda()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_encomenda_id uuid;
  v_modalidade text;
  v_tem_destino boolean;
begin
  if tg_table_schema = 'public' and tg_table_name = 'encomendas' then
    if tg_op = 'DELETE' then
      v_encomenda_id := old.id;
    else
      v_encomenda_id := new.id;
    end if;
  elsif tg_table_schema = 'public' and tg_table_name = 'enderecos_entrega_encomenda' then
    if tg_op = 'DELETE' then
      v_encomenda_id := old.encomenda_id;
    else
      v_encomenda_id := new.encomenda_id;
    end if;
  else
    raise exception 'Trigger de destino de entrega invocado por tabela inesperada: %.%', tg_table_schema, tg_table_name;
  end if;

  select e.modalidade_recebimento
    into v_modalidade
  from public.encomendas e
  where e.id = v_encomenda_id;

  if not found then
    return null;
  end if;

  select exists (
    select 1
    from public.enderecos_entrega_encomenda d
    where d.encomenda_id = v_encomenda_id
  ) into v_tem_destino;

  if v_modalidade = 'entrega' and not v_tem_destino then
    raise exception 'Uma encomenda de entrega exige um destino completo.';
  end if;

  if v_modalidade = 'levantamento' and v_tem_destino then
    raise exception 'Uma encomenda de levantamento não pode ter destino de entrega.';
  end if;

  return null;
end;
$$;

drop trigger if exists validar_destino_entrega_na_encomenda on public.encomendas;
create constraint trigger validar_destino_entrega_na_encomenda
after insert or update of modalidade_recebimento on public.encomendas
deferrable initially deferred
for each row execute function public.validar_integridade_destino_entrega_encomenda();

drop trigger if exists validar_encomenda_no_destino_entrega on public.enderecos_entrega_encomenda;
create constraint trigger validar_encomenda_no_destino_entrega
after insert or update or delete on public.enderecos_entrega_encomenda
deferrable initially deferred
for each row execute function public.validar_integridade_destino_entrega_encomenda();

alter table public.enderecos_entrega_encomenda enable row level security;

drop policy if exists enderecos_entrega_encomenda_leitura_participantes on public.enderecos_entrega_encomenda;
create policy enderecos_entrega_encomenda_leitura_participantes
on public.enderecos_entrega_encomenda
for select to authenticated
using (
  exists (
    select 1
    from public.encomendas e
    where e.id = encomenda_id
      and (
        e.cliente_id = auth.uid()
        or exists (
          select 1
          from public.vendedores v
          where v.id = e.vendedor_id
            and v.user_id = auth.uid()
        )
        or public.eh_admin()
      )
  )
);

-- Não há escrita direta: a RPC de entrega só será criada quando existir uma
-- taxonomia administrativa server-side e a operação logística estiver pronta.
revoke all on table public.enderecos_entrega_encomenda from public, anon, authenticated;
grant select on table public.enderecos_entrega_encomenda to authenticated;

revoke all on function public.proteger_snapshot_destino_entrega_encomenda() from public, anon, authenticated;
revoke all on function public.validar_integridade_destino_entrega_encomenda() from public, anon, authenticated;

commit;
