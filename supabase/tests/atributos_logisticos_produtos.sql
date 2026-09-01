-- Testes reversíveis: fixture nova, sem depender de encomendas históricas.
begin;

do $$
declare
  v_cliente_id uuid;
  v_vendedor_id uuid;
  v_produto_unidade uuid := gen_random_uuid();
  v_produto_kg uuid := gen_random_uuid();
  v_produto_desconhecido uuid := gen_random_uuid();
  v_encomendas uuid[] := array[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  ];
  v_item_a uuid;
  v_item_b uuid;
  v_indice integer;
  v_peso numeric; v_peso_conhecido boolean; v_volume numeric; v_volume_conhecido boolean;
  v_refrigeracao boolean; v_caixa boolean; v_paletes boolean; v_requisitos_conhecidos boolean;
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'produtos' and column_name in ('peso_por_unidade_comercial_kg', 'volume_por_unidade_comercial_m3', 'requer_refrigeracao', 'requer_caixa_carga', 'requer_paletes') group by table_schema, table_name having count(*) = 5)
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'itens_encomenda' and column_name in ('peso_por_unidade_comercial_kg_snapshot', 'volume_por_unidade_comercial_m3_snapshot', 'requer_refrigeracao_snapshot', 'requer_caixa_carga_snapshot', 'requer_paletes_snapshot') group by table_schema, table_name having count(*) = 5) then
    raise exception 'Contrato de atributos ou snapshots logísticos incompleto';
  end if;

  if to_regprocedure('public.preencher_snapshot_logistico_item_encomenda()') is null
    or to_regprocedure('public.calcular_requisitos_logisticos_encomenda(uuid)') is null then
    raise exception 'Funções logísticas ausentes';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.itens_encomenda'::regclass and tgname = 'preencher_snapshot_logistico_item' and not tgisinternal) then
    raise exception 'Trigger de snapshot ausente';
  end if;
  if has_function_privilege('public', 'public.calcular_requisitos_logisticos_encomenda(uuid)', 'execute')
    or has_function_privilege('anon', 'public.calcular_requisitos_logisticos_encomenda(uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.calcular_requisitos_logisticos_encomenda(uuid)', 'execute')
    or has_function_privilege('public', 'public.preencher_snapshot_logistico_item_encomenda()', 'execute')
    or has_function_privilege('anon', 'public.preencher_snapshot_logistico_item_encomenda()', 'execute')
    or has_function_privilege('authenticated', 'public.preencher_snapshot_logistico_item_encomenda()', 'execute') then
    raise exception 'Agregado interno exposto diretamente';
  end if;
  if not exists (
    select 1
    from pg_proc
    where oid = 'public.calcular_requisitos_logisticos_encomenda(uuid)'::regprocedure
      and prosecdef
      and coalesce(array_to_string(proconfig, ','), '') like '%search_path=public%'
  ) then
    raise exception 'Agregado logístico sem SECURITY DEFINER ou search_path seguro';
  end if;

  -- Só reutiliza FKs de contas reais íntegras. Não lê nem altera dados
  -- pessoais: todos os dados comerciais da fixture são novos e descartados.
  select c.id
    into v_cliente_id
  from public.clientes c
  join auth.users u on u.id = c.id
  join public.profiles p on p.id = c.id
  where c.conta_ativa is true
    and coalesce(p.ativo, true) is true
    and p.apagado_em is null
  order by c.criado_em asc nulls last, c.id asc
  limit 1;

  select v.id
    into v_vendedor_id
  from public.vendedores v
  where public.vendedor_pode_receber_encomendas(v.id)
  order by v.criado_em asc nulls last, v.id asc
  limit 1;

  if v_cliente_id is null then
    raise exception 'Pré-requisito da fixture: crie uma conta de cliente de teste ativa, com auth.users e profile ativo não eliminado.';
  end if;
  if v_vendedor_id is null then
    raise exception 'Pré-requisito da fixture: crie um vendedor de teste elegível para receber encomendas.';
  end if;

  insert into public.produtos (id, vendedor_id, nome_produto, unidade, preco_aproximado, quantidade_minima, tipo_venda, publicado, disponivel, peso_por_unidade_comercial_kg, volume_por_unidade_comercial_m3, requer_refrigeracao, requer_caixa_carga, requer_paletes) values
    (v_produto_unidade, v_vendedor_id, 'Fixture unidade', 'unidade', 100, 1, 'retalho', false, false, 2.500, 0.010000, false, false, false),
    (v_produto_kg, v_vendedor_id, 'Fixture kg', 'kg', 100, 1, 'retalho', false, false, null, 0.020000, false, false, false),
    (v_produto_desconhecido, v_vendedor_id, 'Fixture desconhecido', 'unidade', 100, 1, 'retalho', false, false, null, null, null, false, null);

  begin
    update public.produtos set peso_por_unidade_comercial_kg = 1 where id = v_produto_kg;
    raise exception 'Produto em kg aceitou peso por unidade comercial';
  exception when check_violation then null;
  end;

  for v_indice in 1..8 loop
    insert into public.encomendas (id, codigo_publico, cliente_id, vendedor_id, estado, modalidade_recebimento, moeda, subtotal_centimos, desconto_centimos, entrega_centimos, total_centimos, destinatario_nome, destinatario_telefone)
    values (v_encomendas[v_indice], format('ANG-%s-%s', to_char(current_date, 'YYYY'), upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))), v_cliente_id, v_vendedor_id, 'aguardando_confirmacao', 'levantamento', 'AOA', 100, 0, 0, 100, 'Cliente fixture', '+244900000000');
  end loop;

  -- Trigger ignora snapshots maliciosos e preserva a primeira versão.
  insert into public.itens_encomenda (encomenda_id, produto_id, vendedor_id, quantidade, unidade, tipo_preco_snapshot, valor_unitario_centimos, subtotal_centimos, nome_produto_snapshot, peso_por_unidade_comercial_kg_snapshot, requer_refrigeracao_snapshot)
  values (v_encomendas[1], v_produto_unidade, v_vendedor_id, 3, 'unidade', 'normal', 100, 100, 'A', 999, true)
  returning id into v_item_a;
  if not exists (select 1 from public.itens_encomenda where id = v_item_a and peso_por_unidade_comercial_kg_snapshot = 2.500 and volume_por_unidade_comercial_m3_snapshot = 0.010000 and requer_refrigeracao_snapshot = false) then
    raise exception 'Trigger não sobrescreveu snapshot fornecido no INSERT';
  end if;

  begin
    insert into public.itens_encomenda (encomenda_id, produto_id, vendedor_id, quantidade, unidade, tipo_preco_snapshot, valor_unitario_centimos, subtotal_centimos, nome_produto_snapshot)
    values (v_encomendas[1], gen_random_uuid(), v_vendedor_id, 1, 'unidade', 'normal', 100, 100, 'Produto inexistente');
    raise exception 'Trigger aceitou produto inexistente';
  exception
    when others then
      if position('Não foi possível obter os atributos logísticos do produto da encomenda.' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  update public.produtos set peso_por_unidade_comercial_kg = 4.000, volume_por_unidade_comercial_m3 = 0.020000, requer_refrigeracao = true, requer_caixa_carga = true, requer_paletes = true where id = v_produto_unidade;
  insert into public.itens_encomenda (encomenda_id, produto_id, vendedor_id, quantidade, unidade, tipo_preco_snapshot, valor_unitario_centimos, subtotal_centimos, nome_produto_snapshot)
  values (v_encomendas[2], v_produto_unidade, v_vendedor_id, 3, 'unidade', 'normal', 100, 100, 'B') returning id into v_item_b;
  if not exists (select 1 from public.itens_encomenda where id = v_item_a and peso_por_unidade_comercial_kg_snapshot = 2.500 and requer_refrigeracao_snapshot = false)
    or not exists (select 1 from public.itens_encomenda where id = v_item_b and peso_por_unidade_comercial_kg_snapshot = 4.000 and requer_refrigeracao_snapshot = true) then
    raise exception 'Snapshot histórico não permaneceu imutável';
  end if;

  insert into public.itens_encomenda (encomenda_id, produto_id, vendedor_id, quantidade, unidade, tipo_preco_snapshot, valor_unitario_centimos, subtotal_centimos, nome_produto_snapshot) values
    (v_encomendas[3], v_produto_kg, v_vendedor_id, 5, 'kg', 'normal', 100, 100, 'Kg'),
    (v_encomendas[4], v_produto_desconhecido, v_vendedor_id, 3, 'unidade', 'normal', 100, 100, 'Desconhecido'),
    (v_encomendas[5], v_produto_unidade, v_vendedor_id, 3, 'unidade', 'normal', 100, 100, 'Conhecido'),
    (v_encomendas[5], v_produto_desconhecido, v_vendedor_id, 3, 'unidade', 'normal', 100, 100, 'Desconhecido'),
    (v_encomendas[6], v_produto_kg, v_vendedor_id, 1, 'kg', 'normal', 100, 100, 'Falso A'),
    (v_encomendas[6], v_produto_kg, v_vendedor_id, 1, 'kg', 'normal', 100, 100, 'Falso B'),
    (v_encomendas[7], v_produto_unidade, v_vendedor_id, 1, 'unidade', 'normal', 100, 100, 'Verdadeiro'),
    (v_encomendas[7], v_produto_kg, v_vendedor_id, 1, 'kg', 'normal', 100, 100, 'Falso'),
    (v_encomendas[8], v_produto_desconhecido, v_vendedor_id, 1, 'unidade', 'normal', 100, 100, 'Nulo'),
    (v_encomendas[8], v_produto_kg, v_vendedor_id, 1, 'kg', 'normal', 100, 100, 'Falso');

  select * into v_peso, v_peso_conhecido, v_volume, v_volume_conhecido, v_refrigeracao, v_caixa, v_paletes, v_requisitos_conhecidos from public.calcular_requisitos_logisticos_encomenda(v_encomendas[3]);
  if v_peso <> 5 or not v_peso_conhecido then raise exception 'Peso kg não foi calculado diretamente'; end if;
  select * into v_peso, v_peso_conhecido, v_volume, v_volume_conhecido, v_refrigeracao, v_caixa, v_paletes, v_requisitos_conhecidos from public.calcular_requisitos_logisticos_encomenda(v_encomendas[1]);
  if v_peso <> 7.500 or not v_peso_conhecido or v_volume <> 0.030000 or not v_volume_conhecido then raise exception 'Peso/volume conhecido não foi agregado'; end if;
  select * into v_peso, v_peso_conhecido, v_volume, v_volume_conhecido, v_refrigeracao, v_caixa, v_paletes, v_requisitos_conhecidos from public.calcular_requisitos_logisticos_encomenda(v_encomendas[4]);
  if v_peso is not null or v_peso_conhecido or v_volume is not null or v_volume_conhecido then raise exception 'Desconhecido foi tratado como zero'; end if;
  select * into v_peso, v_peso_conhecido, v_volume, v_volume_conhecido, v_refrigeracao, v_caixa, v_paletes, v_requisitos_conhecidos from public.calcular_requisitos_logisticos_encomenda(v_encomendas[5]);
  if v_peso is not null or v_peso_conhecido or v_volume is not null or v_volume_conhecido or v_refrigeracao is not true or v_caixa is not true or v_paletes is not true or v_requisitos_conhecidos then raise exception 'Known + unknown não preservou semântica'; end if;
  select * into v_peso, v_peso_conhecido, v_volume, v_volume_conhecido, v_refrigeracao, v_caixa, v_paletes, v_requisitos_conhecidos from public.calcular_requisitos_logisticos_encomenda(v_encomendas[6]);
  if v_refrigeracao is not false or v_caixa is not false or v_paletes is not false or not v_requisitos_conhecidos then raise exception 'false + false incorreto'; end if;
  select * into v_peso, v_peso_conhecido, v_volume, v_volume_conhecido, v_refrigeracao, v_caixa, v_paletes, v_requisitos_conhecidos from public.calcular_requisitos_logisticos_encomenda(v_encomendas[7]);
  if v_refrigeracao is not true or v_caixa is not true or v_paletes is not true or not v_requisitos_conhecidos then raise exception 'true + false incorreto'; end if;
  select * into v_peso, v_peso_conhecido, v_volume, v_volume_conhecido, v_refrigeracao, v_caixa, v_paletes, v_requisitos_conhecidos from public.calcular_requisitos_logisticos_encomenda(v_encomendas[8]);
  if v_refrigeracao is not null or v_caixa is not false or v_paletes is not null or v_requisitos_conhecidos then raise exception 'null + false incorreto'; end if;
end;
$$;

rollback;
