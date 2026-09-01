-- Testes estruturais sem simular auth.uid().
-- Executar APÓS aplicar a migration, numa sessão SQL de teste.
-- Os testes autenticados estão documentados em docs/TESTES_ADMIN_360_V1.md.
begin;

do $$
declare
  v_rls_ativo boolean;
  v_assinatura text;
  v_definicao text;
begin
  if to_regclass('public.auditoria_administrativa') is null then
    raise exception 'auditoria_administrativa inexistente';
  end if;

  select relrowsecurity
    into v_rls_ativo
  from pg_class
  where oid = 'public.auditoria_administrativa'::regclass;

  if not coalesce(v_rls_ativo, false) then
    raise exception 'RLS não está ativo em auditoria_administrativa';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.auditoria_administrativa'::regclass
      and tgname = 'impedir_alteracao_auditoria_administrativa'
      and not tgisinternal
  ) then
    raise exception 'trigger append-only da auditoria inexistente';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'auditoria_administrativa_entidade_idx'
  ) then
    raise exception 'índice de entidade da auditoria inexistente';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'reembolsos_pagamento'
      and indexdef ilike '%chave_idempotencia%'
      and indexdef ilike '%unique%'
  ) then
    raise exception 'índice/constraint UNIQUE de idempotência de reembolsos inexistente';
  end if;

  foreach v_assinatura in array array[
    'public.listar_encomendas_admin(text,uuid,uuid,text,boolean,timestamp with time zone,timestamp with time zone)',
    'public.obter_encomenda_admin(uuid)',
    'public.listar_financeiro_admin()',
    'public.listar_disputas_admin(text)',
    'public.obter_disputa_admin(uuid)',
    'public.assumir_disputa_admin(uuid)',
    'public.resolver_disputa_sem_reembolso_admin(uuid,text)',
    'public.resolver_disputa_reembolso_parcial_admin(uuid,bigint,bigint,bigint,text,uuid)',
    'public.resolver_disputa_reembolso_total_admin(uuid,text,uuid)'
  ] loop
    if to_regprocedure(v_assinatura) is null then
      raise exception 'RPC administrativa inexistente: %', v_assinatura;
    end if;

    if has_function_privilege('anon', to_regprocedure(v_assinatura), 'EXECUTE') then
      raise exception 'RPC administrativa executável por anon: %', v_assinatura;
    end if;
  end loop;

  if (select count(*) from pg_proc where oid = 'public.resolver_disputa_reembolso_parcial_admin(uuid,bigint,bigint,bigint,text,uuid)'::regprocedure) <> 1 then
    raise exception 'A RPC parcial não possui uma definição final única';
  end if;
  if (select count(*) from pg_proc where oid = 'public.resolver_disputa_reembolso_total_admin(uuid,text,uuid)'::regprocedure) <> 1 then
    raise exception 'A RPC total não possui uma definição final única';
  end if;

  select pg_get_functiondef(
    'public.resolver_disputa_reembolso_parcial_admin(uuid,bigint,bigint,bigint,text,uuid)'::regprocedure
  ) into v_definicao;
  if v_definicao !~ 'v_taxa <> 0'
    or v_definicao !~ 'não permite reembolsar a taxa do processador' then
    raise exception 'A RPC parcial não bloqueia a taxa do processador na política V1';
  end if;

  select pg_get_functiondef('public.obter_encomenda_admin(uuid)'::regprocedure)
    into v_definicao;
  if v_definicao ~* 'codigo_hash|codigos_levantamento' then
    raise exception 'Contrato de obter_encomenda_admin expõe OTP ou hash';
  end if;

  select pg_get_functiondef('public.obter_disputa_admin(uuid)'::regprocedure)
    into v_definicao;
  if v_definicao ~* 'codigo_hash|codigos_levantamento' then
    raise exception 'Contrato de obter_disputa_admin expõe OTP ou hash';
  end if;
end;
$$;

rollback;
