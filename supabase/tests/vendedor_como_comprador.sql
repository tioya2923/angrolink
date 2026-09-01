begin;

do $$
declare
  v_funcao text;
begin
  if to_regprocedure('public.garantir_perfil_comprador()') is null then
    raise exception 'RPC garantir_perfil_comprador ausente';
  end if;

  if to_regprocedure('public.validar_compra_produto_alheio(jsonb)') is null then
    raise exception 'Validação de compra própria ausente';
  end if;

  select pg_get_functiondef('public.garantir_perfil_comprador()'::regprocedure) into v_funcao;
  if position('security definer' in lower(v_funcao)) = 0
    or position('set search_path = public' in lower(v_funcao)) = 0
    or position('insert into public.clientes' in lower(v_funcao)) = 0 then
    raise exception 'Garantia de perfil comprador não possui contrato seguro';
  end if;

  if has_function_privilege('anon', 'public.garantir_perfil_comprador()', 'execute')
    or has_function_privilege('authenticated', 'public.garantir_perfil_comprador()', 'execute') then
    raise exception 'A função interna de perfil comprador foi exposta diretamente';
  end if;

  select pg_get_functiondef('public.validar_compra_produto_alheio(jsonb)'::regprocedure) into v_funcao;
  if position('vendedor.user_id = auth.uid()' in lower(v_funcao)) = 0
    or position('própria loja' in lower(v_funcao)) = 0 then
    raise exception 'A compra de produto próprio não é bloqueada no servidor';
  end if;
end;
$$;

rollback;
