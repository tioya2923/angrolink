-- ANGROLINK — Admin Encomenda 360 e matching logístico explicável V1.
-- Esta migration apenas projecta informação administrativa. Não atribui,
-- reserva, tarifa ou altera qualquer entrega.

begin;

-- Mantém o contrato já consumido pelo Admin e acrescenta snapshots,
-- pagamento, origem/destino e requisitos operacionais seguros.
create or replace function public.obter_encomenda_admin(p_encomenda_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_resultado jsonb;
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  select jsonb_build_object(
    'encomenda', jsonb_build_object(
      'id', e.id, 'codigo_publico', e.codigo_publico, 'estado', e.estado,
      'modalidade', e.modalidade_recebimento, 'moeda', e.moeda,
      'criado_em', e.criado_em, 'atualizado_em', e.atualizado_em,
      'confirmado_em', e.confirmado_em, 'concluido_em', e.concluido_em,
      'recusado_em', e.recusado_em, 'cancelado_em', e.cancelado_em,
      'observacoes_cliente', e.observacoes_cliente,
      'motivo_cancelamento', e.motivo_cancelamento,
      'motivo_recusa', e.motivo_recusa
    ),
    'cliente', jsonb_build_object(
      'id', c.id, 'nome', c.nome, 'email', c.email, 'telefone', c.telefone,
      'tipo_comprador', c.tipo_comprador, 'provincia', c.provincia,
      'municipio', c.municipio, 'conta_ativa', c.conta_ativa
    ),
    'vendedor', jsonb_build_object(
      'id', v.id, 'nome_comercial', v.nome_comercial,
      'nome_responsavel', v.nome_responsavel,
      'telefone', coalesce(v.telefone_whatsapp, v.whatsapp),
      'email', v.email, 'provincia', v.provincia, 'municipio', v.municipio,
      'bairro', coalesce(v.bairro, v.mercado_bairro),
      'endereco_detalhado', v.endereco_detalhado,
      'estado', v.status_aprovacao, 'conta_ativa', v.conta_ativa
    ),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'nome', i.nome_produto_snapshot,
        'descricao', i.descricao_snapshot, 'imagem_url', i.imagem_principal_snapshot,
        'quantidade', i.quantidade, 'unidade', i.unidade,
        'valor_unitario_centimos', i.valor_unitario_centimos,
        'subtotal_centimos', i.subtotal_centimos, 'tipo_preco', i.tipo_preco_snapshot,
        'peso_por_unidade_comercial_kg', i.peso_por_unidade_comercial_kg_snapshot,
        'volume_por_unidade_comercial_m3', i.volume_por_unidade_comercial_m3_snapshot,
        'requer_refrigeracao', i.requer_refrigeracao_snapshot,
        'requer_caixa_carga', i.requer_caixa_carga_snapshot,
        'requer_paletes', i.requer_paletes_snapshot
      ) order by i.criado_em, i.id)
      from public.itens_encomenda i where i.encomenda_id = e.id
    ), '[]'::jsonb),
    'financeiro', coalesce((
      select jsonb_build_object(
        'pagamento_id', p.id, 'estado', p.estado, 'moeda', p.moeda,
        'subtotal_centimos', p.subtotal_centimos, 'desconto_centimos', p.desconto_centimos,
        'entrega_centimos', p.entrega_centimos, 'total_centimos', p.total_cliente_centimos,
        'taxa_processador_centimos', p.taxa_processador_centimos,
        'comissao_snapshot_centimos', p.comissao_angrolink_centimos,
        'comissao_efetiva_centimos', f.comissao_efetiva_centimos,
        'valor_vendedor_snapshot_centimos', p.valor_vendedor_centimos,
        'valor_vendedor_efetivo_centimos', f.valor_vendedor_efetivo_centimos,
        'reembolsos', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', rr.id, 'estado', rr.estado, 'valor_centimos', rr.valor_aprovado_centimos,
            'criado_em', rr.criado_em
          ) order by rr.criado_em)
          from public.reembolsos_pagamento rr where rr.pagamento_id = p.id
        ), '[]'::jsonb), 'repasse_estado', rp.estado
      )
      from public.pagamentos p
      join lateral public.calcular_valores_financeiros_efetivos(p.id) f on true
      left join public.repasses_vendedor rp on rp.pagamento_id = p.id
      where p.encomenda_id = e.id
    ), '{}'::jsonb),
    'pagamento', coalesce((
      select jsonb_build_object(
        'id', p.id, 'estado', p.estado, 'referencia_interna', p.referencia_interna,
        'criado_em', p.criado_em, 'confirmado_em', p.confirmado_em,
        'tentativas', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', t.id, 'metodo', t.metodo, 'estado', t.estado,
            'referencia_interna', t.referencia_interna, 'criado_em', t.criado_em,
            'atualizado_em', t.atualizado_em, 'mensagem_erro', t.mensagem_erro
          ) order by t.criado_em)
          from public.tentativas_pagamento t where t.pagamento_id = p.id
        ), '[]'::jsonb),
        'eventos', coalesce((
          select jsonb_agg(jsonb_build_object(
            'tipo', ep.tipo_evento, 'estado_anterior', ep.estado_anterior,
            'estado_novo', ep.estado_novo, 'ator', ep.ator_tipo,
            'ator_nome', pr.nome, 'criado_em', ep.criado_em
          ) order by ep.criado_em)
          from public.eventos_pagamento ep
          left join public.profiles pr on pr.id = ep.utilizador_id
          where ep.pagamento_id = p.id
        ), '[]'::jsonb)
      ) from public.pagamentos p where p.encomenda_id = e.id
    ), '{}'::jsonb),
    'origem', jsonb_build_object(
      'provincia', e.provincia, 'municipio', e.municipio, 'bairro', e.bairro,
      'endereco', e.endereco_levantamento, 'referencia', e.ponto_referencia
    ),
    'destino', coalesce((
      select jsonb_build_object(
        'destinatario_nome', d.destinatario_nome,
        'destinatario_telefone', d.destinatario_telefone,
        'provincia', d.provincia, 'municipio', d.municipio, 'bairro', d.bairro,
        'endereco', d.endereco_detalhado, 'referencia', d.ponto_referencia,
        'instrucoes', d.instrucoes_entrega
      ) from public.enderecos_entrega_encomenda d where d.encomenda_id = e.id
    ), '{}'::jsonb),
    'requisitos_logisticos', case when e.modalidade_recebimento = 'entrega' then coalesce((
      select jsonb_build_object(
        'peso_total_kg', r.peso_total_kg, 'peso_total_conhecido', r.peso_total_conhecido,
        'volume_total_m3', r.volume_total_m3, 'volume_total_conhecido', r.volume_total_conhecido,
        'requer_refrigeracao', r.requer_refrigeracao,
        'requer_caixa_carga', r.requer_caixa_carga,
        'requer_paletes', r.requer_paletes,
        'requisitos_especiais_conhecidos', r.requisitos_especiais_conhecidos
      ) from public.calcular_requisitos_logisticos_encomenda(e.id) r
    ), '{}'::jsonb) else '{}'::jsonb end,
    'atribuicao_entrega', jsonb_build_object('estado', 'nao_atribuido'),
    'levantamento', case when e.modalidade_recebimento = 'levantamento' then coalesce((
      select jsonb_build_object(
        'gerado_em', cl.gerado_em, 'expira_em', cl.expira_em, 'usado_em', cl.usado_em,
        'bloqueado_em', cl.bloqueado_em, 'tentativas', cl.tentativas,
        'max_tentativas', cl.max_tentativas
      ) from public.codigos_levantamento cl where cl.encomenda_id = e.id
    ), '{}'::jsonb) else '{}'::jsonb end,
    'eventos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tipo', x.tipo_evento, 'ator', x.ator_tipo,
        'ator_nome', pr.nome, 'estado_anterior', x.estado_anterior,
        'estado_novo', x.estado_novo, 'criado_em', x.criado_em,
        'metadados', case when x.metadados ? 'motivo'
          then jsonb_build_object('motivo', x.metadados -> 'motivo')
          else '{}'::jsonb end
      ) order by x.criado_em, x.id)
      from public.eventos_encomenda x
      left join public.profiles pr on pr.id = x.utilizador_id
      where x.encomenda_id = e.id
    ), '[]'::jsonb),
    'disputa', coalesce((
      select jsonb_build_object(
        'id', d.id, 'estado', d.estado, 'tipo', d.tipo_problema,
        'descricao', d.descricao, 'decisao', d.decisao,
        'analisado_por', d.analisado_por, 'analisado_em', d.analisado_em,
        'resolvido_em', d.resolvido_em
      ) from public.disputas_encomenda d
      where d.encomenda_id = e.id order by d.criado_em desc limit 1
    ), '{}'::jsonb)
  ) into v_resultado
  from public.encomendas e
  join public.clientes c on c.id = e.cliente_id
  join public.vendedores v on v.id = e.vendedor_id
  where e.id = p_encomenda_id;

  if v_resultado is null then raise exception 'Encomenda não encontrada.'; end if;
  return v_resultado;
end;
$$;

-- Carregada apenas pelo separador Logística. A avaliação ocorre numa única
-- consulta server-side e usa a fonte canónica já validada para compatibilidade.
create or replace function public.listar_compatibilidade_logistica_encomenda_admin(
  p_encomenda_id uuid
)
returns table (
  parceiro_id uuid, parceiro_nome text, veiculo_id uuid, tipo_veiculo text,
  matricula text, capacidade_kg numeric, capacidade_volume_m3 numeric,
  possui_refrigeracao boolean, possui_caixa_carga boolean, aceita_paletes boolean,
  areas_cobertura jsonb, estado text, motivos text[]
)
language plpgsql stable security definer set search_path = public
as $$
declare v_modalidade text;
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;
  select e.modalidade_recebimento into v_modalidade
  from public.encomendas e where e.id = p_encomenda_id;
  if not found then raise exception 'Encomenda não encontrada.'; end if;
  if v_modalidade <> 'entrega' then return; end if;

  return query
  select p.id, p.nome_completo, v.id, v.tipo_veiculo, v.matricula,
    v.capacidade_kg, v.capacidade_volume_m3, v.possui_refrigeracao,
    v.possui_caixa_carga, v.aceita_paletes,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'provincia', a.provincia, 'municipio', a.municipio, 'bairro', a.bairro
      ) order by a.provincia, a.municipio, a.bairro)
      from public.areas_cobertura_entrega a
      where a.parceiro_id = p.id and a.ativo
    ), '[]'::jsonb), compatibilidade.estado, compatibilidade.motivos
  from public.veiculos_entrega v
  join public.parceiros_entrega p on p.id = v.parceiro_id
  cross join lateral public.avaliar_compatibilidade_veiculo_encomenda(v.id, p_encomenda_id) compatibilidade
  order by
    case compatibilidade.estado when 'compativel' then 1 when 'dados_incompletos' then 2 else 3 end,
    p.nome_completo, v.matricula, v.id;
end;
$$;

revoke all on function public.obter_encomenda_admin(uuid) from public, anon;
revoke all on function public.listar_compatibilidade_logistica_encomenda_admin(uuid) from public, anon;
grant execute on function public.obter_encomenda_admin(uuid) to authenticated;
grant execute on function public.listar_compatibilidade_logistica_encomenda_admin(uuid) to authenticated;

commit;
