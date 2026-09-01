begin;

do $$
declare
  v_funcao pg_proc%rowtype;
  v_definicao text;
begin
  select p.* into v_funcao
    from pg_proc p
   where p.oid = 'public.listar_vendedores_publicos(uuid[])'::regprocedure;

  if not found then
    raise exception 'RPC pública de vendedores não existe';
  end if;

  if not v_funcao.prosecdef
     or not exists (
       select 1
       from unnest(coalesce(v_funcao.proconfig, array[]::text[])) configuracao
       where configuracao = 'search_path=public'
     ) then
    raise exception 'RPC pública de vendedores sem contexto seguro';
  end if;

  v_definicao := pg_get_functiondef(v_funcao.oid);
  if position('status_aprovacao = ''aprovado''' in v_definicao) = 0
     or position('coalesce(v.conta_ativa, false) = true' in lower(v_definicao)) = 0 then
    raise exception 'RPC pública não filtra vendedor aprovado e ativo';
  end if;

  if has_table_privilege('anon', 'public.vendedores', 'select')
     or has_table_privilege('authenticated', 'public.vendedores', 'select') then
    raise exception 'Tabela vendedores foi reaberta por SELECT table-wide';
  end if;

  if not has_function_privilege('anon', 'public.listar_vendedores_publicos(uuid[])', 'execute')
     or not has_function_privilege('authenticated', 'public.listar_vendedores_publicos(uuid[])', 'execute') then
    raise exception 'RPC pública sem grant de execução esperado';
  end if;
end;
$$;

rollback;
