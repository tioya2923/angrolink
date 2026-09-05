-- Fase 1:
-- volume exato desconhecido deixa de bloquear automaticamente
-- a atribuição de um entregador.
--
-- Mantemos bloqueios reais:
-- - excesso de peso;
-- - excesso de volume quando o volume é conhecido;
-- - requisitos especiais incompatíveis;
-- - veículo/entregador não operacional;
-- - destino fora da cobertura.
--
-- volume_carga_desconhecido permanece nos motivos como ressalva.

create or replace function public.avaliar_compatibilidade_veiculo_encomenda(
  p_veiculo_id uuid,
  p_encomenda_id uuid
)
returns table(
  estado text,
  motivos text[]
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_encomenda public.encomendas%rowtype;
  v_destino public.enderecos_entrega_encomenda%rowtype;
  v_veiculo public.veiculos_entrega%rowtype;
  v_requisitos record;
  v_motivos text[] := array[]::text[];
  v_destino_canonico boolean;
  v_cobertura boolean;
begin
  select *
  into v_encomenda
  from public.encomendas
  where id = p_encomenda_id;

  if not found then
    return query
    select
      'incompativel'::text,
      array['encomenda_inexistente']::text[];
    return;
  end if;

  if v_encomenda.modalidade_recebimento <> 'entrega' then
    return query
    select
      'incompativel'::text,
      array['modalidade_nao_e_entrega']::text[];
    return;
  end if;

  select *
  into v_destino
  from public.enderecos_entrega_encomenda
  where encomenda_id = p_encomenda_id;

  if not found then
    return query
    select
      'dados_incompletos'::text,
      array['destino_ausente']::text[];
    return;
  end if;

  select *
  into v_veiculo
  from public.veiculos_entrega
  where id = p_veiculo_id;

  if not found then
    return query
    select
      'incompativel'::text,
      array['veiculo_inexistente']::text[];
    return;
  end if;

  if not public.entregador_pode_receber_entregas(v_veiculo.parceiro_id) then
    v_motivos := array_append(
      v_motivos,
      'entregador_nao_elegivel'
    );
  end if;

  if not public.veiculo_operacional_para_entregas(v_veiculo.id) then
    v_motivos := array_append(
      v_motivos,
      'veiculo_nao_operacional'
    );
  end if;

  select *
  into v_requisitos
  from public.calcular_requisitos_logisticos_encomenda(p_encomenda_id);

  -- PESO
  if not v_requisitos.peso_total_conhecido then
    v_motivos := array_append(
      v_motivos,
      'peso_carga_desconhecido'
    );

  elsif v_veiculo.capacidade_kg is null then
    v_motivos := array_append(
      v_motivos,
      'capacidade_peso_veiculo_desconhecida'
    );

  elsif v_requisitos.peso_total_kg > v_veiculo.capacidade_kg then
    v_motivos := array_append(
      v_motivos,
      'capacidade_peso_insuficiente'
    );
  end if;

  -- VOLUME
  --
  -- O volume desconhecido continua registado como motivo informativo,
  -- mas deixa de impedir por si só a atribuição na Fase 1.
  if not v_requisitos.volume_total_conhecido then
    v_motivos := array_append(
      v_motivos,
      'volume_carga_desconhecido'
    );

  elsif v_veiculo.capacidade_volume_m3 is null then
    v_motivos := array_append(
      v_motivos,
      'capacidade_volume_veiculo_desconhecida'
    );

  elsif v_requisitos.volume_total_m3 > v_veiculo.capacidade_volume_m3 then
    v_motivos := array_append(
      v_motivos,
      'capacidade_volume_insuficiente'
    );
  end if;

  -- REQUISITOS ESPECIAIS
  if not v_requisitos.requisitos_especiais_conhecidos then
    v_motivos := array_append(
      v_motivos,
      'requisitos_especiais_desconhecidos'
    );
  end if;

  if
    v_requisitos.requer_refrigeracao is true
    and v_veiculo.possui_refrigeracao is not true
  then
    v_motivos := array_append(
      v_motivos,
      'refrigeracao_indisponivel'
    );
  end if;

  if
    v_requisitos.requer_caixa_carga is true
    and v_veiculo.possui_caixa_carga is not true
  then
    v_motivos := array_append(
      v_motivos,
      'caixa_carga_indisponivel'
    );
  end if;

  if
    v_requisitos.requer_paletes is true
    and v_veiculo.aceita_paletes is not true
  then
    v_motivos := array_append(
      v_motivos,
      'paletes_nao_suportadas'
    );
  end if;

  -- COBERTURA TERRITORIAL
  select public.territorio_angola_valido(
    v_destino.provincia,
    v_destino.municipio
  )
  into v_destino_canonico;

  if not v_destino_canonico then
    v_motivos := array_append(
      v_motivos,
      'destino_territorial_invalido'
    );
  else
    select exists (
      select 1
      from public.areas_cobertura_entrega a
      where a.parceiro_id = v_veiculo.parceiro_id
        and a.ativo
        and public.normalizar_texto_territorial(a.provincia)
          = public.normalizar_texto_territorial(v_destino.provincia)
        and public.normalizar_texto_territorial(a.municipio)
          = public.normalizar_texto_territorial(v_destino.municipio)
        and (
          nullif(btrim(a.bairro), '') is null
          or public.normalizar_texto_territorial(a.bairro)
            = public.normalizar_texto_territorial(v_destino.bairro)
        )
    )
    into v_cobertura;

    if not v_cobertura then
      v_motivos := array_append(
        v_motivos,
        'fora_area_cobertura'
      );
    end if;
  end if;

  -- Remove motivos duplicados e mantém ordem estável.
  select coalesce(
    array_agg(distinct motivo order by motivo),
    array[]::text[]
  )
  into v_motivos
  from unnest(v_motivos) as motivo;

  if cardinality(v_motivos) = 0 then
    return query
    select
      'compativel'::text,
      v_motivos;

  elsif v_motivos && array[
    'entregador_nao_elegivel',
    'veiculo_nao_operacional',
    'capacidade_peso_insuficiente',
    'capacidade_volume_insuficiente',
    'refrigeracao_indisponivel',
    'caixa_carga_indisponivel',
    'paletes_nao_suportadas',
    'fora_area_cobertura'
  ]::text[] then
    return query
    select
      'incompativel'::text,
      v_motivos;

  elsif v_motivos && array[
    'destino_ausente',
    'peso_carga_desconhecido',
    'capacidade_peso_veiculo_desconhecida',
    'capacidade_volume_veiculo_desconhecida',
    'requisitos_especiais_desconhecidos',
    'destino_territorial_invalido'
  ]::text[] then
    return query
    select
      'dados_incompletos'::text,
      v_motivos;

  else
    -- Na Fase 1, volume desconhecido é apenas uma ressalva.
    -- Se este for o único motivo restante, a atribuição é permitida.
    return query
    select
      'compativel'::text,
      v_motivos;
  end if;
end;
$function$;