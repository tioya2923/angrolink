-- ANGROLINK — compatibilidade logística determinística veículo × encomenda V1.
-- Não atribui entregas, não reserva parceiros, não calcula distância, tarifa ou ranking.

begin;

-- Fonte canónica da decisão. `dados_incompletos` é diferente de incompatibilidade:
-- nenhum deles pode gerar candidato automático, mas o diagnóstico não esconde a
-- ausência de peso, volume, requisitos especiais ou destino avaliável.
create or replace function public.avaliar_compatibilidade_veiculo_encomenda(
  p_veiculo_id uuid,
  p_encomenda_id uuid
)
returns table (
  estado text,
  motivos text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_encomenda public.encomendas%rowtype;
  v_destino public.enderecos_entrega_encomenda%rowtype;
  v_veiculo public.veiculos_entrega%rowtype;
  v_requisitos record;
  v_motivos text[] := array[]::text[];
  v_destino_canonico boolean;
  v_cobertura boolean;
begin
  select * into v_encomenda
  from public.encomendas
  where id = p_encomenda_id;

  if not found then
    return query select 'incompativel'::text, array['encomenda_inexistente']::text[];
    return;
  end if;

  if v_encomenda.modalidade_recebimento <> 'entrega' then
    return query select 'incompativel'::text, array['modalidade_nao_e_entrega']::text[];
    return;
  end if;

  select * into v_destino
  from public.enderecos_entrega_encomenda
  where encomenda_id = p_encomenda_id;

  if not found then
    return query select 'dados_incompletos'::text, array['destino_ausente']::text[];
    return;
  end if;

  select * into v_veiculo
  from public.veiculos_entrega
  where id = p_veiculo_id;

  if not found then
    return query select 'incompativel'::text, array['veiculo_inexistente']::text[];
    return;
  end if;

  if not public.entregador_pode_receber_entregas(v_veiculo.parceiro_id) then
    v_motivos := v_motivos || 'entregador_nao_elegivel';
  end if;

  if not public.veiculo_operacional_para_entregas(v_veiculo.id) then
    v_motivos := v_motivos || 'veiculo_nao_operacional';
  end if;

  select * into v_requisitos
  from public.calcular_requisitos_logisticos_encomenda(p_encomenda_id);

  if not v_requisitos.peso_total_conhecido then
    v_motivos := v_motivos || 'peso_carga_desconhecido';
  elsif v_veiculo.capacidade_kg is null then
    v_motivos := v_motivos || 'capacidade_peso_veiculo_desconhecida';
  elsif v_requisitos.peso_total_kg > v_veiculo.capacidade_kg then
    v_motivos := v_motivos || 'capacidade_peso_insuficiente';
  end if;

  if not v_requisitos.volume_total_conhecido then
    v_motivos := v_motivos || 'volume_carga_desconhecido';
  elsif v_veiculo.capacidade_volume_m3 is null then
    v_motivos := v_motivos || 'capacidade_volume_veiculo_desconhecida';
  elsif v_requisitos.volume_total_m3 > v_veiculo.capacidade_volume_m3 then
    v_motivos := v_motivos || 'capacidade_volume_insuficiente';
  end if;

  if not v_requisitos.requisitos_especiais_conhecidos then
    v_motivos := v_motivos || 'requisitos_especiais_desconhecidos';
  end if;

  if v_requisitos.requer_refrigeracao is true
    and v_veiculo.possui_refrigeracao is not true then
    v_motivos := v_motivos || 'refrigeracao_indisponivel';
  end if;

  if v_requisitos.requer_caixa_carga is true
    and v_veiculo.possui_caixa_carga is not true then
    v_motivos := v_motivos || 'caixa_carga_indisponivel';
  end if;

  if v_requisitos.requer_paletes is true
    and v_veiculo.aceita_paletes is not true then
    v_motivos := v_motivos || 'paletes_nao_suportadas';
  end if;

  -- A normalização limitada a maiúsculas/minúsculas e espaços não cria aliases
  -- territoriais. Só territórios existentes na taxonomia canónica podem entrar
  -- no matching automático.
  select public.territorio_angola_valido(v_destino.provincia, v_destino.municipio)
    into v_destino_canonico;

  if not v_destino_canonico then
    v_motivos := v_motivos || 'destino_territorial_invalido';
  else
    -- bairro nulo/vazio na área significa cobertura de todo o município. Quando
    -- o parceiro restringe a área a um bairro, a igualdade também é obrigatória.
    select exists (
      select 1
      from public.areas_cobertura_entrega a
      where a.parceiro_id = v_veiculo.parceiro_id
        and a.ativo
        and public.normalizar_texto_territorial(a.provincia) = public.normalizar_texto_territorial(v_destino.provincia)
        and public.normalizar_texto_territorial(a.municipio) = public.normalizar_texto_territorial(v_destino.municipio)
        and (
          nullif(btrim(a.bairro), '') is null
          or public.normalizar_texto_territorial(a.bairro) = public.normalizar_texto_territorial(v_destino.bairro)
        )
    ) into v_cobertura;

    if not v_cobertura then
      v_motivos := v_motivos || 'fora_area_cobertura';
    end if;
  end if;

  select coalesce(array_agg(distinct motivo order by motivo), array[]::text[])
    into v_motivos
  from unnest(v_motivos) as motivo;

  if cardinality(v_motivos) = 0 then
    return query select 'compativel'::text, v_motivos;
  -- Uma incapacidade conhecida tem precedência sobre informação em falta. Por
  -- exemplo, peso acima da capacidade continua incompatível mesmo que o volume
  -- ainda seja desconhecido. `dados_incompletos` só descreve casos sem bloqueio
  -- definitivo já demonstrado.
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
    return query select 'incompativel'::text, v_motivos;
  elsif v_motivos && array[
    'destino_ausente',
    'peso_carga_desconhecido',
    'capacidade_peso_veiculo_desconhecida',
    'volume_carga_desconhecido',
    'capacidade_volume_veiculo_desconhecida',
    'requisitos_especiais_desconhecidos',
    'destino_territorial_invalido'
  ]::text[] then
    return query select 'dados_incompletos'::text, v_motivos;
  else
    return query select 'incompativel'::text, v_motivos;
  end if;
end;
$$;

create or replace function public.motivos_compatibilidade_veiculo_encomenda(
  p_veiculo_id uuid,
  p_encomenda_id uuid
)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select a.motivos
  from public.avaliar_compatibilidade_veiculo_encomenda(p_veiculo_id, p_encomenda_id) a;
$$;

create or replace function public.veiculo_compativel_com_encomenda(
  p_veiculo_id uuid,
  p_encomenda_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select a.estado = 'compativel'
  from public.avaliar_compatibilidade_veiculo_encomenda(p_veiculo_id, p_encomenda_id) a;
$$;

-- Função interna para a fase futura de atribuição. Não ordena por distância,
-- preço ou preferência: a ordem é técnica, estável e não constitui ranking.
create or replace function public.listar_veiculos_compativeis_encomenda(
  p_encomenda_id uuid
)
returns table (
  parceiro_id uuid,
  veiculo_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select v.parceiro_id, v.id
  from public.veiculos_entrega v
  cross join lateral public.avaliar_compatibilidade_veiculo_encomenda(v.id, p_encomenda_id) a
  where a.estado = 'compativel'
  order by v.parceiro_id, v.id;
$$;

comment on function public.avaliar_compatibilidade_veiculo_encomenda(uuid, uuid) is
  'Avaliação interna determinística de veículo × encomenda. Desconhecido não equivale a zero ou falso; não atribui, reserva nem tarifa entregas.';

revoke all on function public.avaliar_compatibilidade_veiculo_encomenda(uuid, uuid) from public, anon, authenticated;
revoke all on function public.motivos_compatibilidade_veiculo_encomenda(uuid, uuid) from public, anon, authenticated;
revoke all on function public.veiculo_compativel_com_encomenda(uuid, uuid) from public, anon, authenticated;
revoke all on function public.listar_veiculos_compativeis_encomenda(uuid) from public, anon, authenticated;

commit;
