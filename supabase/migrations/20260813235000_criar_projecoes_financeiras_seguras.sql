-- ANGROLINK — projeções financeiras mínimas para a UI.
-- Não cria pagamentos, não confirma cobrança e não concede leitura direta
-- das tabelas financeiras protegidas.

begin;

-- Cliente: expõe apenas o pagamento da sua própria encomenda. Enquanto o
-- pagamento não está confirmado, o método é o da tentativa mais recente. Se
-- estiver confirmado, só uma tentativa confirmada pode representar o método.
-- A ausência desta tentativa é uma inconsistência que fica visível como método
-- nulo, em vez de mostrar um método antigo ou incorreto.
create or replace function public.obter_pagamento_encomenda_cliente(p_encomenda_id uuid)
returns table (
  pagamento_id uuid,
  encomenda_id uuid,
  estado_pagamento text,
  metodo_pagamento text,
  total_cliente_centimos bigint,
  moeda char(3),
  referencia_interna text,
  criado_em timestamptz,
  confirmado_em timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão para consultar o pagamento.';
  end if;

  return query
  select
    p.id,
    p.encomenda_id,
    p.estado,
    tentativa.metodo,
    p.total_cliente_centimos,
    p.moeda,
    p.referencia_interna,
    p.criado_em,
    p.confirmado_em
  from public.pagamentos p
  join public.encomendas e
    on e.id = p.encomenda_id
  left join lateral (
    select t.metodo
    from public.tentativas_pagamento t
    where t.pagamento_id = p.id
      and (p.estado <> 'confirmado' or t.estado = 'confirmada')
    order by t.criado_em desc
    limit 1
  ) tentativa on true
  where p.encomenda_id = p_encomenda_id
    and e.cliente_id = auth.uid();
end;
$$;

-- Vendedor: a consulta de histórico depende apenas de titularidade. A
-- elegibilidade transacional controla novas encomendas, não pode apagar a
-- visibilidade financeira de vendas legítimas após suspensão ou rejeição.
-- Os valores efetivos evitam comissão ou valor líquido desatualizados;
-- snapshots históricos continuam preservados em pagamentos.
create or replace function public.obter_resumo_financeiro_encomenda_vendedor(p_encomenda_id uuid)
returns table (
  pagamento_id uuid,
  encomenda_id uuid,
  estado_pagamento text,
  subtotal_centimos bigint,
  desconto_centimos bigint,
  base_comercial_centimos bigint,
  comissao_angrolink_centimos bigint,
  valor_vendedor_centimos bigint,
  entrega_centimos bigint,
  moeda char(3),
  estado_repasse text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão para consultar o resumo financeiro.';
  end if;

  return query
  select
    p.id,
    p.encomenda_id,
    p.estado,
    p.subtotal_centimos,
    p.desconto_centimos,
    valores.base_comissionavel_centimos,
    valores.comissao_efetiva_centimos,
    valores.valor_vendedor_efetivo_centimos,
    valores.valor_logistica_efetivo_centimos,
    p.moeda,
    repasse.estado
  from public.pagamentos p
  join public.vendedores v
    on v.id = p.vendedor_id
  join lateral public.calcular_valores_financeiros_efetivos(p.id) valores
    on true
  left join public.repasses_vendedor repasse
    on repasse.pagamento_id = p.id
  where p.encomenda_id = p_encomenda_id
    and v.user_id = auth.uid();
end;
$$;

revoke all on function public.obter_pagamento_encomenda_cliente(uuid) from public, anon;
revoke all on function public.obter_resumo_financeiro_encomenda_vendedor(uuid) from public, anon;
grant execute on function public.obter_pagamento_encomenda_cliente(uuid) to authenticated;
grant execute on function public.obter_resumo_financeiro_encomenda_vendedor(uuid) to authenticated;

commit;
