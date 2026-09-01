-- Testes estruturais da fundação de entrega; executar depois da migration.
-- Não falsifica auth.uid() nem deixa dados persistentes.
begin;

do $$
declare
  v_definicao text;
  v_origem public.encomendas%rowtype;
  v_encomenda_id uuid;
  v_erro text;
begin
  if to_regclass('public.enderecos_entrega_encomenda') is null then
    raise exception 'Snapshot de destino de entrega ausente';
  end if;

  if not exists (
    select 1 from pg_class c
    where c.oid = 'public.enderecos_entrega_encomenda'::regclass
      and c.relrowsecurity
  ) then
    raise exception 'RLS ausente no snapshot de destino';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.encomendas'::regclass
      and conname = 'encomendas_modalidade_recebimento_check'
      and pg_get_constraintdef(oid) like '%levantamento%'
      and pg_get_constraintdef(oid) like '%entrega%'
  ) then
    raise exception 'Modalidades de encomenda incompletas';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.encomendas'::regclass
      and conname = 'encomendas_entrega_sem_tarifa_v1_check'
      and pg_get_constraintdef(oid) like '%entrega_centimos = 0%'
  ) then
    raise exception 'Entrega pode introduzir tarifa fictícia';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'enderecos_entrega_encomenda'
      and column_name in (
        'encomenda_id', 'destinatario_nome', 'destinatario_telefone',
        'provincia', 'municipio', 'bairro', 'endereco_detalhado',
        'ponto_referencia', 'instrucoes_entrega'
      )
    group by table_schema, table_name
    having count(*) = 9
  ) then
    raise exception 'Contrato do destino de entrega incompleto';
  end if;

  select pg_get_functiondef('public.validar_integridade_destino_entrega_encomenda()'::regprocedure)
    into v_definicao;
  if position('uma encomenda de entrega exige um destino completo' in lower(v_definicao)) = 0
    or position('uma encomenda de levantamento não pode ter destino de entrega' in lower(v_definicao)) = 0 then
    raise exception 'Integridade entre modalidade e destino incompleta';
  end if;

  if has_table_privilege('anon', 'public.enderecos_entrega_encomenda', 'select')
    or has_table_privilege('authenticated', 'public.enderecos_entrega_encomenda', 'insert')
    or has_table_privilege('authenticated', 'public.enderecos_entrega_encomenda', 'update')
    or has_table_privilege('authenticated', 'public.enderecos_entrega_encomenda', 'delete') then
    raise exception 'Privilégio direto indevido no destino de entrega';
  end if;

  if has_function_privilege('anon', 'public.validar_integridade_destino_entrega_encomenda()', 'execute')
    or has_function_privilege('authenticated', 'public.validar_integridade_destino_entrega_encomenda()', 'execute') then
    raise exception 'Função interna de destino está executável diretamente';
  end if;

  if to_regprocedure('public.criar_encomenda_levantamento(jsonb,text,text,text,text)') is null then
    raise exception 'RPC de levantamento deixou de existir';
  end if;

  if to_regprocedure('public.proteger_snapshot_destino_entrega_encomenda()') is null then
    raise exception 'Proteção de imutabilidade do destino ausente';
  end if;

  -- Fixture reversível: insere uma encomenda de levantamento real, passando
  -- pelo trigger de elegibilidade do vendedor e pelo constraint trigger novo.
  select e.* into v_origem
  from public.encomendas e
  where e.modalidade_recebimento = 'levantamento'
    and public.vendedor_pode_receber_encomendas(e.vendedor_id)
  order by e.criado_em
  limit 1;

  if not found then
    raise exception 'É necessária uma encomenda de levantamento com vendedor elegível para o teste funcional.';
  end if;

  insert into public.encomendas (
    codigo_publico, cliente_id, vendedor_id, estado, modalidade_recebimento,
    moeda, subtotal_centimos, desconto_centimos, entrega_centimos, total_centimos,
    destinatario_nome, destinatario_telefone, provincia, municipio, bairro,
    endereco_levantamento, ponto_referencia, observacoes_cliente
  ) values (
    format('ANG-%s-%s', to_char(current_date, 'YYYY'), upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
    v_origem.cliente_id, v_origem.vendedor_id, 'aguardando_confirmacao', 'levantamento',
    v_origem.moeda, v_origem.subtotal_centimos, v_origem.desconto_centimos, 0, v_origem.subtotal_centimos - v_origem.desconto_centimos,
    v_origem.destinatario_nome, v_origem.destinatario_telefone, v_origem.provincia, v_origem.municipio, v_origem.bairro,
    v_origem.endereco_levantamento, v_origem.ponto_referencia, v_origem.observacoes_cliente
  ) returning id into v_encomenda_id;

  execute 'set constraints all immediate';
  execute 'set constraints all deferred';

  -- Levantamento com destino é bloqueado pela validação diferida.
  begin
    insert into public.enderecos_entrega_encomenda (
      encomenda_id, destinatario_nome, destinatario_telefone, provincia,
      municipio, bairro, endereco_detalhado
    ) values (
      v_encomenda_id, 'Destinatário de teste', '+244900000000', 'Luanda',
      'Luanda', 'Mutamba', 'Rua de teste, número 1'
    );
    execute 'set constraints all immediate';
    raise exception 'Levantamento com destino foi aceite';
  exception when others then
    v_erro := sqlerrm;
    if position('levantamento não pode ter destino de entrega' in lower(v_erro)) = 0 then
      raise;
    end if;
  end;

  -- Entrega sem destino é bloqueada no momento de validar as constraints.
  begin
    update public.encomendas set modalidade_recebimento = 'entrega' where id = v_encomenda_id;
    execute 'set constraints all immediate';
    raise exception 'Entrega sem destino foi aceite';
  exception when others then
    v_erro := sqlerrm;
    if position('entrega exige um destino completo' in lower(v_erro)) = 0 then
      raise;
    end if;
  end;

  -- Entrega e destino no mesmo ciclo transacional são válidos.
  update public.encomendas set modalidade_recebimento = 'entrega' where id = v_encomenda_id;
  insert into public.enderecos_entrega_encomenda (
    encomenda_id, destinatario_nome, destinatario_telefone, provincia,
    municipio, bairro, endereco_detalhado, ponto_referencia
  ) values (
    v_encomenda_id, 'Destinatário de teste', '+244900000000', 'Luanda',
    'Luanda', 'Mutamba', 'Rua de teste, número 1', 'Portão verde'
  );
  execute 'set constraints all immediate';
  execute 'set constraints all deferred';

  -- Nem remoção de destino nem retorno a levantamento podem quebrar uma
  -- entrega persistida; ambos os casos falham no commit/validação diferida.
  begin
    delete from public.enderecos_entrega_encomenda where encomenda_id = v_encomenda_id;
    execute 'set constraints all immediate';
    raise exception 'Entrega sem destino após remoção foi aceite';
  exception when others then
    v_erro := sqlerrm;
    if position('entrega exige um destino completo' in lower(v_erro)) = 0 then
      raise;
    end if;
  end;

  begin
    update public.encomendas set modalidade_recebimento = 'levantamento' where id = v_encomenda_id;
    execute 'set constraints all immediate';
    raise exception 'Levantamento com destino foi aceite após alteração de modalidade';
  exception when others then
    v_erro := sqlerrm;
    if position('levantamento não pode ter destino de entrega' in lower(v_erro)) = 0 then
      raise;
    end if;
  end;

  -- O snapshot nunca é editável, mesmo antes de qualquer futuro fluxo de entrega.
  begin
    update public.enderecos_entrega_encomenda
    set bairro = 'Outro bairro'
    where encomenda_id = v_encomenda_id;
    raise exception 'Snapshot de destino foi alterado';
  exception when others then
    v_erro := sqlerrm;
    if position('snapshot imutável' in lower(v_erro)) = 0 then
      raise;
    end if;
  end;
end;
$$;

rollback;
