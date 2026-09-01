-- ANGROLINK — Compradores 360 V1.
-- Projeções administrativas de leitura; não altera contas, pagamentos ou documentos.
begin;

-- Os índices suportam a leitura administrativa sem alterar a visibilidade pública.
create index if not exists clientes_admin_filtros_idx
  on public.clientes (conta_ativa, tipo_comprador, provincia, municipio, criado_em desc);
create index if not exists encomendas_cliente_estado_atualizado_idx
  on public.encomendas (cliente_id, estado, atualizado_em desc);
create index if not exists pagamentos_cliente_criado_idx
  on public.pagamentos (cliente_id, criado_em desc);
create index if not exists disputas_encomenda_cliente_atualizado_idx
  on public.disputas_encomenda (cliente_id, atualizado_em desc);
create index if not exists historico_contactos_cliente_criado_idx
  on public.historico_contactos (cliente_id, criado_em desc);
create index if not exists historico_contactos_servicos_cliente_criado_idx
  on public.historico_contactos_servicos (cliente_id, criado_em desc);
create index if not exists favoritos_utilizador_criado_idx
  on public.favoritos (utilizador_id, criado_em desc);

create or replace function public.listar_compradores_admin(
  p_tipo_comprador text default null,
  p_conta_ativa boolean default null,
  p_provincia text default null,
  p_municipio text default null,
  p_com_disputas boolean default null,
  p_com_cancelamentos boolean default null,
  p_registo_recente boolean default null,
  p_pesquisa text default null,
  p_limite integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_pesquisa text := nullif(btrim(p_pesquisa), '');
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  if p_tipo_comprador is not null and p_tipo_comprador not in ('casa', 'negocio') then
    raise exception 'Tipo de comprador inválido.';
  end if;

  return (
    with base as (
      select
        c.id as cliente_id,
        c.id as user_id,
        coalesce(nullif(btrim(c.nome), ''), nullif(btrim(pr.nome), ''), 'Comprador sem nome') as nome,
        c.foto_perfil as foto_url,
        c.email,
        c.telefone,
        c.tipo_comprador,
        c.provincia,
        c.municipio,
        coalesce(c.conta_ativa, false) as conta_ativa,
        coalesce(c.criado_em, au.created_at) as criado_em,
        coalesce(en.total, 0)::bigint as total_encomendas,
        coalesce(en.concluidas, 0)::bigint as encomendas_concluidas,
        coalesce(en.canceladas, 0)::bigint as encomendas_canceladas,
        coalesce(di.total, 0)::bigint as total_disputas,
        coalesce(pg.total, 0)::bigint as total_pagamentos,
        atividade.ultima_atividade_em,
        concat_ws(' ', c.nome, c.email, c.telefone, c.telefone_nacional) as texto_pesquisa
      from public.clientes c
      join auth.users au on au.id = c.id
      left join public.profiles pr on pr.id = c.id
      left join lateral (
        select
          count(*) as total,
          count(*) filter (where e.estado = 'concluida') as concluidas,
          count(*) filter (where e.estado = 'cancelada') as canceladas,
          max(e.atualizado_em) as ultima_encomenda_em
        from public.encomendas e
        where e.cliente_id = c.id
      ) en on true
      left join lateral (
        select count(*) as total, max(d.atualizado_em) as ultima_disputa_em
        from public.disputas_encomenda d
        where d.cliente_id = c.id
      ) di on true
      left join lateral (
        select count(*) as total, max(p.criado_em) as ultimo_pagamento_em
        from public.pagamentos p
        where p.cliente_id = c.id
      ) pg on true
      left join lateral (
        select max(x.ocorrido_em) as ultima_atividade_em
        from (
          select c.criado_em as ocorrido_em
          union all select en.ultima_encomenda_em
          union all select di.ultima_disputa_em
          union all select pg.ultimo_pagamento_em
          union all select max(h.criado_em) from public.historico_contactos h where h.cliente_id = c.id
          union all select max(hs.criado_em) from public.historico_contactos_servicos hs where hs.cliente_id = c.id
          union all select max(f.criado_em) from public.favoritos f where f.utilizador_id = c.id
        ) x
      ) atividade on true
    ), filtrados as (
      select * from base
      where (p_tipo_comprador is null or tipo_comprador = p_tipo_comprador)
        and (p_conta_ativa is null or conta_ativa = p_conta_ativa)
        and (p_provincia is null or provincia = p_provincia)
        and (p_municipio is null or municipio = p_municipio)
        and (p_com_disputas is null or (total_disputas > 0) = p_com_disputas)
        and (p_com_cancelamentos is null or (encomendas_canceladas > 0) = p_com_cancelamentos)
        and (p_registo_recente is not true or criado_em >= now() - interval '30 days')
        and (v_pesquisa is null or lower(texto_pesquisa) like '%' || lower(v_pesquisa) || '%')
    ), contagens as (
      select
        count(*)::bigint as total,
        count(*) filter (where conta_ativa)::bigint as ativos,
        count(*) filter (where not conta_ativa)::bigint as inativos,
        count(*) filter (where tipo_comprador = 'casa')::bigint as casa,
        count(*) filter (where tipo_comprador = 'negocio')::bigint as negocio,
        count(*) filter (where total_disputas > 0)::bigint as com_disputas
      from base
    ), total_filtrado as (
      select count(*)::bigint as total_resultados from filtrados
    ), pagina as (
      select * from filtrados
      order by coalesce(ultima_atividade_em, criado_em) desc, cliente_id
      limit v_limite offset v_offset
    ), itens as (
      select coalesce(jsonb_agg(jsonb_build_object(
        'cliente_id', cliente_id,
        'user_id', user_id,
        'nome', nome,
        'foto_url', foto_url,
        'email', email,
        'telefone', telefone,
        'tipo_comprador', tipo_comprador,
        'provincia', provincia,
        'municipio', municipio,
        'conta_ativa', conta_ativa,
        'criado_em', criado_em,
        'total_encomendas', total_encomendas,
        'encomendas_concluidas', encomendas_concluidas,
        'encomendas_canceladas', encomendas_canceladas,
        'total_disputas', total_disputas,
        'total_pagamentos', total_pagamentos,
        'ultima_atividade_em', ultima_atividade_em
      ) order by coalesce(ultima_atividade_em, criado_em) desc, cliente_id), '[]'::jsonb) as dados
      from pagina
    )
    select jsonb_build_object(
      'itens', i.dados,
      'paginacao', jsonb_build_object(
        'total_resultados', t.total_resultados,
        'limite', v_limite,
        'offset', v_offset
      ),
      'contagens', jsonb_build_object(
        'total', c.total,
        'ativos', c.ativos,
        'inativos', c.inativos,
        'casa', c.casa,
        'negocio', c.negocio,
        'com_disputas', c.com_disputas
      )
    )
    from itens i
    cross join contagens c
    cross join total_filtrado t
  );
end;
$$;

create or replace function public.obter_comprador_admin(p_cliente_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_resultado jsonb;
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  select jsonb_build_object(
    'comprador', jsonb_build_object(
      'cliente_id', c.id,
      'user_id', c.id,
      'nome', coalesce(nullif(btrim(c.nome), ''), nullif(btrim(pr.nome), ''), 'Comprador sem nome'),
      'foto_url', c.foto_perfil,
      'email', c.email,
      'telefone', c.telefone,
      'tipo_comprador', c.tipo_comprador,
      'provincia', c.provincia,
      'municipio', c.municipio,
      'conta_ativa', coalesce(c.conta_ativa, false),
      'criado_em', coalesce(c.criado_em, au.created_at),
      'ultima_atividade_em', atividade.ultima_atividade_em
    ),
    'outros_papeis', coalesce((
      select jsonb_agg(papel.item)
      from (
        select jsonb_build_object(
          'papel', 'vendedor', 'id', v.id,
          'estado', case when v.status_aprovacao = 'aprovado' and coalesce(v.conta_ativa, false) then 'ativo'
            when v.status_aprovacao = 'pendente' then 'pendente'
            when v.status_aprovacao = 'suspenso' then 'suspenso'
            when v.status_aprovacao = 'rejeitado' then 'rejeitado' else 'inativo' end
        ) as item where v.id is not null
        union all
        select jsonb_build_object(
          'papel', 'parceiro_entrega', 'id', pe.id,
          'estado', case when pe.estado = 'aprovado' then 'ativo'
            when pe.estado in ('rascunho', 'documentos_pendentes', 'em_analise') then 'pendente'
            when pe.estado in ('suspenso', 'documentacao_expirada') then 'suspenso'
            when pe.estado = 'rejeitado' then 'rejeitado' else 'inativo' end
        ) where pe.id is not null
        union all
        select jsonb_build_object('papel', 'admin', 'id', a.user_id, 'estado', 'ativo')
        where a.user_id is not null
      ) papel
    ), '[]'::jsonb),
    'resumo', jsonb_build_object(
      'total_encomendas', coalesce(en.total, 0),
      'encomendas_concluidas', coalesce(en.concluidas, 0),
      'encomendas_canceladas', coalesce(en.canceladas, 0),
      'recusas_vendedor', coalesce(en.recusadas, 0),
      'total_disputas', coalesce(di.total, 0),
      'disputas_abertas', coalesce(di.abertas, 0),
      'disputas_em_analise', coalesce(di.em_analise, 0),
      'disputas_resolvidas', coalesce(di.resolvidas, 0),
      'total_pagamentos', coalesce(pg.total, 0),
      'contactos_iniciados', coalesce(at.contactos, 0),
      'favoritos', coalesce(at.favoritos, 0)
    ),
    'encomendas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'encomenda_id', e.id, 'codigo_publico', e.codigo_publico,
        'vendedor_id', v2.id, 'vendedor_nome', v2.nome_comercial,
        'criado_em', e.criado_em, 'estado', e.estado,
        'total_centimos', e.total_centimos, 'modalidade', e.modalidade_recebimento,
        'estado_pagamento', p.estado, 'tem_disputa', exists (
          select 1 from public.disputas_encomenda d where d.encomenda_id = e.id
        )
      ) order by e.criado_em desc)
      from public.encomendas e
      join public.vendedores v2 on v2.id = e.vendedor_id
      left join public.pagamentos p on p.encomenda_id = e.id
      where e.cliente_id = c.id
    ), '[]'::jsonb),
    'cancelamentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'encomenda_id', e.id, 'codigo_publico', e.codigo_publico,
        'vendedor_id', v2.id, 'vendedor_nome', v2.nome_comercial,
        'motivo', e.motivo_cancelamento, 'cancelado_em', e.cancelado_em
      ) order by e.cancelado_em desc)
      from public.encomendas e
      join public.vendedores v2 on v2.id = e.vendedor_id
      where e.cliente_id = c.id and e.estado = 'cancelada'
    ), '[]'::jsonb),
    'recusas_vendedor', coalesce((
      select jsonb_agg(jsonb_build_object(
        'encomenda_id', e.id, 'codigo_publico', e.codigo_publico,
        'vendedor_id', v2.id, 'vendedor_nome', v2.nome_comercial,
        'motivo', e.motivo_recusa, 'recusado_em', e.recusado_em
      ) order by e.recusado_em desc)
      from public.encomendas e
      join public.vendedores v2 on v2.id = e.vendedor_id
      where e.cliente_id = c.id and e.estado = 'recusada'
    ), '[]'::jsonb),
    'pagamentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pagamento_id', p.id, 'encomenda_id', p.encomenda_id, 'codigo_publico', e.codigo_publico,
        'estado', p.estado, 'metodo', tentativa.metodo,
        'total_centimos', p.total_cliente_centimos, 'criado_em', p.criado_em,
        'total_reembolsado_centimos', coalesce(reembolso.total, 0),
        'tem_reembolso', coalesce(reembolso.total, 0) > 0
      ) order by p.criado_em desc)
      from public.pagamentos p
      join public.encomendas e on e.id = p.encomenda_id
      left join lateral (
        select t.metodo
        from public.tentativas_pagamento t
        where t.pagamento_id = p.id
          and (p.estado <> 'confirmado' or t.estado = 'confirmada')
        order by t.criado_em desc
        limit 1
      ) tentativa on true
      left join lateral (
        select sum(r.valor_aprovado_centimos)::bigint as total
        from public.reembolsos_pagamento r
        where r.pagamento_id = p.id and r.estado in ('aprovado', 'processado', 'concluido')
      ) reembolso on true
      where p.cliente_id = c.id
    ), '[]'::jsonb),
    'disputas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'disputa_id', d.id, 'encomenda_id', d.encomenda_id, 'codigo_publico', e.codigo_publico,
        'vendedor_id', v2.id, 'vendedor_nome', v2.nome_comercial,
        'tipo', d.tipo_problema, 'estado', d.estado, 'criado_em', d.criado_em
      ) order by d.criado_em desc)
      from public.disputas_encomenda d
      join public.encomendas e on e.id = d.encomenda_id
      join public.vendedores v2 on v2.id = d.vendedor_id
      where d.cliente_id = c.id
    ), '[]'::jsonb),
    'atividade', jsonb_build_object(
      'contactos_produtos', coalesce(at.contactos_produtos, 0),
      'contactos_servicos', coalesce(at.contactos_servicos, 0),
      'favoritos', coalesce(at.favoritos, 0),
      'ultima_atividade_em', atividade.ultima_atividade_em
    )
  ) into v_resultado
  from public.clientes c
  join auth.users au on au.id = c.id
  left join public.profiles pr on pr.id = c.id
  left join lateral (select * from public.vendedores where user_id = c.id order by criado_em desc limit 1) v on true
  left join lateral (select * from public.parceiros_entrega where user_id = c.id order by criado_em desc limit 1) pe on true
  left join public.administradores a on a.user_id = c.id
  left join lateral (
    select count(*) as total,
      count(*) filter (where estado = 'concluida') as concluidas,
      count(*) filter (where estado = 'cancelada') as canceladas,
      count(*) filter (where estado = 'recusada') as recusadas,
      max(atualizado_em) as ultima_encomenda_em
    from public.encomendas where cliente_id = c.id
  ) en on true
  left join lateral (
    select count(*) as total,
      count(*) filter (where estado = 'aberta') as abertas,
      count(*) filter (where estado = 'em_analise') as em_analise,
      count(*) filter (where estado like 'resolvida%') as resolvidas,
      max(atualizado_em) as ultima_disputa_em
    from public.disputas_encomenda where cliente_id = c.id
  ) di on true
  left join lateral (
    select count(*) as total, max(criado_em) as ultimo_pagamento_em
    from public.pagamentos where cliente_id = c.id
  ) pg on true
  left join lateral (
    select
      count(*) filter (where origem = 'produto') as contactos_produtos,
      count(*) filter (where origem = 'servico') as contactos_servicos,
      count(*) filter (where origem in ('produto', 'servico')) as contactos,
      count(*) filter (where origem = 'favorito') as favoritos
    from (
      select 'produto'::text as origem from public.historico_contactos h where h.cliente_id = c.id
      union all select 'servico'::text from public.historico_contactos_servicos hs where hs.cliente_id = c.id
      union all select 'favorito'::text from public.favoritos f where f.utilizador_id = c.id
    ) atividade_contagem
  ) at on true
  left join lateral (
    select max(x.ocorrido_em) as ultima_atividade_em
    from (
      select c.criado_em as ocorrido_em
      union all select en.ultima_encomenda_em
      union all select di.ultima_disputa_em
      union all select pg.ultimo_pagamento_em
      union all select max(h.criado_em) from public.historico_contactos h where h.cliente_id = c.id
      union all select max(hs.criado_em) from public.historico_contactos_servicos hs where hs.cliente_id = c.id
      union all select max(f.criado_em) from public.favoritos f where f.utilizador_id = c.id
    ) x
  ) atividade on true
  where c.id = p_cliente_id;

  if v_resultado is null then
    raise exception 'Comprador não encontrado.';
  end if;
  return v_resultado;
end;
$$;

revoke all on function public.listar_compradores_admin(text, boolean, text, text, boolean, boolean, boolean, text, integer, integer)
  from public, anon;
revoke all on function public.obter_comprador_admin(uuid) from public, anon;
grant execute on function public.listar_compradores_admin(text, boolean, text, text, boolean, boolean, boolean, text, integer, integer)
  to authenticated;
grant execute on function public.obter_comprador_admin(uuid) to authenticated;

commit;
