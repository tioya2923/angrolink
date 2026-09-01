begin;

do $$
declare v_definicao text; v_pos_retorno_idempotente integer; v_pos_validacao_pronta integer;
begin
  if to_regprocedure('public.confirmar_chegada_origem_entregador(uuid)') is null
     or to_regprocedure('public.confirmar_recolha_encomenda_vendedor(uuid)') is null then
    raise exception 'RPCs de recolha bilateral ausentes';
  end if;
  if not has_function_privilege('authenticated', 'public.confirmar_chegada_origem_entregador(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.confirmar_recolha_encomenda_vendedor(uuid)', 'execute')
     or has_function_privilege('anon', 'public.confirmar_chegada_origem_entregador(uuid)', 'execute')
     or has_function_privilege('anon', 'public.confirmar_recolha_encomenda_vendedor(uuid)', 'execute') then
    raise exception 'Privilégios das RPCs de recolha incorretos';
  end if;
  select pg_get_functiondef('public.confirmar_chegada_origem_entregador(uuid)'::regprocedure) into v_definicao;
  if position('for update' in lower(v_definicao)) = 0 or position('chegou_origem' in lower(v_definicao)) = 0 then raise exception 'Chegada sem lock ou estado protegido'; end if;
  if position('join public.parceiros_entrega p on p.id = a.parceiro_entrega_id' in lower(v_definicao)) = 0
     or position('p.user_id = auth.uid()' in lower(v_definicao)) = 0 then
    raise exception 'Chegada sem autorização do parceiro proprietário';
  end if;
  if position($idempotente$if v_atribuicao.estado = 'recolhida' and v_encomenda.estado = 'recolhida'$idempotente$ in lower(v_definicao)) = 0
     or position($idempotente$if v_atribuicao.estado = 'chegou_origem'$idempotente$ in lower(v_definicao)) = 0
     or position($idempotente$if (v_atribuicao.estado = 'recolhida') <> (v_encomenda.estado = 'recolhida')$idempotente$ in lower(v_definicao)) = 0 then
    raise exception 'Idempotência da chegada não protege os estados consistentes';
  end if;
  v_pos_retorno_idempotente := position($ordem$if v_atribuicao.estado = 'chegou_origem'$ordem$ in lower(v_definicao));
  v_pos_validacao_pronta := position($ordem$if v_encomenda.modalidade_recebimento <> 'entrega' or v_encomenda.estado <> 'pronta_para_levantamento'$ordem$ in lower(v_definicao));
  if v_pos_retorno_idempotente = 0 or v_pos_validacao_pronta = 0 or v_pos_retorno_idempotente > v_pos_validacao_pronta then
    raise exception 'Retorno idempotente da chegada ocorre depois da validação de encomenda pronta';
  end if;
  if position('insert into public.eventos_encomenda' in lower(v_definicao)) < v_pos_validacao_pronta then
    raise exception 'Evento de chegada pode ser criado antes da transição válida';
  end if;
  select pg_get_functiondef('public.confirmar_recolha_encomenda_vendedor(uuid)'::regprocedure) into v_definicao;
  if position('recolhida' in lower(v_definicao)) = 0 or position('vendedores' in lower(v_definicao)) = 0 then raise exception 'Recolha sem autorização do vendedor'; end if;
  if not exists (select 1 from pg_constraint where conrelid='public.atribuicoes_entrega_encomenda'::regclass and pg_get_constraintdef(oid) ilike '%chegou_origem%') then raise exception 'Estados de recolha ausentes'; end if;
end $$;

-- Cenários funcionais autenticados, a executar através de uma sessão real de
-- parceiro de entrega e sempre dentro de BEGIN/ROLLBACK. Não simular auth.uid().
--
-- 1. Com uma atribuição aceite e encomenda pronta:
--    chamar confirmar_chegada_origem_entregador(atribuicao_id) uma vez;
--    confirmar estado=chegou_origem e exatamente um evento
--    entregador_chegou_origem para a atribuição.
-- 2. Repetir a chamada antes da recolha; confirmar o mesmo estado/timestamp e
--    que o total de eventos entregador_chegou_origem não aumentou.
-- 3. Como vendedor real, confirmar a recolha; como o mesmo parceiro, repetir
--    confirmar_chegada_origem_entregador(atribuicao_id); confirmar retorno
--    estado=recolhida, encomenda=recolhida e nenhum novo evento de chegada.
-- 4. Numa sessão de outro parceiro autenticado, chamar com a mesma atribuição
--    e confirmar erro de permissão, sem alteração de estado ou evento.
--
-- Estes cenários dependem de uma sessão JWT real; o SQL Editor não fornece
-- auth.uid() de parceiro e o teste não cria contexto de autenticação artificial.

rollback;
