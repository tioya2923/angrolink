-- Testes estruturais do Vendedor 360; executar após a migration, dentro de uma transação.
-- Não simula auth.uid(): os fluxos autenticados continuam no roteiro manual de Admin 360.
begin;

do $$
declare
  v_detalhe text;
  v_lista text;
  v_funcao regprocedure;
begin
  if to_regprocedure('public.obter_vendedor_admin(uuid)') is null then
    raise exception 'RPC obter_vendedor_admin inexistente';
  end if;

  foreach v_funcao in array array[
    'public.obter_vendedor_admin(uuid)'::regprocedure,
    'public.listar_produtos_vendedor_admin(uuid,integer,integer)'::regprocedure,
    'public.listar_servicos_vendedor_admin(uuid,integer,integer)'::regprocedure,
    'public.listar_encomendas_vendedor_admin(uuid,integer,integer)'::regprocedure,
    'public.listar_disputas_vendedor_admin(uuid,integer,integer)'::regprocedure,
    'public.listar_historico_documental_vendedor_admin(uuid,integer,integer)'::regprocedure
  ] loop
    if has_function_privilege('anon', v_funcao, 'EXECUTE') then
      raise exception 'anon pode executar %', v_funcao;
    end if;
    if not has_function_privilege('authenticated', v_funcao, 'EXECUTE') then
      raise exception 'authenticated não pode executar %', v_funcao;
    end if;
  end loop;

  select pg_get_functiondef('public.obter_vendedor_admin(uuid)'::regprocedure) into v_detalhe;
  if v_detalhe !~* 'public\.eh_admin\(\)' or v_detalhe !~* 'security definer' then
    raise exception 'Proteção administrativa ausente';
  end if;
  -- Os paths podem ser consultados internamente apenas para produzir os
  -- indicadores frente_disponivel/verso_disponivel. O contrato não pode,
  -- contudo, expor frente_path ou verso_path como chaves JSON.
  if v_detalhe ~* '''(frente_path|verso_path)''[[:space:]]*,'
    or v_detalhe ~* 'codigo_hash|access_token|refresh_token|service_role' then
    raise exception 'Contrato expõe caminho privado ou segredo';
  end if;
  if v_detalhe !~* '''frente_disponivel''[[:space:]]*,'
    or v_detalhe !~* '''verso_disponivel''[[:space:]]*,' then
    raise exception 'Contrato deixou de indicar a disponibilidade de frente e verso';
  end if;
  if v_detalhe !~* 'historico_documental_recente' or v_detalhe !~* 'limit 20' then
    raise exception 'Histórico documental recente não está limitado';
  end if;
  if v_detalhe ~* '''produtos''' or v_detalhe ~* '''encomendas''' or v_detalhe ~* '''disputas''' then
    raise exception 'Detalhe ainda devolve coleção operacional ilimitada';
  end if;
  if v_detalhe !~* 'pagamentos_vendedor' or v_detalhe !~* 'financeiro_pagamentos' or v_detalhe !~* 'repasses as' then
    raise exception 'Agregados financeiros não estão separados';
  end if;
  if v_detalhe !~* '''total_encomendas''.*from public\.encomendas' or v_detalhe !~* '''total_pagamentos''' then
    raise exception 'Semântica de encomendas/pagamentos incorreta';
  end if;
  if v_detalhe !~* '''gmv_bruto_centimos''' or v_detalhe !~* '''gmv_efetivo_centimos''' then
    raise exception 'GMV bruto/efetivo não está explícito';
  end if;

  select pg_get_functiondef('public.listar_produtos_vendedor_admin(uuid,integer,integer)'::regprocedure) into v_lista;
  if v_lista !~* '''preco_base''' or v_lista !~* '''preco_promocional''' or v_lista ~* '''preco''[[:space:]]*,[[:space:]]*coalesce' then
    raise exception 'Preço do produto não preserva a distinção comercial';
  end if;
  if v_lista !~* 'limit v_limite offset v_offset' or v_lista !~* '''total_resultados''' then
    raise exception 'Paginação de produtos incompleta';
  end if;
end;
$$;

-- A relação é um-para-um hoje, mas a projeção não depende desta garantia para
-- somar GMV, comissão ou valor do vendedor: confirma o contrato do schema.
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'repasses_vendedor'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ~* '^UNIQUE \(pagamento_id\)'
  ) then
    raise exception 'repasses_vendedor.pagamento_id deixou de ser único';
  end if;
end;
$$;

rollback;
