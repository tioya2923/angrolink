-- Testes estruturais do Diretório Global de Utilizadores V1.
-- Executar após aplicar a migration. Os cenários com sessões reais estão no roteiro manual.
begin;

do $$
declare
  v_assinatura regprocedure := 'public.listar_utilizadores_admin(text,text,text,boolean,text,integer,integer)'::regprocedure;
  v_definicao text;
begin
  if v_assinatura is null then
    raise exception 'RPC listar_utilizadores_admin inexistente';
  end if;

  select pg_get_functiondef(v_assinatura) into v_definicao;
  if position('security definer' in lower(v_definicao)) = 0
    or position('set search_path = public' in lower(v_definicao)) = 0
    or position('public.eh_admin()' in v_definicao) = 0
    or position('auth.uid()' in v_definicao) = 0 then
    raise exception 'A RPC não possui o limite de segurança esperado';
  end if;

  if has_function_privilege('anon', v_assinatura, 'execute') then
    raise exception 'A RPC do diretório não pode ser executada por anon';
  end if;

  if not has_function_privilege('authenticated', v_assinatura, 'execute') then
    raise exception 'A RPC do diretório deve estar disponível para authenticated e validar admin internamente';
  end if;

  if pg_get_function_result(v_assinatura) ~* 'frente_path|verso_path|numero_documento|contacto_emergencia|codigo_hash|otp|token|secret|metadados' then
    raise exception 'A projeção do diretório contém campos sensíveis proibidos';
  end if;

  if pg_get_function_result(v_assinatura) <> 'jsonb' then
    raise exception 'O diretório deve devolver um único contrato JSONB';
  end if;

  if position('array_remove(array' in lower(v_definicao)) = 0 or position('base_papeis' in lower(v_definicao)) = 0 then
    raise exception 'A projeção não preserva capacidades múltiplas por conta';
  end if;

  if position('limit v_limite offset v_offset' in lower(v_definicao)) = 0
    or position('least(greatest(coalesce(p_limite, 25), 1), 100)' in lower(v_definicao)) = 0 then
    raise exception 'A paginação protegida não foi encontrada';
  end if;

  if position('base_pesquisa' in lower(v_definicao)) = 0
    or position('p_papel = any(base_papeis)' in lower(v_definicao)) = 0 then
    raise exception 'Os filtros de pesquisa ou de papel não foram encontrados';
  end if;

  if position('base_estados_papeis' in lower(v_definicao)) = 0
    or position('jsonb_each_text(base_estados_papeis)' in lower(v_definicao)) = 0
    or position('total_filtrado' in lower(v_definicao)) = 0
    or position("'itens'" in lower(v_definicao)) = 0
    or position("'paginacao'" in lower(v_definicao)) = 0
    or position("'contagens'" in lower(v_definicao)) = 0 then
    raise exception 'Os estados por papel ou o total do filtro atual não foram encontrados';
  end if;
end;
$$;

-- O contrato mantém os metadados mesmo quando a página não possui itens.
do $$
declare
  v_resultado jsonb := jsonb_build_object(
    'itens', '[]'::jsonb,
    'paginacao', jsonb_build_object('total_resultados', 0, 'limite', 25, 'offset', 999),
    'contagens', jsonb_build_object('total_global', 30, 'clientes', 20, 'vendedores', 7, 'parceiros_entrega', 4, 'administradores', 1)
  );
begin
  if jsonb_typeof(v_resultado -> 'itens') <> 'array'
    or jsonb_array_length(v_resultado -> 'itens') <> 0
    or (v_resultado #>> '{paginacao,total_resultados}')::integer <> 0 then
    raise exception 'O contrato não preserva página vazia e total zero';
  end if;
  if not (v_resultado -> 'contagens' ?& array['total_global', 'clientes', 'vendedores', 'parceiros_entrega', 'administradores'])
    or (v_resultado #>> '{paginacao,offset}')::integer <> 999 then
    raise exception 'O contrato não preserva metadados para offset sem itens';
  end if;
end;
$$;

-- Casos sem sessão: verificam a semântica multi-papel que o contrato expõe.
do $$
declare
  v_cliente_parceiro jsonb := '{"cliente":"ativo","vendedor":null,"parceiro_entrega":"suspenso","admin":null}'::jsonb;
  v_cliente_vendedor jsonb := '{"cliente":"ativo","vendedor":"rejeitado","parceiro_entrega":null,"admin":null}'::jsonb;
  v_admin_parceiro jsonb := '{"cliente":null,"vendedor":null,"parceiro_entrega":"suspenso","admin":"ativo"}'::jsonb;
begin
  if v_cliente_parceiro ->> 'cliente' <> 'ativo'
    or v_cliente_parceiro ->> 'parceiro_entrega' <> 'suspenso' then
    raise exception 'Cliente ativo e parceiro suspenso não preservam estados independentes';
  end if;
  if v_cliente_vendedor ->> 'cliente' <> 'ativo'
    or v_cliente_vendedor ->> 'vendedor' <> 'rejeitado' then
    raise exception 'Cliente ativo e vendedor rejeitado não preservam estados independentes';
  end if;
  if v_admin_parceiro ->> 'admin' <> 'ativo'
    or v_admin_parceiro ->> 'parceiro_entrega' <> 'suspenso' then
    raise exception 'Admin não pode mascarar o estado do parceiro';
  end if;
end;
$$;

-- Todos os estados confirmados pelas constraints remotas são tratados deliberadamente.
do $$
declare
  v_vendedor text[] := array['pendente', 'aprovado', 'rejeitado', 'suspenso'];
  v_parceiro text[] := array['rascunho', 'documentos_pendentes', 'em_analise', 'aprovado', 'rejeitado', 'suspenso', 'documentacao_expirada'];
  v_documento_vendedor text[] := array['pendente', 'em_analise', 'aprovado', 'rejeitado', 'expirado'];
  v_documento_parceiro text[] := array['pendente', 'aprovado', 'rejeitado', 'expirado'];
  v_definicao text;
begin
  select pg_get_functiondef('public.listar_utilizadores_admin(text,text,text,boolean,text,integer,integer)'::regprocedure)
    into v_definicao;
  if exists (select 1 from unnest(v_vendedor) estado where position(quote_literal(estado) in v_definicao) = 0)
    or exists (select 1 from unnest(v_parceiro) estado where position(quote_literal(estado) in v_definicao) = 0)
    or exists (select 1 from unnest(v_documento_vendedor) estado where position(quote_literal(estado) in v_definicao) = 0)
    or exists (select 1 from unnest(v_documento_parceiro) estado where position(quote_literal(estado) in v_definicao) = 0) then
    raise exception 'Existe estado do schema sem tratamento deliberado no diretório';
  end if;
end;
$$;

rollback;
