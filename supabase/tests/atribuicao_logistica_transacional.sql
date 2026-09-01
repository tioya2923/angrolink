-- Executar após a migration. BEGIN/ROLLBACK garante que fixtures opcionais
-- não persistem. Testes com auth.uid() exigem sessões reais e estão listados no fim.
begin;

do $$
declare
  v_definicao text;
  v_proconfig text[];
  v_constraint text;
begin
  if to_regclass('public.atribuicoes_entrega_encomenda') is null
    or to_regprocedure('public.atribuir_entregador_encomenda(uuid,uuid,uuid)') is null
    or to_regprocedure('public.obter_atribuicao_entrega_encomenda_admin(uuid)') is null then
    raise exception 'Fundação de atribuição logística não foi encontrada';
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'atribuicoes_entrega_encomenda' and c.relrowsecurity
  ) then raise exception 'RLS não está ativo em atribuições'; end if;
  if has_table_privilege('authenticated', 'public.atribuicoes_entrega_encomenda', 'insert')
    or has_table_privilege('authenticated', 'public.atribuicoes_entrega_encomenda', 'update')
    or has_table_privilege('authenticated', 'public.atribuicoes_entrega_encomenda', 'delete') then
    raise exception 'Authenticated possui escrita direta em atribuições';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = 'public'
      and indexname = 'atribuicoes_entrega_uma_ativa_por_encomenda_idx'
      and indexdef ilike '%where%atribuida%aceite%'
  ) then raise exception 'Índice parcial de atribuição ativa ausente'; end if;

  select pg_get_constraintdef(c.oid) into v_constraint
  from pg_constraint c
  where c.conrelid = 'public.eventos_encomenda'::regclass
    and c.conname = 'eventos_encomenda_tipo_evento_check';
  if v_constraint is null then raise exception 'CHECK de tipo de evento não encontrada'; end if;
  if position('encomenda_criada' in lower(v_constraint)) = 0
    or position('vendedor_confirmou' in lower(v_constraint)) = 0
    or position('vendedor_recusou' in lower(v_constraint)) = 0
    or position('preparacao_iniciada' in lower(v_constraint)) = 0
    or position('pronta_para_levantamento' in lower(v_constraint)) = 0
    or position('levantamento_confirmado' in lower(v_constraint)) = 0
    or position('encomenda_concluida' in lower(v_constraint)) = 0
    or position('cliente_cancelou' in lower(v_constraint)) = 0
    or position('codigo_levantamento_gerado' in lower(v_constraint)) = 0
    or position('codigo_levantamento_regenerado' in lower(v_constraint)) = 0
    or position('tentativa_levantamento_falhou' in lower(v_constraint)) = 0
    or position('problema_reportado' in lower(v_constraint)) = 0
    or position('entregador_atribuido' in lower(v_constraint)) = 0
    or position('evento_inexistente' in lower(v_constraint)) > 0 then
    raise exception 'CHECK final de eventos não preserva exatamente o contrato esperado';
  end if;

  foreach v_definicao in array array[
    'public.atribuir_entregador_encomenda(uuid,uuid,uuid)',
    'public.obter_atribuicao_entrega_encomenda_admin(uuid)'
  ] loop
    select p.proconfig into v_proconfig from pg_proc p where p.oid = v_definicao::regprocedure;
    if not (select p.prosecdef from pg_proc p where p.oid = v_definicao::regprocedure)
      or not coalesce(v_proconfig, array[]::text[]) @> array['search_path=public']
      or has_function_privilege('anon', v_definicao, 'execute')
      or has_function_privilege('public', v_definicao, 'execute') then
      raise exception 'RPC administrativa sem proteção: %', v_definicao;
    end if;
  end loop;

  select pg_get_functiondef('public.atribuir_entregador_encomenda(uuid,uuid,uuid)'::regprocedure) into v_definicao;
  if position('for update' in lower(v_definicao)) = 0
    or position('entregador_pode_receber_entregas' in lower(v_definicao)) = 0
    or position('veiculo_operacional_para_entregas' in lower(v_definicao)) = 0
    or position('avaliar_compatibilidade_veiculo_encomenda' in lower(v_definicao)) = 0
    or position('v_estado is distinct from ''compativel''' in lower(v_definicao)) = 0
    or position('entregador_atribuido' in lower(v_definicao)) = 0 then
    raise exception 'RPC não revalida integralmente a atribuição';
  end if;
  if position('foto_veiculo_path' in lower(v_definicao)) > 0
    or position('frente_path' in lower(v_definicao)) > 0
    or position('codigo_hash' in lower(v_definicao)) > 0 then
    raise exception 'RPC de atribuição expõe segredo ou path privado';
  end if;
end;
$$;

-- Cenários manuais autenticados, sem falsificar auth.uid():
-- 1. anon/não-admin bloqueados; 2. levantamento bloqueado; 3. veículo de outro
-- parceiro bloqueado; 4. elegibilidade/operação/compatibilidade revalidadas;
-- 5. compatível cria atribuição com atribuido_por=auth.uid() e evento seguro;
-- 6. segunda atribuição ativa é bloqueada. Criar as fixtures exclusivamente nesta
-- transação, por referências FK de contas de teste, e terminar com ROLLBACK.
rollback;
