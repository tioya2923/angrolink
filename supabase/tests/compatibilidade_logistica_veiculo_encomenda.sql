-- Teste pós-migration. Executar no SQL Editor com uma conta de teste de cliente,
-- vendedor elegível e parceiro elegível com veículo operacional/capaz. Todos os
-- registos de encomenda/produto criados abaixo são descartados por ROLLBACK.
begin;

do $$
declare
  v_funcao regprocedure;
  v_prosecdef boolean;
  v_proconfig text[];
  v_definicao text;
begin
  foreach v_funcao in array array[
    'public.avaliar_compatibilidade_veiculo_encomenda(uuid,uuid)'::regprocedure,
    'public.motivos_compatibilidade_veiculo_encomenda(uuid,uuid)'::regprocedure,
    'public.veiculo_compativel_com_encomenda(uuid,uuid)'::regprocedure,
    'public.listar_veiculos_compativeis_encomenda(uuid)'::regprocedure
  ] loop
    select p.prosecdef, p.proconfig into v_prosecdef, v_proconfig
    from pg_proc p where p.oid = v_funcao::oid;

    if not found or not v_prosecdef or not exists (
      select 1 from unnest(coalesce(v_proconfig, array[]::text[])) c
      where regexp_replace(lower(c), '[[:space:]]+', '', 'g') = 'search_path=public'
    ) then
      raise exception 'Função de compatibilidade sem contexto seguro: %', v_funcao;
    end if;
  end loop;

  if has_function_privilege('public', 'public.avaliar_compatibilidade_veiculo_encomenda(uuid,uuid)', 'execute')
    or has_function_privilege('anon', 'public.motivos_compatibilidade_veiculo_encomenda(uuid,uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.veiculo_compativel_com_encomenda(uuid,uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.listar_veiculos_compativeis_encomenda(uuid)', 'execute') then
    raise exception 'Função interna de matching exposta a cliente';
  end if;

  select pg_get_functiondef('public.avaliar_compatibilidade_veiculo_encomenda(uuid,uuid)'::regprocedure) into v_definicao;
  if position('entregador_pode_receber_entregas' in lower(v_definicao)) = 0
    or position('veiculo_operacional_para_entregas' in lower(v_definicao)) = 0
    or position('calcular_requisitos_logisticos_encomenda' in lower(v_definicao)) = 0
    or position('areas_cobertura_entrega' in lower(v_definicao)) = 0
    or position('foto_veiculo_path' in lower(v_definicao)) > 0 then
    raise exception 'Matching não usa autoridades corretas ou expõe media';
  end if;
end;
$$;

-- Casos mínimos sem fixture autenticada: inexistentes e levantamento nunca são
-- promovidos a candidato. Os cenários com veículo apto exigem a fixture de teste
-- documentada acima, pois auth.uid() não é falsificado neste ficheiro.
do $$
declare
  v_estado text;
  v_motivos text[];
begin
  select estado, motivos into v_estado, v_motivos
  from public.avaliar_compatibilidade_veiculo_encomenda(gen_random_uuid(), gen_random_uuid());
  if v_estado <> 'incompativel' or not ('encomenda_inexistente' = any(v_motivos)) then
    raise exception 'Encomenda inexistente não foi bloqueada deterministicamente';
  end if;
end;
$$;

-- Fixture funcional: cliente, vendedor, parceiro, veículo, documentos e área
-- existentes são somente lidos. Produtos, encomendas, itens e destinos são
-- sintéticos e desaparecem no ROLLBACK. Casos que exigiriam aprovar/rejeitar ou
-- alterar um veículo real são cobertos pelos testes estruturais da migration.
do $$
declare
  v_cliente_id uuid;
  v_vendedor_id uuid;
  v_veiculo_bom uuid;
  v_parceiro_id uuid;
  v_capacidade_kg numeric;
  v_capacidade_volume numeric;
  v_tem_refrigeracao boolean;
  v_tem_caixa_carga boolean;
  v_aceita_paletes boolean;
  v_provincia text;
  v_municipio text;
  v_bairro text;
  v_provincia_fora text;
  v_municipio_fora text;
  v_produto_normal uuid := gen_random_uuid();
  v_produto_peso_desconhecido uuid := gen_random_uuid();
  v_produto_volume_desconhecido uuid := gen_random_uuid();
  v_produto_peso_excedido uuid := gen_random_uuid();
  v_produto_volume_excedido uuid := gen_random_uuid();
  v_produto_refrigerado uuid := gen_random_uuid();
  v_produto_caixa uuid := gen_random_uuid();
  v_produto_paletes uuid := gen_random_uuid();
  v_levantamento uuid := gen_random_uuid();
  v_sem_destino uuid := gen_random_uuid();
  v_normal uuid := gen_random_uuid();
  v_desconhecido uuid := gen_random_uuid();
  v_volume_desconhecido uuid := gen_random_uuid();
  v_peso_excedido uuid := gen_random_uuid();
  v_volume_excedido uuid := gen_random_uuid();
  v_refrigerado uuid := gen_random_uuid();
  v_caixa uuid := gen_random_uuid();
  v_paletes uuid := gen_random_uuid();
  v_fora_area uuid := gen_random_uuid();
  v_estado text;
  v_motivos text[];
begin
  select c.id into v_cliente_id
  from public.clientes c
  join auth.users u on u.id = c.id
  join public.profiles p on p.id = c.id
  where c.conta_ativa is true
    and coalesce(p.ativo, true) is true
    and p.apagado_em is null
  order by c.criado_em asc nulls last, c.id
  limit 1;

  select v.id into v_vendedor_id
  from public.vendedores v
  where public.vendedor_pode_receber_encomendas(v.id)
  order by v.criado_em asc nulls last, v.id
  limit 1;

  select ve.id, pe.id, ve.capacidade_kg, ve.capacidade_volume_m3,
         ve.possui_refrigeracao, ve.possui_caixa_carga, ve.aceita_paletes,
         a.provincia, a.municipio, coalesce(nullif(btrim(a.bairro), ''), 'Bairro de teste')
    into v_veiculo_bom, v_parceiro_id, v_capacidade_kg, v_capacidade_volume,
         v_tem_refrigeracao, v_tem_caixa_carga, v_aceita_paletes,
         v_provincia, v_municipio, v_bairro
  from public.veiculos_entrega ve
  join public.parceiros_entrega pe on pe.id = ve.parceiro_id
  join public.areas_cobertura_entrega a on a.parceiro_id = ve.parceiro_id and a.ativo
  where public.entregador_pode_receber_entregas(pe.id)
    and public.veiculo_operacional_para_entregas(ve.id)
    and ve.capacidade_kg > 0
    and ve.capacidade_volume_m3 > 0
    and public.territorio_angola_valido(a.provincia, a.municipio)
  order by pe.criado_em, pe.id, ve.criado_em, ve.id, a.id
  limit 1;

  if v_cliente_id is null or v_vendedor_id is null or v_veiculo_bom is null then
    raise exception 'Pré-requisito: crie pelo fluxo normal um parceiro de teste aprovado, disponível e documentalmente válido, com veículo operacional, capacidades de peso e volume preenchidas e área ativa.';
  end if;

  if not public.entregador_pode_receber_entregas(v_parceiro_id) then
    raise exception 'Fixture inválida: parceiro real de baseline não ficou elegível.';
  end if;
  if not public.veiculo_operacional_para_entregas(v_veiculo_bom) then
    raise exception 'Fixture inválida: veículo real de baseline não ficou operacional.';
  end if;

  select p.nome, m.nome into v_provincia_fora, v_municipio_fora
  from public.municipios_angola m
  join public.provincias_angola p on p.id = m.provincia_id
  where not exists (
    select 1 from public.areas_cobertura_entrega a
    where a.parceiro_id = v_parceiro_id and a.ativo
      and public.normalizar_texto_territorial(a.provincia) = public.normalizar_texto_territorial(p.nome)
      and public.normalizar_texto_territorial(a.municipio) = public.normalizar_texto_territorial(m.nome)
  )
  order by p.ordem, m.codigo_oficial
  limit 1;

  if v_provincia_fora is null then
    raise exception 'Pré-requisito da fixture: é necessário um município canónico fora da cobertura do parceiro de teste.';
  end if;

  insert into public.produtos (
    id, vendedor_id, nome_produto, unidade, preco_aproximado, quantidade_minima,
    tipo_venda, publicado, disponivel, peso_por_unidade_comercial_kg,
    volume_por_unidade_comercial_m3, requer_refrigeracao, requer_caixa_carga, requer_paletes
  ) values
    (v_produto_normal, v_vendedor_id, 'Fixture compatível', 'unidade', 100, 1, 'retalho', false, false, least(v_capacidade_kg / 2, 1), least(v_capacidade_volume / 2, 0.01), false, false, false),
    (v_produto_peso_desconhecido, v_vendedor_id, 'Fixture peso desconhecido', 'unidade', 100, 1, 'retalho', false, false, null, 0.01, false, false, false),
    (v_produto_volume_desconhecido, v_vendedor_id, 'Fixture volume desconhecido', 'unidade', 100, 1, 'retalho', false, false, 0.01, null, false, false, false),
    (v_produto_peso_excedido, v_vendedor_id, 'Fixture peso excedido', 'unidade', 100, 1, 'retalho', false, false, v_capacidade_kg + 1, null, false, false, false),
    (v_produto_volume_excedido, v_vendedor_id, 'Fixture volume excedido', 'unidade', 100, 1, 'retalho', false, false, 0.01, v_capacidade_volume + 1, false, false, false),
    (v_produto_refrigerado, v_vendedor_id, 'Fixture refrigeração', 'unidade', 100, 1, 'retalho', false, false, least(v_capacidade_kg / 2, 0.01), least(v_capacidade_volume / 2, 0.01), true, false, false),
    (v_produto_caixa, v_vendedor_id, 'Fixture caixa', 'unidade', 100, 1, 'retalho', false, false, least(v_capacidade_kg / 2, 0.01), least(v_capacidade_volume / 2, 0.01), false, true, false),
    (v_produto_paletes, v_vendedor_id, 'Fixture paletes', 'unidade', 100, 1, 'retalho', false, false, least(v_capacidade_kg / 2, 0.01), least(v_capacidade_volume / 2, 0.01), false, false, true);

  insert into public.encomendas (id, codigo_publico, cliente_id, vendedor_id, estado, modalidade_recebimento, moeda, subtotal_centimos, desconto_centimos, entrega_centimos, total_centimos, destinatario_nome, destinatario_telefone)
  values
    (v_levantamento, public.gerar_codigo_publico_encomenda(), v_cliente_id, v_vendedor_id, 'aguardando_confirmacao', 'levantamento', 'AOA', 100, 0, 0, 100, 'Cliente fixture', '+244900000000'),
    (v_sem_destino, public.gerar_codigo_publico_encomenda(), v_cliente_id, v_vendedor_id, 'aguardando_confirmacao', 'entrega', 'AOA', 100, 0, 0, 100, 'Cliente fixture', '+244900000000'),
    (v_normal, public.gerar_codigo_publico_encomenda(), v_cliente_id, v_vendedor_id, 'aguardando_confirmacao', 'entrega', 'AOA', 100, 0, 0, 100, 'Cliente fixture', '+244900000000'),
    (v_desconhecido, public.gerar_codigo_publico_encomenda(), v_cliente_id, v_vendedor_id, 'aguardando_confirmacao', 'entrega', 'AOA', 100, 0, 0, 100, 'Cliente fixture', '+244900000000'),
    (v_volume_desconhecido, public.gerar_codigo_publico_encomenda(), v_cliente_id, v_vendedor_id, 'aguardando_confirmacao', 'entrega', 'AOA', 100, 0, 0, 100, 'Cliente fixture', '+244900000000'),
    (v_peso_excedido, public.gerar_codigo_publico_encomenda(), v_cliente_id, v_vendedor_id, 'aguardando_confirmacao', 'entrega', 'AOA', 100, 0, 0, 100, 'Cliente fixture', '+244900000000'),
    (v_volume_excedido, public.gerar_codigo_publico_encomenda(), v_cliente_id, v_vendedor_id, 'aguardando_confirmacao', 'entrega', 'AOA', 100, 0, 0, 100, 'Cliente fixture', '+244900000000'),
    (v_refrigerado, public.gerar_codigo_publico_encomenda(), v_cliente_id, v_vendedor_id, 'aguardando_confirmacao', 'entrega', 'AOA', 100, 0, 0, 100, 'Cliente fixture', '+244900000000'),
    (v_caixa, public.gerar_codigo_publico_encomenda(), v_cliente_id, v_vendedor_id, 'aguardando_confirmacao', 'entrega', 'AOA', 100, 0, 0, 100, 'Cliente fixture', '+244900000000'),
    (v_paletes, public.gerar_codigo_publico_encomenda(), v_cliente_id, v_vendedor_id, 'aguardando_confirmacao', 'entrega', 'AOA', 100, 0, 0, 100, 'Cliente fixture', '+244900000000'),
    (v_fora_area, public.gerar_codigo_publico_encomenda(), v_cliente_id, v_vendedor_id, 'aguardando_confirmacao', 'entrega', 'AOA', 100, 0, 0, 100, 'Cliente fixture', '+244900000000');

  insert into public.enderecos_entrega_encomenda (encomenda_id, destinatario_nome, destinatario_telefone, provincia, municipio, bairro, endereco_detalhado)
  select e, 'Cliente fixture', '+244900000000', v_provincia, v_municipio, v_bairro, 'Endereço de teste'
  from unnest(array[v_normal, v_desconhecido, v_volume_desconhecido, v_peso_excedido, v_volume_excedido, v_refrigerado, v_caixa, v_paletes]) e;
  insert into public.enderecos_entrega_encomenda (encomenda_id, destinatario_nome, destinatario_telefone, provincia, municipio, bairro, endereco_detalhado)
  values (v_fora_area, 'Cliente fixture', '+244900000000', v_provincia_fora, v_municipio_fora, 'Bairro de teste', 'Endereço de teste');

  insert into public.itens_encomenda (encomenda_id, produto_id, vendedor_id, quantidade, unidade, tipo_preco_snapshot, valor_unitario_centimos, subtotal_centimos, nome_produto_snapshot)
  values
    (v_normal, v_produto_normal, v_vendedor_id, 1, 'unidade', 'normal', 100, 100, 'Compatível'),
    (v_desconhecido, v_produto_peso_desconhecido, v_vendedor_id, 1, 'unidade', 'normal', 100, 100, 'Desconhecido'),
    (v_volume_desconhecido, v_produto_volume_desconhecido, v_vendedor_id, 1, 'unidade', 'normal', 100, 100, 'Volume desconhecido'),
    (v_peso_excedido, v_produto_peso_excedido, v_vendedor_id, 1, 'unidade', 'normal', 100, 100, 'Peso'),
    (v_volume_excedido, v_produto_volume_excedido, v_vendedor_id, 1, 'unidade', 'normal', 100, 100, 'Volume'),
    (v_refrigerado, v_produto_refrigerado, v_vendedor_id, 1, 'unidade', 'normal', 100, 100, 'Frio'),
    (v_caixa, v_produto_caixa, v_vendedor_id, 1, 'unidade', 'normal', 100, 100, 'Caixa'),
    (v_paletes, v_produto_paletes, v_vendedor_id, 1, 'unidade', 'normal', 100, 100, 'Paletes'),
    (v_fora_area, v_produto_normal, v_vendedor_id, 1, 'unidade', 'normal', 100, 100, 'Fora');

  select estado, motivos into v_estado, v_motivos from public.avaliar_compatibilidade_veiculo_encomenda(v_veiculo_bom, v_levantamento);
  if v_estado <> 'incompativel' or not ('modalidade_nao_e_entrega' = any(v_motivos)) then raise exception 'Levantamento entrou no matching'; end if;
  select estado, motivos into v_estado, v_motivos from public.avaliar_compatibilidade_veiculo_encomenda(v_veiculo_bom, v_sem_destino);
  if v_estado <> 'dados_incompletos' or not ('destino_ausente' = any(v_motivos)) then raise exception 'Destino ausente não foi bloqueado'; end if;
  select estado, motivos into v_estado, v_motivos from public.avaliar_compatibilidade_veiculo_encomenda(v_veiculo_bom, v_normal);
  if v_estado <> 'compativel' or not public.veiculo_compativel_com_encomenda(v_veiculo_bom, v_normal) then raise exception 'Veículo compatível não foi aceite'; end if;
  if not exists (select 1 from public.listar_veiculos_compativeis_encomenda(v_normal) where veiculo_id = v_veiculo_bom)
  then raise exception 'Lista de candidatos não incluiu o veículo operacional compatível'; end if;
  select estado, motivos into v_estado, v_motivos from public.avaliar_compatibilidade_veiculo_encomenda(v_veiculo_bom, v_desconhecido);
  if v_estado <> 'dados_incompletos' or not ('peso_carga_desconhecido' = any(v_motivos)) then raise exception 'Peso desconhecido foi tratado como zero'; end if;
  select estado, motivos into v_estado, v_motivos from public.avaliar_compatibilidade_veiculo_encomenda(v_veiculo_bom, v_volume_desconhecido);
  if v_estado <> 'dados_incompletos' or not ('volume_carga_desconhecido' = any(v_motivos)) then raise exception 'Volume desconhecido foi tratado como zero'; end if;
  if exists (select 1 from public.listar_veiculos_compativeis_encomenda(v_volume_desconhecido)) then raise exception 'Lista incluiu candidato com dados incompletos'; end if;
  select estado, motivos into v_estado, v_motivos from public.avaliar_compatibilidade_veiculo_encomenda(v_veiculo_bom, v_peso_excedido);
  if v_estado <> 'incompativel'
    or not ('capacidade_peso_insuficiente' = any(v_motivos))
    or not ('volume_carga_desconhecido' = any(v_motivos))
    or public.veiculo_compativel_com_encomenda(v_veiculo_bom, v_peso_excedido) then
    raise exception 'Incompatibilidade definitiva não teve precedência sobre volume desconhecido';
  end if;
  select estado, motivos into v_estado, v_motivos from public.avaliar_compatibilidade_veiculo_encomenda(v_veiculo_bom, v_volume_excedido);
  if v_estado <> 'incompativel' or not ('capacidade_volume_insuficiente' = any(v_motivos)) then raise exception 'Volume excedido não foi bloqueado'; end if;
  select estado, motivos into v_estado, v_motivos from public.avaliar_compatibilidade_veiculo_encomenda(v_veiculo_bom, v_refrigerado);
  if v_tem_refrigeracao then
    if v_estado <> 'compativel' or 'refrigeracao_indisponivel' = any(v_motivos) then raise exception 'Veículo com refrigeração foi rejeitado incorretamente'; end if;
  elsif v_estado <> 'incompativel' or not ('refrigeracao_indisponivel' = any(v_motivos)) then
    raise exception 'Veículo sem refrigeração não foi bloqueado';
  end if;
  select estado, motivos into v_estado, v_motivos from public.avaliar_compatibilidade_veiculo_encomenda(v_veiculo_bom, v_caixa);
  if v_tem_caixa_carga then
    if v_estado <> 'compativel' or 'caixa_carga_indisponivel' = any(v_motivos) then raise exception 'Veículo com caixa de carga foi rejeitado incorretamente'; end if;
  elsif v_estado <> 'incompativel' or not ('caixa_carga_indisponivel' = any(v_motivos)) then
    raise exception 'Veículo sem caixa de carga não foi bloqueado';
  end if;
  select estado, motivos into v_estado, v_motivos from public.avaliar_compatibilidade_veiculo_encomenda(v_veiculo_bom, v_paletes);
  if v_aceita_paletes then
    if v_estado <> 'compativel' or 'paletes_nao_suportadas' = any(v_motivos) then raise exception 'Veículo que aceita paletes foi rejeitado incorretamente'; end if;
  elsif v_estado <> 'incompativel' or not ('paletes_nao_suportadas' = any(v_motivos)) then
    raise exception 'Veículo sem suporte para paletes não foi bloqueado';
  end if;
  select estado, motivos into v_estado, v_motivos from public.avaliar_compatibilidade_veiculo_encomenda(v_veiculo_bom, v_fora_area);
  if v_estado <> 'incompativel' or not ('fora_area_cobertura' = any(v_motivos)) then raise exception 'Cobertura fora da área não foi bloqueada'; end if;
end;
$$;

rollback;
