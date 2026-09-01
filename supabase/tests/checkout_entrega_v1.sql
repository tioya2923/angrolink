-- Checkout de entrega V1: validações pós-migration, sem persistir dados.
-- Os cenários de sucesso da RPC exigem uma sessão JWT real de cliente e devem
-- ser executados pelo roteiro autenticado; este ficheiro nunca falsifica auth.uid().
begin;

do $$
declare
  v_definicao text;
  v_erro text;
begin
  if to_regprocedure('public.criar_encomenda_entrega(jsonb,text,text,text,text,text,text,text,text,text)') is null then
    raise exception 'RPC criar_encomenda_entrega ausente';
  end if;

  select pg_get_functiondef(
    'public.criar_encomenda_entrega(jsonb,text,text,text,text,text,text,text,text,text)'::regprocedure
  ) into v_definicao;

  if position('criar_encomenda_levantamento' in lower(v_definicao)) > 0
    or position('update public.encomendas' in lower(v_definicao)) > 0 then
    raise exception 'Entrega não pode delegar no levantamento nem alterar modalidade depois de criada';
  end if;

  if position('modalidade_recebimento' in lower(v_definicao)) = 0
    or position('''entrega''' in lower(v_definicao)) = 0
    or position('territorio_angola_valido' in lower(v_definicao)) = 0
    or position('enderecos_entrega_encomenda' in lower(v_definicao)) = 0 then
    raise exception 'Contrato de modalidade ou destino de entrega incompleto';
  end if;

  if position('criar_pagamento_encomenda' in lower(v_definicao)) = 0
    or position('criar_tentativa_pagamento' in lower(v_definicao)) = 0
    or position('pagamento_na_entrega' in lower(v_definicao)) = 0 then
    raise exception 'Pagamento pendente na entrega não é criado pela operação';
  end if;

  if position('atribuicoes_entrega' in lower(v_definicao)) > 0
    or position('entregador_atribuido' in lower(v_definicao)) > 0
    or position('levantamento_confirmado' in lower(v_definicao)) > 0 then
    raise exception 'Checkout não pode atribuir entregador nem registar levantamento';
  end if;

  if has_function_privilege('anon', 'public.criar_encomenda_entrega(jsonb,text,text,text,text,text,text,text,text,text)', 'execute') then
    raise exception 'Anon possui execução indevida da RPC de entrega';
  end if;
  if not has_function_privilege('authenticated', 'public.criar_encomenda_entrega(jsonb,text,text,text,text,text,text,text,text,text)', 'execute') then
    raise exception 'Authenticated não possui execução da RPC de entrega';
  end if;

  -- Sem JWT a RPC tem de falhar antes de criar qualquer linha.
  begin
    perform public.criar_encomenda_entrega(
      '[]'::jsonb, 'Destinatário de teste', '+244900000000',
      'Luanda', 'Luanda', 'Mutamba', 'Rua de teste, número 1'
    );
    raise exception 'A RPC aceitou chamada sem sessão';
  exception when others then
    v_erro := sqlerrm;
    if position('sessão inválida' in lower(v_erro)) = 0 then
      raise;
    end if;
  end;
end;
$$;

-- Roteiro autenticado obrigatório (executar com cliente de teste real; ROLLBACK no fim):
-- 1. RPC com cliente sem perfil ativo -> bloqueada.
-- 2. [] / produtos repetidos / quantidade <= 0 -> bloqueados.
-- 3. produtos de vendedores distintos e produto indisponível -> bloqueados.
-- 4. território inválido ou bairro/endereço vazios -> bloqueados.
-- 5. produto de retalho, grossista e promocional -> preço/snapshot correto.
-- 6. mínimo e unidade indivisível -> bloqueados quando inválidos.
-- 7. sucesso -> modalidade='entrega', origem comercial preservada, destino separado,
--    entrega_centimos=0, itens e snapshots logísticos, pagamento/tentativa pendentes,
--    evento encomenda_criada, sem evento de levantamento nem atribuição automática.

rollback;
