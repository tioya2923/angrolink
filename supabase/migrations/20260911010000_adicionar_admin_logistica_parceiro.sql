-- ANGROLINK — Bloco 4A: leituras administrativas de entregas e financeiro operacional.
-- Apenas projeções Admin-only; não cria remuneração, saldo, repasse ou ledger do parceiro.
begin;

create index if not exists atribuicoes_entrega_parceiro_atribuido_idx
  on public.atribuicoes_entrega_encomenda (parceiro_entrega_id, atribuido_em desc, id desc);

create or replace function public.obter_resumo_entregas_parceiro_admin(
  p_parceiro_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  if not exists (select 1 from public.parceiros_entrega where id = p_parceiro_id) then
    raise exception 'Entregador não encontrado.';
  end if;

  return (
    select jsonb_build_object(
      'total_entregas', count(*),
      'ativas', count(*) filter (where a.estado in ('atribuida', 'aceite', 'chegou_origem', 'recolhida', 'chegou_destino')),
      'concluidas', count(*) filter (where a.estado = 'concluida'),
      'recusadas', count(*) filter (where a.estado = 'recusada'),
      'canceladas', count(*) filter (where a.estado = 'cancelada')
    )
    from public.atribuicoes_entrega_encomenda a
    where a.parceiro_entrega_id = p_parceiro_id
  );
end;
$$;

create or replace function public.listar_entregas_parceiro_admin(
  p_parceiro_id uuid,
  p_limite integer default 20,
  p_offset integer default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  if not exists (select 1 from public.parceiros_entrega where id = p_parceiro_id) then
    raise exception 'Entregador não encontrado.';
  end if;

  return (
    with base as (
      select
        a.id as atribuicao_id,
        e.id as encomenda_id,
        e.codigo_publico,
        a.estado as estado_atribuicao,
        e.estado as estado_encomenda,
        vnd.id as vendedor_id,
        vnd.nome_comercial as vendedor_nome,
        c.id as cliente_id,
        c.nome as cliente_nome,
        ve.id as veiculo_id,
        ve.tipo_veiculo,
        ve.marca,
        ve.modelo,
        ve.matricula,
        a.atribuido_em,
        a.aceite_em,
        a.chegou_origem_em,
        a.recolhida_em,
        a.chegou_destino_em,
        a.recusado_em,
        a.cancelado_em,
        a.concluido_em
      from public.atribuicoes_entrega_encomenda a
      join public.encomendas e on e.id = a.encomenda_id
      join public.vendedores vnd on vnd.id = e.vendedor_id
      left join public.clientes c on c.id = e.cliente_id
      join public.veiculos_entrega ve on ve.id = a.veiculo_id
      where a.parceiro_entrega_id = p_parceiro_id
    ), pagina as (
      select * from base
      order by atribuido_em desc, atribuicao_id desc
      limit v_limite offset v_offset
    ), itens as (
      select coalesce(jsonb_agg(jsonb_build_object(
        'atribuicao_id', atribuicao_id,
        'encomenda_id', encomenda_id,
        'codigo_publico', coalesce(codigo_publico, encomenda_id::text),
        'estado_atribuicao', estado_atribuicao,
        'estado_encomenda', estado_encomenda,
        'vendedor_id', vendedor_id,
        'vendedor_nome', vendedor_nome,
        'cliente_id', cliente_id,
        'cliente_nome', cliente_nome,
        'veiculo_id', veiculo_id,
        'tipo_veiculo', tipo_veiculo,
        'marca', marca,
        'modelo', modelo,
        'matricula', matricula,
        'atribuido_em', atribuido_em,
        'aceite_em', aceite_em,
        'chegou_origem_em', chegou_origem_em,
        'recolhida_em', recolhida_em,
        'chegou_destino_em', chegou_destino_em,
        'recusado_em', recusado_em,
        'cancelado_em', cancelado_em,
        'concluido_em', concluido_em
      ) order by atribuido_em desc, atribuicao_id desc), '[]'::jsonb) as dados
      from pagina
    )
    select jsonb_build_object(
      'itens', itens.dados,
      'paginacao', jsonb_build_object(
        'total_resultados', (select count(*) from base),
        'limite', v_limite,
        'offset', v_offset
      )
    )
    from itens
  );
end;
$$;

create or replace function public.obter_resumo_financeiro_parceiro_admin(
  p_parceiro_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  if not exists (select 1 from public.parceiros_entrega where id = p_parceiro_id) then
    raise exception 'Entregador não encontrado.';
  end if;

  return (
    with entregas_concluidas as (
      select distinct a.encomenda_id
      from public.atribuicoes_entrega_encomenda a
      where a.parceiro_entrega_id = p_parceiro_id
        and a.estado = 'concluida'
    )
    select jsonb_build_object(
      'entregas_concluidas', count(e.id),
      'pagamentos_na_entrega_confirmados', count(e.id) filter (
        where exists (
          select 1
          from public.pagamentos p
          where p.encomenda_id = e.id
            and p.estado = 'confirmado'
            and exists (
              select 1
              from public.tentativas_pagamento t
              where t.pagamento_id = p.id
                and t.metodo = 'pagamento_na_entrega'
                and t.estado = 'confirmada'
            )
        )
      ),
      'volume_encomendas_entregues_centimos', coalesce(sum(e.total_centimos), 0),
      'valor_logistica_cobrado_centimos', coalesce(sum(e.entrega_centimos), 0),
      'remuneracao_configurada', false
    )
    from entregas_concluidas ec
    join public.encomendas e on e.id = ec.encomenda_id
  );
end;
$$;

revoke all on function public.obter_resumo_entregas_parceiro_admin(uuid) from public, anon;
revoke all on function public.listar_entregas_parceiro_admin(uuid, integer, integer) from public, anon;
revoke all on function public.obter_resumo_financeiro_parceiro_admin(uuid) from public, anon;
grant execute on function public.obter_resumo_entregas_parceiro_admin(uuid) to authenticated;
grant execute on function public.listar_entregas_parceiro_admin(uuid, integer, integer) to authenticated;
grant execute on function public.obter_resumo_financeiro_parceiro_admin(uuid) to authenticated;

commit;
