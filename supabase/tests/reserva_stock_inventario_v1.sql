-- Executar numa base Supabase/PostgreSQL LOCAL descartável antes da promoção.
-- O harness scripts/test-reserva-stock-local.ps1 aplica uma CÓPIA temporária
-- do draft, onde somente o ROLLBACK terminal é substituído por COMMIT. O draft
-- original permanece inalterado com BEGIN/ROLLBACK.
begin;

do $$
declare
  v_leitura regprocedure := to_regprocedure('public.obter_inventario_produto_vendedor(uuid)');
  v_escrita regprocedure := to_regprocedure('public.definir_inventario_produto_vendedor(uuid,boolean,numeric)');
  v_definicao text;
begin
  if v_leitura is null or v_escrita is null then
    raise exception 'RPCs de inventário do vendedor não foram criadas';
  end if;

  if not exists (
    select 1 from pg_proc p where p.oid = v_leitura and p.prosecdef
  ) then
    raise exception 'Leitura de inventário não usa contexto seguro';
  end if;

  if not exists (
    select 1 from pg_proc p where p.oid = v_escrita and p.prosecdef
  ) then
    raise exception 'Escrita de inventário não usa contexto seguro';
  end if;

  if has_function_privilege('anon', v_leitura, 'execute')
    or has_function_privilege('anon', v_escrita, 'execute') then
    raise exception 'anon recebeu execução indevida nas RPCs de inventário';
  end if;

  if not exists (
    select 1 from pg_class c
    where c.oid = 'public.inventarios_produto'::regclass
      and c.relrowsecurity
  ) then
    raise exception 'RLS não está ativo em inventarios_produto';
  end if;

  if has_table_privilege('authenticated', 'public.inventarios_produto', 'select')
    or has_table_privilege('authenticated', 'public.reservas_stock_encomenda', 'select') then
    raise exception 'Leitura direta de tabelas sensíveis foi concedida';
  end if;

  v_definicao := pg_get_functiondef(v_leitura);
  if position('quantidade_reservada' in v_definicao) = 0
    or position('v.user_id = auth.uid()' in v_definicao) = 0 then
    raise exception 'Projeção de inventário sem agregado ou titularidade';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'produtos'
      and t.tgname = 'proteger_unidade_produto_com_reservas_ativas'
      and not t.tgisinternal
  ) then
    raise exception 'Trigger de integridade da unidade não foi criado';
  end if;

  v_definicao := pg_get_functiondef(
    'public.proteger_unidade_produto_com_reservas_ativas()'::regprocedure
  );
  if position('old.unidade is not distinct from new.unidade' in lower(v_definicao)) = 0
    or position('r.estado = ''ativa''' in lower(v_definicao)) = 0
    or position('r.expira_em is null or r.expira_em > now()' in lower(v_definicao)) = 0 then
    raise exception 'Proteção de unidade não cobre a regra de reservas ativas';
  end if;
end;
$$;

-- Para os cenários funcionais, use fixtures sintéticas e sessões JWT locais
-- separadas (SET LOCAL ROLE authenticated + request.jwt.claim.sub). O harness
-- recusa hosts remotos e exige uma base local com nome de teste.
--
-- Casos funcionais pendentes: produto próprio legado; ativação com decimal;
-- redução acima/abaixo das reservas; desativação com/sem reservas; expiração
-- lazy; vendedor alheio; comprador; alteração de unidade sem inventário, sem
-- reservas, igual, com reserva ativa, com reserva vencida e outros campos.

rollback;
