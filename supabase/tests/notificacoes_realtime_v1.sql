-- Notificações Realtime V1: validações estruturais pós-migration.
-- Este ficheiro não falsifica auth.uid(); os cenários com sessão real estão documentados no fim.
begin;

do $$
declare
  v_definicao text;
  v_policy record;
  v_constraint text;
begin
  if to_regclass('public.notificacoes') is null then
    raise exception 'Tabela notificacoes ausente';
  end if;

  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'notificacoes' and c.relrowsecurity
  ) then
    raise exception 'RLS não está ativo em notificacoes';
  end if;

  select * into v_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'notificacoes'
    and policyname = 'notificacoes_leitura_propria';
  if not found or v_policy.cmd <> 'SELECT'
    or position('utilizador_id = auth.uid()' in lower(v_policy.qual)) = 0 then
    raise exception 'Policy de leitura própria ausente ou insegura';
  end if;

  if not has_table_privilege('authenticated', 'public.notificacoes', 'select')
    or has_table_privilege('authenticated', 'public.notificacoes', 'insert')
    or has_table_privilege('authenticated', 'public.notificacoes', 'update')
    or has_table_privilege('authenticated', 'public.notificacoes', 'delete')
    or has_table_privilege('anon', 'public.notificacoes', 'select, insert, update, delete') then
    raise exception 'Privilégios diretos de notificações incorretos';
  end if;

  select pg_get_constraintdef(con.oid) into v_constraint
  from pg_constraint con
  where con.conrelid = 'public.notificacoes'::regclass
    and con.contype = 'c'
    and position('url_destino' in pg_get_constraintdef(con.oid)) > 0;
  if v_constraint is null
    or position('left(url_destino, 1)' in lower(v_constraint)) = 0
    or position('left(url_destino, 2) <> ''//''' in lower(v_constraint)) = 0 then
    raise exception 'Constraint de URL interno ausente ou incompleta';
  end if;

  if to_regprocedure('public.criar_notificacao(uuid,text,text,text,text,text,uuid,text,jsonb,text)') is null
    or to_regprocedure('public.listar_notificacoes(integer,timestamp with time zone)') is null
    or to_regprocedure('public.contar_notificacoes_nao_lidas()') is null
    or to_regprocedure('public.marcar_notificacao_como_lida(uuid)') is null
    or to_regprocedure('public.marcar_todas_notificacoes_como_lidas()') is null then
    raise exception 'Uma ou mais RPCs de notificação estão ausentes';
  end if;

  if has_function_privilege('anon', 'public.criar_notificacao(uuid,text,text,text,text,text,uuid,text,jsonb,text)', 'execute')
    or has_function_privilege('authenticated', 'public.criar_notificacao(uuid,text,text,text,text,text,uuid,text,jsonb,text)', 'execute') then
    raise exception 'Helper interno de notificações está exposto';
  end if;

  foreach v_definicao in array array[
    pg_get_functiondef('public.listar_notificacoes(integer,timestamp with time zone)'::regprocedure),
    pg_get_functiondef('public.contar_notificacoes_nao_lidas()'::regprocedure),
    pg_get_functiondef('public.marcar_notificacao_como_lida(uuid)'::regprocedure),
    pg_get_functiondef('public.marcar_todas_notificacoes_como_lidas()'::regprocedure)
  ] loop
    if position('auth.uid()' in lower(v_definicao)) = 0 then
      raise exception 'RPC pública sem validação explícita de sessão';
    end if;
  end loop;

  select pg_get_functiondef('public.criar_notificacao(uuid,text,text,text,text,text,uuid,text,jsonb,text)'::regprocedure)
  into v_definicao;
  if position('on conflict (chave_idempotencia)' in lower(v_definicao)) = 0
    or position('do nothing' in lower(v_definicao)) = 0
    or position('do update' in lower(v_definicao)) > 0
    or position('left(p_url_destino, 2) = ''//''' in lower(v_definicao)) = 0 then
    raise exception 'Helper sem idempotência ou URL segura';
  end if;

  select pg_get_functiondef('public.notificar_evento_encomenda()'::regprocedure)
  into v_definicao;
  if position('new.metadados ->> ''atribuicao_id''' in lower(v_definicao)) = 0
    or position('''/dashboard/tarefas/'' || v_atribuicao_id' in lower(v_definicao)) = 0
    or position('''/dashboard/compras/'' || v_encomenda.id' in lower(v_definicao)) = 0
    or position('''/dashboard/encomendas/'' || v_encomenda.id' in lower(v_definicao)) = 0
    or position('exception when others then' in lower(v_definicao)) = 0
    or position('limit 1' in lower(v_definicao)) > 0 then
    raise exception 'Trigger sem roteamento determinístico ou isolamento de falhas';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notificacoes'
  ) then
    raise exception 'notificacoes não foi adicionada a supabase_realtime';
  end if;
end;
$$;

-- Cenários autenticados manuais, com contas de teste e ROLLBACK:
-- 1. Cliente só lista/atualiza as próprias notificações; outro cliente não lê nem altera.
-- 2. Inserção direta, UPDATE e DELETE pelo browser falham; as RPCs funcionam para o dono.
-- 3. listar_notificacoes(NULL, ...) limita em 20, <= 0 em 1 e > 100 em 100.
-- 4. Repetir criar_notificacao com a mesma chave preserva a primeira linha e devolve o mesmo id.
-- 5. URL '/...' é aceite e '//host' é rejeitada pelo helper.
-- 6. Eventos de encomenda criam as rotas cliente/vendedor corretas e não expõem OTP, paths ou contactos.
-- 7. entregador_atribuido usa metadata.atribuicao_id e cria /dashboard/tarefas/{atribuicao_id}.
-- 8. Destinatário ausente ou falha do helper apenas produz WARNING; a operação comercial mantém-se válida.

rollback;
