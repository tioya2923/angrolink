\set ON_ERROR_STOP on
\if :{?prova_db}
\else
 \quit 3
\endif
select current_database()=:'prova_db'
 and current_database() like 'angrolink_parceiros_email_acl_versionada_%' as safe \gset
\if :safe
\else
 \quit 3
\endif
begin;
select acl_probe.check(not exists(select 1 from acl_probe.changed c where has_function_privilege('angrolink_acl_probe_versionada_20261028',c.oid,'EXECUTE')),'nenhum EXECUTE residual nos objetos alterados');
set local role angrolink_acl_probe_versionada_20261028;
select acl_probe.reject('select public.expirar_destaques_antigos()','42501','expiracao comercial inacessivel depois');
select acl_probe.reject('select public.apagar_minha_conta()','42501','gestao de conta inacessivel antes do corpo');
select acl_probe.reject($q$select public.criar_pedido_parceiro_entrega('{}','{}','[]','{}')$q$,'42501','RPC comercial inacessivel antes do corpo');
create temp table fake_auth_event(id uuid,email text,raw_user_meta_data jsonb);
select acl_probe.reject('create trigger proof_auth_insert after insert on fake_auth_event for each row execute function public.handle_new_user_profile()','42501','associacao do trigger Auth bloqueada');
select acl_probe.reject('create trigger proof_event after insert on fake_auth_event for each row execute function public.registar_evento_documento_vendedor()','42501','associacao do trigger de eventos bloqueada');
do $$declare r record; begin
 for r in select p.oid::regprocedure::text as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef and p.prorettype='trigger'::regtype loop
 perform acl_probe.reject(format('create trigger proof_all_denied after insert on fake_auth_event for each row execute function %s',r.signature),
 '42501','associacao DEFINER recusada '||r.signature);
 end loop;
end $$;
select acl_probe.reject('select 1 from public.produtos','42501','sem SELECT comercial depois');
select acl_probe.reject('select 1 from parceiros_email_verificacao_privado.desafios','42501','sem acesso privado depois');
-- Trigger atualizado para INVOKER nao eleva privilegios: associacao pode continuar permitida.
create temp table veiculos_entrega(estado_verificacao text,motivo_rejeicao text);
create trigger proof_invoker before insert on veiculos_entrega for each row execute function public.proteger_verificacao_logistica();
select acl_probe.reject($q$insert into pg_temp.veiculos_entrega values('pendente',null)$q$,'42501','trigger INVOKER nao empresta acesso ao helper administrativo');
create temp table parceiros_entrega(user_id uuid,estado text,disponibilidade boolean,motivo_rejeicao text,motivo_suspensao text,aprovado_em timestamptz);
create trigger proof_invoker_partner before insert on parceiros_entrega for each row execute function public.proteger_estado_parceiro_entrega();
select acl_probe.reject($q$insert into pg_temp.parceiros_entrega(user_id,estado,disponibilidade) values('72610000-0000-4000-8000-000000000008','rascunho',false)$q$,
 '42501','segundo trigger INVOKER nao empresta acesso ao helper administrativo');
reset role;
rollback;
