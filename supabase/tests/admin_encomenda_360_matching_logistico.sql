-- Executar no SQL Editor após aplicar a migration, sempre como teste estrutural.
begin;

do $$
declare
  v_funcao text;
  v_proconfig text[];
begin
  if to_regprocedure('public.obter_encomenda_admin(uuid)') is null
    or to_regprocedure('public.listar_compatibilidade_logistica_encomenda_admin(uuid)') is null then
    raise exception 'RPCs Admin Encomenda 360 não foram encontradas';
  end if;

  foreach v_funcao in array array[
    'public.obter_encomenda_admin(uuid)',
    'public.listar_compatibilidade_logistica_encomenda_admin(uuid)'
  ] loop
    select p.proconfig into v_proconfig from pg_proc p where p.oid = v_funcao::regprocedure;
    if not (select p.prosecdef from pg_proc p where p.oid = v_funcao::regprocedure)
      or not coalesce(v_proconfig, array[]::text[]) @> array['search_path=public'] then
      raise exception 'RPC Admin sem contexto seguro: %', v_funcao;
    end if;
    if has_function_privilege('anon', v_funcao, 'execute')
      or has_function_privilege('public', v_funcao, 'execute') then
      raise exception 'RPC Admin exposta a papel não autorizado: %', v_funcao;
    end if;
  end loop;

  select pg_get_functiondef('public.obter_encomenda_admin(uuid)'::regprocedure) into v_funcao;
  if position('imagem_principal_snapshot' in lower(v_funcao)) = 0
    or position('descricao_snapshot' in lower(v_funcao)) = 0
    or position('enderecos_entrega_encomenda' in lower(v_funcao)) = 0
    or position('calcular_requisitos_logisticos_encomenda' in lower(v_funcao)) = 0
    or position('tentativas_pagamento' in lower(v_funcao)) = 0
    or position('eventos_pagamento' in lower(v_funcao)) = 0 then
    raise exception 'Detalhe Admin 360 não contém todas as projeções necessárias';
  end if;
  if position('codigo_hash' in lower(v_funcao)) > 0
    or position('frente_path' in lower(v_funcao)) > 0
    or position('verso_path' in lower(v_funcao)) > 0 then
    raise exception 'Detalhe Admin 360 expõe segredo ou caminho privado';
  end if;

  select pg_get_functiondef('public.listar_compatibilidade_logistica_encomenda_admin(uuid)'::regprocedure) into v_funcao;
  if position('avaliar_compatibilidade_veiculo_encomenda' in lower(v_funcao)) = 0
    or position('modalidade <> ''entrega''' in lower(v_funcao)) = 0 then
    raise exception 'Matching Admin não respeita a fonte canónica ou modalidade';
  end if;
  if position('foto_veiculo_path' in lower(v_funcao)) > 0
    or position('foto_perfil_url' in lower(v_funcao)) > 0
    or position('frente_path' in lower(v_funcao)) > 0 then
    raise exception 'Matching Admin expõe media privada';
  end if;
end;
$$;

-- Testes autenticados devem ser manuais com uma sessão real: anon/não-admin
-- bloqueados; admin lê a encomenda; levantamento devolve matching vazio; entrega
-- devolve compatível/incompatível/dados_incompletos sem alterar qualquer veículo.
rollback;
