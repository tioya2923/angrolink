-- Testes estruturais; executar após a migration, dentro de uma transação.
begin;
do $$
declare
  v_funcao regprocedure;
  v_detalhe text;
  v_lista text;
begin
  foreach v_funcao in array array[
    'public.obter_entregador_admin(uuid)'::regprocedure,
    'public.listar_veiculos_entregador_admin(uuid,integer,integer)'::regprocedure,
    'public.listar_documentos_entregador_admin(uuid,integer,integer)'::regprocedure,
    'public.listar_areas_cobertura_entregador_admin(uuid,integer,integer)'::regprocedure
  ] loop
    if has_function_privilege('anon', v_funcao, 'EXECUTE') then raise exception 'anon pode executar %', v_funcao; end if;
    if not has_function_privilege('authenticated', v_funcao, 'EXECUTE') then raise exception 'authenticated não pode executar %', v_funcao; end if;
  end loop;

  select pg_get_functiondef('public.obter_entregador_admin(uuid)'::regprocedure) into v_detalhe;
  if v_detalhe !~* 'public\.eh_admin\(\)' or v_detalhe !~* 'security definer' then raise exception 'Proteção administrativa ausente'; end if;
  if v_detalhe ~* '''(frente_path|verso_path|foto_perfil_url|contacto_emergencia)''[[:space:]]*,' or v_detalhe ~* 'codigo_hash|access_token|refresh_token|service_role' then raise exception 'Detalhe expõe dado privado'; end if;
  if v_detalhe !~* '''historico_documental_disponivel'', false' or v_detalhe !~* '''entregas_disponiveis'', false' then raise exception 'Capacidades indisponíveis não estão explícitas'; end if;

  select pg_get_functiondef('public.listar_documentos_entregador_admin(uuid,integer,integer)'::regprocedure) into v_lista;
  if v_lista ~* '''(frente_path|verso_path)''[[:space:]]*,' then raise exception 'Lista expõe paths privados'; end if;
  if v_lista !~* '''frente_disponivel''' or v_lista !~* '''verso_disponivel''' or v_lista !~* 'limit v_limite offset v_offset' then raise exception 'Contrato documental seguro/paginado incompleto'; end if;
end;
$$;
rollback;
