-- ANGROLINK — Vendedor 360 V1: projeções administrativas de leitura.
-- Não altera vendedores, documentos, pagamentos ou regras de aprovação.
begin;

-- Índices exclusivamente de leitura para as coleções administrativas paginadas.
create index if not exists documentos_vendedor_eventos_vendedor_criado_idx
  on public.documentos_vendedor_eventos (vendedor_id, criado_em desc);
create index if not exists encomendas_vendedor_atualizado_idx
  on public.encomendas (vendedor_id, atualizado_em desc);
create index if not exists pagamentos_vendedor_criado_idx
  on public.pagamentos (vendedor_id, criado_em desc);
create index if not exists disputas_encomenda_vendedor_atualizado_idx
  on public.disputas_encomenda (vendedor_id, atualizado_em desc);
create index if not exists produtos_vendedor_criado_idx
  on public.produtos (vendedor_id, criado_em desc);
create index if not exists servicos_vendedor_criado_idx
  on public.servicos (vendedor_id, criado_em desc);

create or replace function public.obter_vendedor_admin(p_vendedor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_resultado jsonb;
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  select jsonb_build_object(
    'vendedor', jsonb_build_object(
      'vendedor_id', v.id, 'user_id', v.user_id, 'nome_comercial', v.nome_comercial,
      'nome_responsavel', v.nome_responsavel, 'email', v.email,
      'telefone', coalesce(v.telefone_whatsapp, v.whatsapp), 'foto_url', v.foto_perfil,
      'criado_em', v.criado_em, 'tipo_vendedor', v.tipo_vendedor,
      'status_aprovacao', v.status_aprovacao, 'conta_ativa', coalesce(v.conta_ativa, false),
      'verificado', coalesce(v.verificado, false), 'plano', v.plano,
      'aprovado_em', v.aprovado_em, 'aprovado_por', v.aprovado_por,
      'motivo_rejeicao', v.motivo_rejeicao,
      'provincia', v.provincia, 'municipio', v.municipio, 'bairro', v.bairro,
      'mercado_bairro', v.mercado_bairro, 'mercado_localizado', v.mercado_localizado,
      'endereco_detalhado', v.endereco_detalhado,
      'pode_receber_encomendas', public.vendedor_pode_receber_encomendas(v.id),
      'motivo_inelegibilidade', case when public.vendedor_pode_receber_encomendas(v.id) then null
        when not coalesce(v.conta_ativa, false) then 'Conta inativa'
        when v.status_aprovacao is distinct from 'aprovado' then 'Vendedor não aprovado'
        when v.user_id is null then 'Sem conta autenticável associada'
        when not exists (select 1 from auth.users u where u.id = v.user_id) then 'Conta Auth não encontrada'
        when not exists (select 1 from public.profiles p where p.id = v.user_id and p.papel = 'vendedor' and coalesce(p.ativo, true) and p.apagado_em is null) then 'Perfil de vendedor inválido ou inativo'
        else 'Não elegível segundo a regra transacional atual' end,
      'documentos_legados_presentes', coalesce(v.documentos, '{}'::jsonb) <> '{}'::jsonb
    ),
    'dados_comerciais', jsonb_strip_nulls(jsonb_build_object(
      'descricao', v.descricao, 'horario_atendimento', v.horario_atendimento,
      'ano_inicio', v.ano_inicio, 'data_inicio_atividade', v.data_inicio_atividade,
      'entrega_disponivel', v.entrega_disponivel, 'entrega_outras_provincias', v.entrega_outras_provincias,
      'tipo_producao', v.tipo_producao, 'area_cultivada', v.area_cultivada,
      'principais_culturas', v.principais_culturas, 'producao_mensal', v.producao_mensal,
      'tipos_produtos', v.tipos_produtos, 'compra_produtores', v.compra_produtores,
      'volume_minimo', v.volume_minimo, 'venda_grosso', v.venda_grosso,
      'venda_retalho', v.venda_retalho, 'venda_presencial', v.venda_presencial,
      'tipo_loja', v.tipo_loja
    )),
    -- Documentos são uma coleção pequena e continuam completos. Nunca inclui paths ou URLs.
    'documentos', coalesce((select jsonb_agg(jsonb_build_object(
      'documento_id', d.id, 'tipo', d.tipo_documento, 'numero', d.numero_documento,
      'validade', d.validade, 'estado', d.estado, 'frente_disponivel', d.frente_path is not null,
      'verso_disponivel', d.verso_path is not null, 'criado_em', d.criado_em,
      'analisado_por', d.analisado_por, 'analisado_em', d.analisado_em,
      'motivo_rejeicao', d.motivo_rejeicao
    ) order by d.criado_em desc) from public.documentos_vendedor d where d.vendedor_id = v.id), '[]'::jsonb),
    -- O histórico completo é consultado na RPC paginada própria.
    'historico_documental_recente', coalesce((select jsonb_agg(item order by criado_em desc) from (
      select jsonb_build_object(
        'evento', de.evento, 'documento_id', de.documento_id, 'estado_anterior', de.estado_anterior,
        'estado_novo', de.estado_novo, 'motivo_rejeicao', de.motivo_rejeicao,
        'realizado_por', de.realizado_por, 'criado_em', de.criado_em
      ) as item, de.criado_em
      from public.documentos_vendedor_eventos de
      where de.vendedor_id = v.id
      order by de.criado_em desc
      limit 20
    ) historico), '[]'::jsonb),
    'resumo', jsonb_build_object(
      'total_produtos', (select count(*) from public.produtos p where p.vendedor_id = v.id),
      'total_servicos', (select count(*) from public.servicos s where s.vendedor_id = v.id),
      'total_encomendas', (select count(*) from public.encomendas e where e.vendedor_id = v.id),
      'total_pagamentos', (select count(*) from public.pagamentos p where p.vendedor_id = v.id),
      'total_disputas', (select count(*) from public.disputas_encomenda d where d.vendedor_id = v.id),
      'total_eventos_documentais', (select count(*) from public.documentos_vendedor_eventos de where de.vendedor_id = v.id)
    ),
    'financeiro', coalesce((
      with pagamentos_vendedor as (
        select p.id, p.estado, p.total_cliente_centimos,
          x.comissao_efetiva_centimos, x.valor_vendedor_efetivo_centimos,
          x.reembolso_total_aprovado_centimos
        from public.pagamentos p
        join lateral public.calcular_valores_financeiros_efetivos(p.id) x on true
        where p.vendedor_id = v.id
      ), financeiro_pagamentos as (
        select
          count(*)::bigint as total_pagamentos,
          coalesce(sum(total_cliente_centimos), 0)::bigint as gmv_bruto_centimos,
          coalesce(sum(greatest(total_cliente_centimos - reembolso_total_aprovado_centimos, 0)), 0)::bigint as gmv_efetivo_centimos,
          coalesce(sum(comissao_efetiva_centimos), 0)::bigint as comissao_centimos,
          coalesce(sum(valor_vendedor_efetivo_centimos), 0)::bigint as valor_vendedor_centimos,
          coalesce(sum(reembolso_total_aprovado_centimos), 0)::bigint as reembolsos_centimos,
          count(*) filter (where estado = 'pendente')::bigint as pagamentos_pendentes,
          count(*) filter (where estado = 'confirmado')::bigint as pagamentos_confirmados
        from pagamentos_vendedor
      ), repasses as (
        select count(*) filter (where r.estado = 'pendente')::bigint as pendentes,
          count(*) filter (where r.estado = 'concluido')::bigint as concluidos
        from public.repasses_vendedor r
        where r.vendedor_id = v.id
      )
      select jsonb_build_object(
        'total_encomendas', (select count(*) from public.encomendas e where e.vendedor_id = v.id),
        'total_pagamentos', fp.total_pagamentos,
        'gmv_bruto_centimos', fp.gmv_bruto_centimos,
        'gmv_efetivo_centimos', fp.gmv_efetivo_centimos,
        'comissao_centimos', fp.comissao_centimos,
        'valor_vendedor_centimos', fp.valor_vendedor_centimos,
        'reembolsos_centimos', fp.reembolsos_centimos,
        'pagamentos_pendentes', fp.pagamentos_pendentes,
        'pagamentos_confirmados', fp.pagamentos_confirmados,
        'repasses_pendentes', r.pendentes,
        'repasses_concluidos', r.concluidos
      ) from financeiro_pagamentos fp cross join repasses r
    ), '{}'::jsonb),
    'metricas', jsonb_build_object(
      'visualizacoes', coalesce((select sum(coalesce(p.visualizacoes,0)) from public.produtos p where p.vendedor_id=v.id),0) + coalesce((select sum(coalesce(s.visualizacoes,0)) from public.servicos s where s.vendedor_id=v.id),0),
      'cliques_whatsapp', coalesce((select sum(coalesce(p.cliques_whatsapp,0)) from public.produtos p where p.vendedor_id=v.id),0) + coalesce((select sum(coalesce(s.cliques_whatsapp,0)) from public.servicos s where s.vendedor_id=v.id),0),
      'contactos_recebidos', (select count(*) from public.historico_contactos h where h.vendedor_id=v.id) + (select count(*) from public.historico_contactos_servicos hs where hs.vendedor_id=v.id)
    ),
    'outros_papeis', jsonb_build_object(
      'cliente', exists(select 1 from public.clientes c where c.id=v.user_id),
      'parceiro_entrega', exists(select 1 from public.parceiros_entrega pe where pe.user_id=v.user_id),
      'admin', exists(select 1 from public.administradores a where a.user_id=v.user_id)
    ),
    'historico_administrativo_disponivel', false
  ) into v_resultado
  from public.vendedores v where v.id=p_vendedor_id;
  if v_resultado is null then raise exception 'Vendedor não encontrado.'; end if;
  return v_resultado;
end;
$$;

create or replace function public.listar_produtos_vendedor_admin(
  p_vendedor_id uuid, p_limite integer default 25, p_offset integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100); v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if not exists (select 1 from public.vendedores where id = p_vendedor_id) then raise exception 'Vendedor não encontrado.'; end if;
  return (with base as (
    select p.id, p.nome_produto, p.categoria_id, p.preco_aproximado, p.preco_promocional, p.preco_grosso, p.tipo_venda,
      coalesce(p.publicado,false) publicado, coalesce(p.disponivel,false) disponivel, coalesce(p.destaque,false) destaque,
      coalesce(p.visualizacoes,0) visualizacoes, coalesce(p.cliques_whatsapp,0) cliques_whatsapp, p.criado_em
    from public.produtos p where p.vendedor_id = p_vendedor_id
  ), pagina as (select * from base order by criado_em desc, id limit v_limite offset v_offset), itens as (
    select coalesce(jsonb_agg(jsonb_build_object('produto_id',id,'nome',nome_produto,'categoria_id',categoria_id,
      'preco_base',preco_aproximado,'preco_promocional',preco_promocional,'preco_grosso',preco_grosso,'tipo_venda',tipo_venda,
      'publicado',publicado,'disponivel',disponivel,'destaque',destaque,'visualizacoes',visualizacoes,'cliques_whatsapp',cliques_whatsapp,
      'criado_em',criado_em) order by criado_em desc, id), '[]'::jsonb) dados from pagina
  ) select jsonb_build_object('itens',itens.dados,'paginacao',jsonb_build_object('total_resultados',(select count(*) from base),'limite',v_limite,'offset',v_offset)) from itens);
end;
$$;

create or replace function public.listar_servicos_vendedor_admin(
  p_vendedor_id uuid, p_limite integer default 25, p_offset integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100); v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if not exists (select 1 from public.vendedores where id = p_vendedor_id) then raise exception 'Vendedor não encontrado.'; end if;
  return (with base as (
    select s.id, s.nome_servico, s.tipo_servico, s.preco_estimado, coalesce(s.publicado,false) publicado,
      coalesce(s.disponivel,false) disponivel, coalesce(s.destaque,false) destaque, coalesce(s.visualizacoes,0) visualizacoes,
      coalesce(s.cliques_whatsapp,0) cliques_whatsapp, s.criado_em from public.servicos s where s.vendedor_id = p_vendedor_id
  ), pagina as (select * from base order by criado_em desc, id limit v_limite offset v_offset), itens as (
    select coalesce(jsonb_agg(jsonb_build_object('servico_id',id,'nome',nome_servico,'tipo_servico',tipo_servico,
      'preco_estimado',preco_estimado,'publicado',publicado,'disponivel',disponivel,'destaque',destaque,
      'visualizacoes',visualizacoes,'cliques_whatsapp',cliques_whatsapp,'criado_em',criado_em) order by criado_em desc,id), '[]'::jsonb) dados from pagina
  ) select jsonb_build_object('itens',itens.dados,'paginacao',jsonb_build_object('total_resultados',(select count(*) from base),'limite',v_limite,'offset',v_offset)) from itens);
end;
$$;

create or replace function public.listar_encomendas_vendedor_admin(
  p_vendedor_id uuid, p_limite integer default 25, p_offset integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100); v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if not exists (select 1 from public.vendedores where id = p_vendedor_id) then raise exception 'Vendedor não encontrado.'; end if;
  return (with base as (
    select e.id, e.codigo_publico, c.id cliente_id, c.nome cliente_nome, e.criado_em, e.estado, e.total_centimos,
      pg.estado estado_pagamento, exists(select 1 from public.disputas_encomenda d where d.encomenda_id=e.id) tem_disputa
    from public.encomendas e join public.clientes c on c.id=e.cliente_id left join public.pagamentos pg on pg.encomenda_id=e.id
    where e.vendedor_id=p_vendedor_id
  ), pagina as (select * from base order by criado_em desc,id limit v_limite offset v_offset), itens as (
    select coalesce(jsonb_agg(jsonb_build_object('encomenda_id',id,'codigo_publico',codigo_publico,'cliente_id',cliente_id,
      'cliente_nome',cliente_nome,'criado_em',criado_em,'estado',estado,'total_centimos',total_centimos,
      'estado_pagamento',estado_pagamento,'tem_disputa',tem_disputa) order by criado_em desc,id),'[]'::jsonb) dados from pagina
  ) select jsonb_build_object('itens',itens.dados,'paginacao',jsonb_build_object('total_resultados',(select count(*) from base),'limite',v_limite,'offset',v_offset)) from itens);
end;
$$;

create or replace function public.listar_disputas_vendedor_admin(
  p_vendedor_id uuid, p_limite integer default 25, p_offset integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100); v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if not exists (select 1 from public.vendedores where id = p_vendedor_id) then raise exception 'Vendedor não encontrado.'; end if;
  return (with base as (
    select d.id, d.encomenda_id, e.codigo_publico, c.id cliente_id, c.nome cliente_nome, d.tipo_problema, d.estado, d.criado_em, d.atualizado_em
    from public.disputas_encomenda d join public.encomendas e on e.id=d.encomenda_id join public.clientes c on c.id=d.cliente_id
    where d.vendedor_id=p_vendedor_id
  ), pagina as (select * from base order by atualizado_em desc,id limit v_limite offset v_offset), itens as (
    select coalesce(jsonb_agg(jsonb_build_object('disputa_id',id,'encomenda_id',encomenda_id,'codigo_publico',codigo_publico,
      'cliente_id',cliente_id,'cliente_nome',cliente_nome,'tipo',tipo_problema,'estado',estado,'criado_em',criado_em,'atualizado_em',atualizado_em)
      order by atualizado_em desc,id),'[]'::jsonb) dados from pagina
  ) select jsonb_build_object('itens',itens.dados,'paginacao',jsonb_build_object('total_resultados',(select count(*) from base),'limite',v_limite,'offset',v_offset)) from itens);
end;
$$;

create or replace function public.listar_historico_documental_vendedor_admin(
  p_vendedor_id uuid, p_limite integer default 25, p_offset integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100); v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if not exists (select 1 from public.vendedores where id = p_vendedor_id) then raise exception 'Vendedor não encontrado.'; end if;
  return (with base as (
    select de.evento, de.documento_id, de.estado_anterior, de.estado_novo, de.motivo_rejeicao, de.realizado_por, de.criado_em, de.id
    from public.documentos_vendedor_eventos de where de.vendedor_id=p_vendedor_id
  ), pagina as (select * from base order by criado_em desc,id limit v_limite offset v_offset), itens as (
    select coalesce(jsonb_agg(jsonb_build_object('evento',evento,'documento_id',documento_id,'estado_anterior',estado_anterior,
      'estado_novo',estado_novo,'motivo_rejeicao',motivo_rejeicao,'realizado_por',realizado_por,'criado_em',criado_em)
      order by criado_em desc,id),'[]'::jsonb) dados from pagina
  ) select jsonb_build_object('itens',itens.dados,'paginacao',jsonb_build_object('total_resultados',(select count(*) from base),'limite',v_limite,'offset',v_offset)) from itens);
end;
$$;

revoke all on function public.obter_vendedor_admin(uuid) from public, anon;
revoke all on function public.listar_produtos_vendedor_admin(uuid, integer, integer) from public, anon;
revoke all on function public.listar_servicos_vendedor_admin(uuid, integer, integer) from public, anon;
revoke all on function public.listar_encomendas_vendedor_admin(uuid, integer, integer) from public, anon;
revoke all on function public.listar_disputas_vendedor_admin(uuid, integer, integer) from public, anon;
revoke all on function public.listar_historico_documental_vendedor_admin(uuid, integer, integer) from public, anon;
grant execute on function public.obter_vendedor_admin(uuid) to authenticated;
grant execute on function public.listar_produtos_vendedor_admin(uuid, integer, integer) to authenticated;
grant execute on function public.listar_servicos_vendedor_admin(uuid, integer, integer) to authenticated;
grant execute on function public.listar_encomendas_vendedor_admin(uuid, integer, integer) to authenticated;
grant execute on function public.listar_disputas_vendedor_admin(uuid, integer, integer) to authenticated;
grant execute on function public.listar_historico_documental_vendedor_admin(uuid, integer, integer) to authenticated;
commit;
