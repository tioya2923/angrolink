-- Executar após a migration; testes estruturais em transação revertida.
begin;
do $$
declare f text; f_legado text; f_sincronizar text; f_estado text; f_historico text; v_erro text;
begin
  if to_regclass('public.versoes_documento_parceiro_entrega') is null or to_regclass('public.eventos_documento_parceiro_entrega') is null then raise exception 'Tabelas de versionamento ausentes'; end if;
  if has_table_privilege('authenticated','public.versoes_documento_parceiro_entrega','select') or has_table_privilege('anon','public.versoes_documento_parceiro_entrega','select') then raise exception 'Existe SELECT direto sobre versões com paths privados'; end if;
  if has_table_privilege('authenticated','public.eventos_documento_parceiro_entrega','select') or has_table_privilege('anon','public.eventos_documento_parceiro_entrega','select') then raise exception 'Existe SELECT direto sobre eventos documentais'; end if;
  if not exists(select 1 from pg_constraint where conrelid='public.versoes_documento_parceiro_entrega'::regclass and contype='u' and pg_get_constraintdef(oid) ~* 'UNIQUE \(documento_id, numero_versao\)') then raise exception 'Unicidade de versões ausente'; end if;
  if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relname='eventos_documento_parceiro_entrega' and not t.tgisinternal) then raise exception 'Proteção append-only ausente'; end if;
  select pg_get_functiondef('public.reenviar_documento_parceiro(uuid,text,text,text,date)'::regprocedure) into f;
  if f !~* 'insert into public\.versoes_documento_parceiro_entrega' or f !~* 'v_validade' or f !~* 'numero_documento=v_numero_documento' then raise exception 'Reenvio não preserva snapshots renovados'; end if;
  if f !~* 'Indique a nova validade para renovar este documento expirado' then raise exception 'Renovação expirada sem validade não é bloqueada'; end if;
  if f !~* 'greatest\(d\.validade,current_date\)' then raise exception 'Renovação expirada não exige validade futura'; end if;
  if position('substituido' in f) = 0 or position('reenviado' in f) = 0 then raise exception 'Timeline não regista substituição e reenvio'; end if;
  select pg_get_functiondef('public.reenviar_documento_parceiro(uuid,text,text)'::regprocedure) into f_legado;
  if f_legado !~* 'reenviar_documento_parceiro\(p_documento_id,p_frente_path,p_verso_path,null,null\)' then raise exception 'Contrato legado de três parâmetros ausente'; end if;
  if exists(select 1 from pg_proc where oid='public.reenviar_documento_parceiro(uuid,text,text,text,date)'::regprocedure and proargdefaults is not null) then raise exception 'A assinatura moderna ainda possui argumentos por defeito'; end if;
  if to_regprocedure('public.reenviar_documento_parceiro(uuid,text,text)') is null or to_regprocedure('public.reenviar_documento_parceiro(uuid,text,text,text,date)') is null then raise exception 'Assinaturas de reenvio ausentes'; end if;
  -- Com argumentos nulos as funções chegam à validação de domínio. Se a
  -- resolução fosse ambígua, PostgreSQL falharia antes com "is not unique".
  begin
    perform public.reenviar_documento_parceiro(null::uuid,null::text,null::text);
  exception when others then
    get stacked diagnostics v_erro = message_text;
    if v_erro ilike '%is not unique%' then raise exception 'Chamada legada é ambígua'; end if;
  end;
  begin
    perform public.reenviar_documento_parceiro(null::uuid,null::text,null::text,null::text,null::date);
  exception when others then
    get stacked diagnostics v_erro = message_text;
    if v_erro ilike '%is not unique%' then raise exception 'Chamada moderna é ambígua'; end if;
  end;
  select pg_get_functiondef('public.sincronizar_analise_versao_documento_parceiro()'::regprocedure) into f_sincronizar;
  if f_sincronizar !~* 'reenviar_versao_documento' then raise exception 'Reenvio pode criar evento submetido redundante'; end if;
  select pg_get_functiondef('public.proteger_estado_parceiro_entrega()'::regprocedure) into f_estado;
  if has_function_privilege('anon','public.listar_historico_documental_entregador_admin(uuid,integer,integer)'::regprocedure,'execute') then raise exception 'anon pode consultar histórico'; end if;
  if not has_function_privilege('authenticated','public.listar_historico_documental_entregador_admin(uuid,integer,integer)'::regprocedure,'execute') then raise exception 'Histórico administrativo deixou de estar disponível por RPC'; end if;
  select pg_get_functiondef('public.listar_historico_documental_entregador_admin(uuid,integer,integer)'::regprocedure) into f_historico;
  if f_historico ~* '''(frente_path|verso_path)''[[:space:]]*,' then raise exception 'RPC de histórico expõe paths privados'; end if;
  if position('versoes' in f_historico) = 0 or position('eventos' in f_historico) = 0 then raise exception 'RPC de histórico não devolve versões e eventos'; end if;
  if position('versao_atual_id' in f_historico) = 0 or position('veiculo_matricula' in f_historico) = 0 then raise exception 'RPC de histórico não preserva documento atual e veículo'; end if;
  if has_function_privilege('anon','public.reenviar_documento_parceiro(uuid,text,text)'::regprocedure,'execute') or has_function_privilege('anon','public.reenviar_documento_parceiro(uuid,text,text,text,date)'::regprocedure,'execute') then raise exception 'anon pode reenviar documentos'; end if;
  if position('documentacao_expirada' in f_estado) = 0 or position('em_analise' in f_estado) = 0 then raise exception 'Parceiro com documentação expirada não regressa a análise'; end if;
end $$;
rollback;
