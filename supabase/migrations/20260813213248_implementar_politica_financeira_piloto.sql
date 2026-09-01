-- ANGROLINK — política financeira V1 de piloto.
-- Não integra PSP, não confirma pagamentos e não movimenta dinheiro.
begin;

-- A configuração só afeta novas obrigações, pois cada pagamento congela BPS.
update public.configuracoes_financeiras
set comissao_bps = 500, prazo_repasse_horas = 48, atualizado_em = now()
where chave = 'padrao' and ativo = true;

create table public.reembolsos_pagamento (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid not null references public.pagamentos(id) on delete restrict,
  encomenda_id uuid not null references public.encomendas(id) on delete restrict,
  estado text not null default 'solicitado' check (estado in (
    'solicitado', 'em_analise', 'aprovado', 'processando', 'concluido', 'recusado', 'cancelado', 'falhado'
  )),
  motivo text not null check (char_length(btrim(motivo)) between 3 and 500),
  valor_solicitado_centimos bigint not null check (valor_solicitado_centimos > 0),
  valor_produtos_solicitado_centimos bigint not null default 0 check (valor_produtos_solicitado_centimos >= 0),
  valor_entrega_solicitado_centimos bigint not null default 0 check (valor_entrega_solicitado_centimos >= 0),
  valor_taxa_processador_solicitado_centimos bigint not null default 0 check (valor_taxa_processador_solicitado_centimos >= 0),
  valor_aprovado_centimos bigint not null default 0 check (valor_aprovado_centimos >= 0),
  valor_produtos_aprovado_centimos bigint not null default 0 check (valor_produtos_aprovado_centimos >= 0),
  valor_entrega_aprovado_centimos bigint not null default 0 check (valor_entrega_aprovado_centimos >= 0),
  valor_taxa_processador_aprovado_centimos bigint not null default 0 check (valor_taxa_processador_aprovado_centimos >= 0),
  referencia_interna text not null unique,
  referencia_provedor text,
  chave_idempotencia uuid not null unique,
  solicitado_por uuid references auth.users(id) on delete set null,
  aprovado_por uuid references auth.users(id) on delete set null,
  solicitado_em timestamptz not null default now(),
  aprovado_em timestamptz,
  processado_em timestamptz,
  concluido_em timestamptz,
  recusado_em timestamptz,
  cancelado_em timestamptz,
  falhado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint reembolsos_valores_solicitados_consistentes check (
    valor_solicitado_centimos = valor_produtos_solicitado_centimos
      + valor_entrega_solicitado_centimos + valor_taxa_processador_solicitado_centimos
  ),
  constraint reembolsos_valores_aprovados_consistentes check (
    valor_aprovado_centimos = valor_produtos_aprovado_centimos
      + valor_entrega_aprovado_centimos + valor_taxa_processador_aprovado_centimos
  ),
  constraint reembolsos_aprovacao_nao_supera_solicitacao check (
    valor_aprovado_centimos <= valor_solicitado_centimos
  ),
  constraint reembolsos_produtos_aprovados_nao_superam_solicitados check (
    valor_produtos_aprovado_centimos <= valor_produtos_solicitado_centimos
  ),
  constraint reembolsos_entrega_aprovada_nao_supera_solicitada check (
    valor_entrega_aprovado_centimos <= valor_entrega_solicitado_centimos
  ),
  constraint reembolsos_taxa_aprovada_nao_supera_solicitada check (
    valor_taxa_processador_aprovado_centimos <= valor_taxa_processador_solicitado_centimos
  ),
  constraint reembolsos_valor_aprovado_por_estado check (
    (estado in ('aprovado', 'processando', 'concluido') and valor_aprovado_centimos > 0 and aprovado_em is not null)
    or (estado not in ('aprovado', 'processando', 'concluido') and valor_aprovado_centimos = 0)
  )
);

create table public.movimentos_financeiros (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid references public.pagamentos(id) on delete restrict,
  encomenda_id uuid not null references public.encomendas(id) on delete restrict,
  vendedor_id uuid references public.vendedores(id) on delete restrict,
  cliente_id uuid references public.clientes(id) on delete restrict,
  tipo_movimento text not null check (tipo_movimento in (
    'venda_registada', 'comissao_marketplace', 'reembolso_cliente', 'estorno_comissao',
    'credito_vendedor', 'repasse_vendedor', 'ajuste_credito', 'ajuste_debito'
  )),
  direcao text not null check (direcao in ('credito', 'debito')),
  entidade_debitada text not null check (entidade_debitada in ('cliente', 'vendedor', 'angrolink', 'sistema')),
  entidade_creditada text not null check (entidade_creditada in ('cliente', 'vendedor', 'angrolink', 'sistema')),
  moeda char(3) not null check (moeda = 'AOA'),
  valor_centimos bigint not null check (valor_centimos > 0),
  referencia_origem text not null,
  chave_idempotencia uuid unique,
  metadados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  constraint movimentos_entidades_distintas check (entidade_debitada <> entidade_creditada)
);

create index reembolsos_pagamento_pagamento_estado_idx on public.reembolsos_pagamento (pagamento_id, estado, criado_em desc);
create index reembolsos_pagamento_encomenda_idx on public.reembolsos_pagamento (encomenda_id, criado_em desc);
create index movimentos_financeiros_pagamento_criado_idx on public.movimentos_financeiros (pagamento_id, criado_em);
create index movimentos_financeiros_encomenda_criado_idx on public.movimentos_financeiros (encomenda_id, criado_em);
create index movimentos_financeiros_vendedor_criado_idx on public.movimentos_financeiros (vendedor_id, criado_em);

create trigger atualizar_reembolso_pagamento_em
before update on public.reembolsos_pagamento
for each row execute function public.atualizar_atualizado_em_financeiro();

create or replace function public.proteger_movimentos_financeiros_append_only()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Movimentos financeiros são append-only. Crie um movimento compensatório para corrigir saldos.';
end;
$$;

create trigger impedir_alteracao_movimento_financeiro
before update or delete on public.movimentos_financeiros
for each row execute function public.proteger_movimentos_financeiros_append_only();

-- Quando um movimento pertence a um pagamento, esse é a fonte canónica de
-- encomenda, cliente e vendedor. Valores ausentes são preenchidos; valores
-- divergentes são rejeitados antes de o ledger receber qualquer linha.
create or replace function public.validar_referencias_movimento_financeiro()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pagamento public.pagamentos%rowtype;
begin
  if new.pagamento_id is null then
    return new;
  end if;

  select * into v_pagamento from public.pagamentos where id = new.pagamento_id;
  if not found then
    raise exception 'Pagamento não encontrado para o movimento financeiro.';
  end if;
  if new.encomenda_id <> v_pagamento.encomenda_id then
    raise exception 'A encomenda do movimento deve corresponder à encomenda do pagamento.';
  end if;
  if new.vendedor_id is not null and new.vendedor_id <> v_pagamento.vendedor_id then
    raise exception 'O vendedor do movimento deve corresponder ao vendedor do pagamento.';
  end if;
  if new.cliente_id is not null and new.cliente_id <> v_pagamento.cliente_id then
    raise exception 'O cliente do movimento deve corresponder ao cliente do pagamento.';
  end if;

  new.vendedor_id := v_pagamento.vendedor_id;
  new.cliente_id := v_pagamento.cliente_id;
  return new;
end;
$$;

create trigger validar_referencias_movimento_financeiro
before insert on public.movimentos_financeiros
for each row execute function public.validar_referencias_movimento_financeiro();

-- Bloqueia excedentes mesmo sob concorrência: o pagamento pai é bloqueado
-- antes de somar reembolsos aprovados, em processamento ou concluídos.
create or replace function public.validar_limites_reembolso_pagamento()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pagamento public.pagamentos%rowtype;
  v_total_aprovado bigint;
  v_produtos_aprovados bigint;
  v_entrega_aprovada bigint;
  v_taxa_aprovada bigint;
begin
  select * into v_pagamento from public.pagamentos where id = new.pagamento_id for update;
  if not found then raise exception 'Pagamento não encontrado para o reembolso.'; end if;
  if new.encomenda_id <> v_pagamento.encomenda_id then raise exception 'O reembolso deve pertencer à encomenda do pagamento.'; end if;
  if new.valor_solicitado_centimos > v_pagamento.total_cliente_centimos
    or new.valor_produtos_solicitado_centimos > v_pagamento.subtotal_centimos - v_pagamento.desconto_centimos
    or new.valor_entrega_solicitado_centimos > v_pagamento.entrega_centimos
    or new.valor_taxa_processador_solicitado_centimos > v_pagamento.taxa_processador_centimos then
    raise exception 'O reembolso solicitado não pode exceder os valores da obrigação financeira.';
  end if;

  if new.estado in ('aprovado', 'processando', 'concluido') then
    if v_pagamento.estado not in ('confirmado', 'reembolsado_parcialmente', 'reembolsado') then
      raise exception 'Só é possível aprovar reembolso de pagamento confirmado.';
    end if;

    select
      coalesce(sum(valor_aprovado_centimos), 0),
      coalesce(sum(valor_produtos_aprovado_centimos), 0),
      coalesce(sum(valor_entrega_aprovado_centimos), 0),
      coalesce(sum(valor_taxa_processador_aprovado_centimos), 0)
    into v_total_aprovado, v_produtos_aprovados, v_entrega_aprovada, v_taxa_aprovada
    from public.reembolsos_pagamento
    where pagamento_id = new.pagamento_id
      and id is distinct from new.id
      and estado in ('aprovado', 'processando', 'concluido');

    if v_total_aprovado + new.valor_aprovado_centimos > v_pagamento.total_cliente_centimos
      or v_produtos_aprovados + new.valor_produtos_aprovado_centimos > v_pagamento.subtotal_centimos - v_pagamento.desconto_centimos
      or v_entrega_aprovada + new.valor_entrega_aprovado_centimos > v_pagamento.entrega_centimos
      or v_taxa_aprovada + new.valor_taxa_processador_aprovado_centimos > v_pagamento.taxa_processador_centimos then
      raise exception 'Os reembolsos aprovados não podem exceder os valores efetivamente pagos.';
    end if;
  end if;
  return new;
end;
$$;

create trigger validar_reembolso_pagamento
before insert or update on public.reembolsos_pagamento
for each row execute function public.validar_limites_reembolso_pagamento();

-- Cálculo interno sem alterar snapshots históricos. Cancelamento/recusa anulam
-- a comissão e o crédito comercial efetivo; reembolsos aprovados reduzem apenas
-- a base dos produtos, nunca a entrega ou taxa do processador.
create or replace function public.calcular_valores_financeiros_efetivos(p_pagamento_id uuid)
returns table (
  pagamento_id uuid,
  base_comissionavel_centimos bigint,
  reembolsos_produtos_centimos bigint,
  comissao_efetiva_centimos bigint,
  valor_vendedor_efetivo_centimos bigint,
  valor_logistica_efetivo_centimos bigint,
  reembolso_total_aprovado_centimos bigint
)
language sql stable security definer set search_path = public as $$
  with pagamento as (
    select p.*, e.estado as estado_encomenda
    from public.pagamentos p join public.encomendas e on e.id = p.encomenda_id
    where p.id = p_pagamento_id
  ), reembolsos as (
    select r.pagamento_id,
      coalesce(sum(r.valor_produtos_aprovado_centimos) filter (where r.estado in ('aprovado', 'processando', 'concluido')), 0)::bigint as produtos,
      coalesce(sum(r.valor_entrega_aprovado_centimos) filter (where r.estado in ('aprovado', 'processando', 'concluido')), 0)::bigint as entrega,
      coalesce(sum(r.valor_aprovado_centimos) filter (where r.estado in ('aprovado', 'processando', 'concluido')), 0)::bigint as total
    from public.reembolsos_pagamento r where r.pagamento_id = p_pagamento_id group by r.pagamento_id
  ), valores as (
    select p.*, coalesce(r.produtos, 0) as produtos_reembolsados, coalesce(r.entrega, 0) as entrega_reembolsada, coalesce(r.total, 0) as total_reembolsado,
      case when p.estado_encomenda in ('cancelada', 'recusada') then 0 else p.subtotal_centimos - p.desconto_centimos - coalesce(r.produtos, 0) end as base_efetiva
    from pagamento p left join reembolsos r on r.pagamento_id = p.id
  )
  select id, base_efetiva, produtos_reembolsados,
    (base_efetiva * comissao_bps_snapshot + 5000) / 10000,
    base_efetiva - ((base_efetiva * comissao_bps_snapshot + 5000) / 10000),
    case when estado_encomenda in ('cancelada', 'recusada') then 0 else valor_logistica_centimos - entrega_reembolsada end,
    total_reembolsado
  from valores;
$$;

alter table public.reembolsos_pagamento enable row level security;
alter table public.movimentos_financeiros enable row level security;
create policy reembolsos_pagamento_admin_leitura on public.reembolsos_pagamento for select to authenticated using (public.eh_admin());
create policy movimentos_financeiros_admin_leitura on public.movimentos_financeiros for select to authenticated using (public.eh_admin());

revoke all on table public.reembolsos_pagamento, public.movimentos_financeiros from public, anon, authenticated;
grant select on table public.reembolsos_pagamento, public.movimentos_financeiros to authenticated;
revoke all on function public.proteger_movimentos_financeiros_append_only() from public, anon, authenticated;
revoke all on function public.validar_referencias_movimento_financeiro() from public, anon, authenticated;
revoke all on function public.validar_limites_reembolso_pagamento() from public, anon, authenticated;
revoke all on function public.calcular_valores_financeiros_efetivos(uuid) from public, anon, authenticated;

commit;
