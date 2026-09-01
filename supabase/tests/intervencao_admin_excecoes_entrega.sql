-- Estrutural; executar apenas depois de aplicar a migration correspondente.
begin;
do $$
declare v_def text;
begin
  if to_regclass('public.incidentes_operacionais_entrega') is null then raise exception 'Tabela de incidentes ausente'; end if;
  foreach v_def in array array[
    pg_get_functiondef('public.libertar_atribuicao_entrega_admin(uuid,text,uuid)'::regprocedure),
    pg_get_functiondef('public.registar_incidente_operacional_entrega_admin(uuid,text,text,uuid)'::regprocedure),
    pg_get_functiondef('public.resolver_incidente_operacional_entrega_admin(uuid,text,uuid)'::regprocedure)
  ] loop
    if position('security definer' in lower(v_def)) = 0 or position('eh_admin' in lower(v_def)) = 0 then raise exception 'RPC administrativa sem contexto seguro'; end if;
  end loop;
  select pg_get_functiondef('public.libertar_atribuicao_entrega_admin(uuid,text,uuid)'::regprocedure) into v_def;
  if position('recolhida' in lower(v_def)) = 0 or position('cancelada' in lower(v_def)) = 0 then raise exception 'Libertação não protege custódia nem encerra atribuição'; end if;
  select pg_get_functiondef('public.registar_incidente_operacional_entrega_admin(uuid,text,text,uuid)'::regprocedure) into v_def;
  if position('recolhida' in lower(v_def)) = 0 or position('chegou_destino' in lower(v_def)) = 0 then raise exception 'Incidente não limita operação pós-recolha'; end if;
  select pg_get_functiondef('public.notificar_intervencao_admin_entrega()'::regprocedure) into v_def;
  if position('exception when others' in lower(v_def)) > 0 then raise exception 'Notificação obrigatória não pode falhar silenciosamente'; end if;
  if exists (select 1 from pg_proc where oid in ('public.hash_intervencao_entrega_admin(jsonb)'::regprocedure, 'public.atualizar_atualizado_em_incidente_operacional_entrega()'::regprocedure, 'public.notificar_intervencao_admin_entrega()'::regprocedure) and has_function_privilege('authenticated', oid, 'execute')) then raise exception 'Helper interno exposto a authenticated'; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename in ('idempotencia_intervencao_entrega_admin','incidentes_operacionais_entrega')) then raise exception 'Tabelas de intervenção não devem possuir policy direta'; end if;
end $$;
rollback;
