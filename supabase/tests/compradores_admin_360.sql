-- Testes estruturais para Compradores 360 V1.
-- Executar depois de aplicar a migration, numa sessão de teste.
-- Testes com uma sessão autenticada estão em docs/TESTES_COMPRADORES_360_V1.md.
begin;

do $$
declare
  v_assinatura text;
  v_definicao text;
begin
  foreach v_assinatura in array array[
    'public.listar_compradores_admin(text,boolean,text,text,boolean,boolean,boolean,text,integer,integer)',
    'public.obter_comprador_admin(uuid)'
  ] loop
    if to_regprocedure(v_assinatura) is null then
      raise exception 'RPC de Compradores 360 inexistente: %', v_assinatura;
    end if;
    if has_function_privilege('anon', to_regprocedure(v_assinatura), 'EXECUTE') then
      raise exception 'RPC de Compradores 360 executável por anon: %', v_assinatura;
    end if;
  end loop;

  select pg_get_functiondef(
    'public.listar_compradores_admin(text,boolean,text,text,boolean,boolean,boolean,text,integer,integer)'::regprocedure
  ) into v_definicao;
  if v_definicao !~* 'public\.eh_admin\(\)' or v_definicao !~* 'security definer' then
    raise exception 'A lista de compradores não possui proteção administrativa esperada';
  end if;
  if v_definicao ~* 'codigo_hash|codigos_levantamento|access_token|refresh_token|service_role' then
    raise exception 'A lista de compradores expõe dados sensíveis';
  end if;

  select pg_get_functiondef('public.obter_comprador_admin(uuid)'::regprocedure) into v_definicao;
  if v_definicao !~* 'public\.eh_admin\(\)' or v_definicao !~* 'security definer' then
    raise exception 'O detalhe de comprador não possui proteção administrativa esperada';
  end if;
  if v_definicao ~* 'codigo_hash|codigos_levantamento|access_token|refresh_token|service_role' then
    raise exception 'O detalhe de comprador expõe dados sensíveis';
  end if;
end;
$$;

-- Cenários autenticados a validar com fixtures reais, sempre antes do ROLLBACK:
-- 1. pagamento pendente + tentativa pendente: mostra o método pendente;
-- 2. pagamento pendente + tentativa falhada mais recente: mostra esse método;
-- 3. pagamento confirmado + tentativa confirmada: mostra o método confirmado;
-- 4. pagamento confirmado sem tentativa confirmada: devolve metodo = null;
-- 5. pagamento confirmado + falhada mais recente e confirmada antiga: mostra a confirmada.
-- Estes casos não criam perfis/autenticação artificialmente neste ficheiro.

rollback;
