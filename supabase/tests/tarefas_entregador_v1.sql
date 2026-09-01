-- Teste estrutural; executar no SQL Editor após a migration, sempre sem persistir dados.
begin;
do $$
declare f text; c text;
begin
  foreach f in array array[
    'aceitar_atribuicao_entrega(uuid)', 'recusar_atribuicao_entrega(uuid,text)',
    'listar_tarefas_entregador()', 'obter_tarefa_entregador(uuid)'
  ] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and prosecdef) then raise exception 'RPC segura ausente: %', f; end if;
  end loop;
  select pg_get_constraintdef(oid) into c from pg_constraint where conrelid='public.eventos_encomenda'::regclass and conname='eventos_encomenda_tipo_evento_check';
  if c not like '%entregador_atribuido%' or c not like '%entregador_aceitou%' or c not like '%entregador_recusou%' then raise exception 'Eventos de atribuição incompletos'; end if;
  select pg_get_constraintdef(oid) into c from pg_constraint where conrelid='public.eventos_encomenda'::regclass and conname='eventos_encomenda_ator_tipo_check';
  if c not like '%entregador%' then raise exception 'Ator entregador ausente'; end if;
  if has_function_privilege('anon','public.aceitar_atribuicao_entrega(uuid)','execute') or has_function_privilege('anon','public.recusar_atribuicao_entrega(uuid,text)','execute') then raise exception 'Anon não pode operar tarefas'; end if;
end $$;
rollback;
