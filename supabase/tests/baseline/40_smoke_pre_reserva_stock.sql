-- TEST-ONLY — NÃO APLICAR EM PRODUÇÃO
-- Smoke estrutural: falha cedo se a baseline não satisfizer o grafo do draft.

do $$
declare objeto text;
begin
  foreach objeto in array array['public.produtos','public.vendedores','public.clientes','public.encomendas','public.itens_encomenda','public.eventos_encomenda','public.pagamentos','public.tentativas_pagamento','public.eventos_pagamento','public.notificacoes','public.enderecos_entrega_encomenda','auth.users'] loop
    if to_regclass(objeto) is null then raise exception 'Baseline sem tabela obrigatória: %', objeto; end if;
  end loop;
  if to_regprocedure('auth.uid()') is null or to_regprocedure('public.gerar_codigo_publico_encomenda()') is null or to_regprocedure('public.garantir_perfil_comprador()') is null or to_regprocedure('public.validar_compra_produto_alheio(jsonb)') is null then
    raise exception 'Baseline sem função obrigatória do checkout.';
  end if;
  if to_regprocedure('extensions.digest(bytea,text)') is null then raise exception 'Baseline sem extensions.digest(bytea,text).'; end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
do $$
begin
  if auth.uid() <> '00000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'Shim auth.uid() não respeita a claim local.';
  end if;
  if auth.role() <> 'authenticated' then
    raise exception 'Shim auth.role() não respeita o papel local.';
  end if;
end;
$$;
reset role;
reset "request.jwt.claim.sub";
reset "request.jwt.claim.role";
