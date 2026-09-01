-- ANGROLINK — ciclo de entrega, fase 1: visibilidade segura e notificações.
begin;

-- Projeção deliberadamente limitada para os participantes comerciais.
-- O parceiro só é identificado depois de aceitar a tarefa; documentos e contactos
-- pessoais não fazem parte deste contrato.
create or replace function public.obter_entrega_encomenda_participante(
  p_encomenda_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_encomenda public.encomendas%rowtype;
  v_atribuicao public.atribuicoes_entrega_encomenda%rowtype;
  v_e_vendedor boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  select e.* into v_encomenda
  from public.encomendas e
  where e.id = p_encomenda_id;

  if not found then
    raise exception 'Encomenda não encontrada.';
  end if;

  select exists (
    select 1
    from public.vendedores v
    where v.id = v_encomenda.vendedor_id
      and v.user_id = auth.uid()
  ) into v_e_vendedor;

  if v_encomenda.cliente_id <> auth.uid() and not v_e_vendedor then
    raise exception 'Sem permissão para consultar a entrega.';
  end if;

  if v_encomenda.modalidade_recebimento <> 'entrega' then
    return jsonb_build_object('estado', 'nao_aplicavel');
  end if;

  select a.* into v_atribuicao
  from public.atribuicoes_entrega_encomenda a
  where a.encomenda_id = v_encomenda.id
  order by a.atribuido_em desc, a.id desc
  limit 1;

  if not found then
    return jsonb_build_object('estado', 'nao_atribuido');
  end if;

  if v_atribuicao.estado = 'aceite' then
    return (
      select jsonb_build_object(
        'atribuicao_id', a.id,
        'estado', a.estado,
        'atribuido_em', a.atribuido_em,
        'aceite_em', a.aceite_em,
        'parceiro_entrega_id', p.id,
        'nome_entregador', p.nome_completo,
        'veiculo', jsonb_build_object(
          'tipo_veiculo', v.tipo_veiculo,
          'marca', v.marca,
          'modelo', v.modelo,
          'matricula', v.matricula,
          'capacidade_kg', v.capacidade_kg,
          'capacidade_volume_m3', v.capacidade_volume_m3
        )
      )
      from public.atribuicoes_entrega_encomenda a
      join public.parceiros_entrega p on p.id = a.parceiro_entrega_id
      join public.veiculos_entrega v on v.id = a.veiculo_id
      where a.id = v_atribuicao.id
    );
  end if;

  -- Só o vendedor recebe o motivo operacional da recusa; o comprador recebe
  -- apenas o estado e a plataforma procura uma nova atribuição.
  return jsonb_build_object(
    'atribuicao_id', v_atribuicao.id,
    'estado', v_atribuicao.estado,
    'atribuido_em', v_atribuicao.atribuido_em,
    'recusado_em', v_atribuicao.recusado_em,
    'motivo_recusa', case when v_e_vendedor and v_atribuicao.estado = 'recusada'
      then v_atribuicao.motivo_recusa
      else null
    end
  );
end;
$$;

-- A tarefa pertence sempre ao parceiro autenticado. Antes do aceite, a resposta
-- contém só informação territorial para decidir; depois, devolve os dados
-- operacionais necessários para recolha e entrega.
create or replace function public.obter_tarefa_entregador(p_atribuicao_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_resultado jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  select jsonb_build_object(
    'tarefa', jsonb_build_object(
      'id', a.id,
      'estado', a.estado,
      'atribuido_em', a.atribuido_em,
      'aceite_em', a.aceite_em,
      'recusado_em', a.recusado_em,
      'motivo_recusa', a.motivo_recusa
    ),
    'encomenda', jsonb_build_object(
      'id', e.id,
      'codigo_publico', e.codigo_publico,
      'estado', e.estado,
      'modalidade', e.modalidade_recebimento
    ),
    'veiculo', jsonb_build_object('tipo', v.tipo_veiculo, 'matricula', v.matricula),
    'origem', jsonb_build_object(
      'nome_vendedor', case when a.estado = 'aceite' then ven.nome_comercial else null end,
      'telefone', case when a.estado = 'aceite' then coalesce(ven.telefone_whatsapp, ven.whatsapp) else null end,
      'provincia', e.provincia,
      'municipio', e.municipio,
      'bairro', e.bairro,
      'endereco', case when a.estado = 'aceite' then e.endereco_levantamento else null end,
      'referencia', case when a.estado = 'aceite' then e.ponto_referencia else null end
    ),
    'destino', jsonb_build_object(
      'nome', case when a.estado = 'aceite' then d.destinatario_nome else null end,
      'telefone', case when a.estado = 'aceite' then d.destinatario_telefone else null end,
      'provincia', d.provincia,
      'municipio', d.municipio,
      'bairro', d.bairro,
      'endereco', case when a.estado = 'aceite' then d.endereco_detalhado else null end,
      'referencia', case when a.estado = 'aceite' then d.ponto_referencia else null end,
      'instrucoes', case when a.estado = 'aceite' then d.instrucoes_entrega else null end
    ),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nome', i.nome_produto_snapshot,
        'quantidade', i.quantidade,
        'unidade', i.unidade
      ) order by i.criado_em, i.id)
      from public.itens_encomenda i
      where i.encomenda_id = e.id
    ), '[]'::jsonb),
    'requisitos_logisticos', coalesce((
      select jsonb_build_object(
        'peso_total_kg', r.peso_total_kg,
        'peso_total_conhecido', r.peso_total_conhecido,
        'volume_total_m3', r.volume_total_m3,
        'volume_total_conhecido', r.volume_total_conhecido,
        'requer_refrigeracao', r.requer_refrigeracao,
        'requer_caixa_carga', r.requer_caixa_carga,
        'requer_paletes', r.requer_paletes
      )
      from public.calcular_requisitos_logisticos_encomenda(e.id) r
    ), '{}'::jsonb)
  ) into v_resultado
  from public.atribuicoes_entrega_encomenda a
  join public.parceiros_entrega p on p.id = a.parceiro_entrega_id
  join public.encomendas e on e.id = a.encomenda_id
  join public.vendedores ven on ven.id = e.vendedor_id
  join public.veiculos_entrega v on v.id = a.veiculo_id
  left join public.enderecos_entrega_encomenda d on d.encomenda_id = e.id
  where a.id = p_atribuicao_id
    and p.user_id = auth.uid();

  if v_resultado is null then
    raise exception 'Tarefa não encontrada ou sem permissão.';
  end if;

  return v_resultado;
end;
$$;

-- As notificações derivam sempre dos eventos server-side. Falhas continuam
-- isoladas para não invalidar a transação comercial principal.
create or replace function public.notificar_evento_encomenda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encomenda public.encomendas%rowtype;
  v_destinatario_id uuid;
  v_atribuicao_id uuid;
  v_url_comprador text;
  v_url_vendedor text;
begin
  begin
    select * into v_encomenda
    from public.encomendas
    where id = new.encomenda_id;

    if not found then
      raise warning 'Notificação ignorada: encomenda do evento % não encontrada.', new.id;
      return new;
    end if;

    select case when exists (
      select 1 from public.vendedores v where v.user_id = v_encomenda.cliente_id
    ) then '/dashboard/compras/' || v_encomenda.id
    else '/dashboard/encomendas/' || v_encomenda.id end
    into v_url_comprador;
    v_url_vendedor := '/dashboard/encomendas/' || v_encomenda.id;

    if new.tipo_evento = 'encomenda_criada' then
      select v.user_id into v_destinatario_id from public.vendedores v where v.id = v_encomenda.vendedor_id;
      if v_destinatario_id is not null then
        perform public.criar_notificacao(v_destinatario_id, 'venda', 'nova_encomenda', 'Nova encomenda recebida', 'Recebeste uma nova encomenda.', 'encomenda', v_encomenda.id, v_url_vendedor, '{}'::jsonb, 'encomenda:' || new.id || ':vendedor');
      end if;
    elsif new.tipo_evento = 'entregador_atribuido' then
      begin
        v_atribuicao_id := nullif(new.metadados ->> 'atribuicao_id', '')::uuid;
      exception when invalid_text_representation then
        raise warning 'Notificação de entrega ignorada: atribuição inválida no evento %.', new.id;
        return new;
      end;
      if v_atribuicao_id is null then
        raise warning 'Notificação de entrega ignorada: atribuição ausente no evento %.', new.id;
        return new;
      end if;
      select p.user_id into v_destinatario_id
      from public.atribuicoes_entrega_encomenda a
      join public.parceiros_entrega p on p.id = a.parceiro_entrega_id
      where a.id = v_atribuicao_id;
      if v_destinatario_id is not null then
        perform public.criar_notificacao(v_destinatario_id, 'entrega', 'nova_tarefa', 'Nova entrega atribuída', 'Tens uma nova tarefa de entrega para analisar.', 'atribuicao_entrega', v_atribuicao_id, '/dashboard/tarefas/' || v_atribuicao_id, '{}'::jsonb, 'encomenda:' || new.id || ':entregador');
      end if;
      if v_encomenda.cliente_id is not null then
        perform public.criar_notificacao(v_encomenda.cliente_id, 'compra', 'entregador_atribuido', 'Entregador atribuído', 'Foi atribuído um entregador à tua encomenda. Aguardamos a confirmação da tarefa.', 'encomenda', v_encomenda.id, v_url_comprador, '{}'::jsonb, 'encomenda:' || new.id || ':cliente');
      end if;
      select v.user_id into v_destinatario_id from public.vendedores v where v.id = v_encomenda.vendedor_id;
      if v_destinatario_id is not null then
        perform public.criar_notificacao(v_destinatario_id, 'venda', 'entregador_atribuido', 'Entregador atribuído', 'Foi atribuído um entregador à tua encomenda.', 'encomenda', v_encomenda.id, v_url_vendedor, '{}'::jsonb, 'encomenda:' || new.id || ':vendedor');
      end if;
    elsif new.tipo_evento in ('vendedor_confirmou', 'vendedor_recusou', 'pronta_para_levantamento', 'entregador_aceitou', 'entregador_recusou') then
      if new.tipo_evento in ('entregador_aceitou', 'entregador_recusou') and v_encomenda.modalidade_recebimento <> 'entrega' then
        raise warning 'Notificação logística ignorada: evento % não pertence a uma entrega.', new.id;
        return new;
      end if;
      if v_encomenda.cliente_id is not null then
        if new.tipo_evento = 'vendedor_confirmou' then
          perform public.criar_notificacao(v_encomenda.cliente_id, 'compra', new.tipo_evento, 'Encomenda confirmada', 'O vendedor confirmou a tua encomenda.', 'encomenda', v_encomenda.id, v_url_comprador, '{}'::jsonb, 'encomenda:' || new.id || ':cliente');
        elsif new.tipo_evento = 'vendedor_recusou' then
          perform public.criar_notificacao(v_encomenda.cliente_id, 'compra', new.tipo_evento, 'Encomenda recusada', 'O vendedor não conseguiu aceitar a tua encomenda.', 'encomenda', v_encomenda.id, v_url_comprador, '{}'::jsonb, 'encomenda:' || new.id || ':cliente');
        elsif new.tipo_evento = 'pronta_para_levantamento' then
          perform public.criar_notificacao(v_encomenda.cliente_id, 'compra', new.tipo_evento, 'Encomenda pronta', case when v_encomenda.modalidade_recebimento = 'entrega' then 'A tua encomenda está pronta para recolha pelo entregador.' else 'A tua encomenda está pronta para levantamento.' end, 'encomenda', v_encomenda.id, v_url_comprador, '{}'::jsonb, 'encomenda:' || new.id || ':cliente');
        elsif new.tipo_evento = 'entregador_aceitou' then
          perform public.criar_notificacao(v_encomenda.cliente_id, 'compra', new.tipo_evento, 'Entregador confirmado', 'O entregador aceitou a tua tarefa de entrega.', 'encomenda', v_encomenda.id, v_url_comprador, '{}'::jsonb, 'encomenda:' || new.id || ':cliente');
        else
          perform public.criar_notificacao(v_encomenda.cliente_id, 'compra', new.tipo_evento, 'A procurar outro entregador', 'Estamos a procurar outro entregador para a tua encomenda.', 'encomenda', v_encomenda.id, v_url_comprador, '{}'::jsonb, 'encomenda:' || new.id || ':cliente');
        end if;
      end if;
      if new.tipo_evento in ('entregador_aceitou', 'entregador_recusou') then
        select v.user_id into v_destinatario_id from public.vendedores v where v.id = v_encomenda.vendedor_id;
        if v_destinatario_id is not null then
          if new.tipo_evento = 'entregador_aceitou' then
            perform public.criar_notificacao(v_destinatario_id, 'venda', new.tipo_evento, 'Entregador aceitou a tarefa', 'O entregador aceitou a tarefa da tua encomenda.', 'encomenda', v_encomenda.id, v_url_vendedor, '{}'::jsonb, 'encomenda:' || new.id || ':vendedor');
          else
            perform public.criar_notificacao(v_destinatario_id, 'venda', new.tipo_evento, 'Entregador recusou a tarefa', 'O entregador recusou a tarefa. A encomenda aguarda nova atribuição.', 'encomenda', v_encomenda.id, v_url_vendedor, '{}'::jsonb, 'encomenda:' || new.id || ':vendedor');
          end if;
        end if;
      end if;
    end if;
  exception when others then
    raise warning 'Não foi possível criar a notificação do evento %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.obter_entrega_encomenda_participante(uuid) from public, anon;
grant execute on function public.obter_entrega_encomenda_participante(uuid) to authenticated;

commit;
