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
select acl_probe.check(not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolcanlogin and not rolreplication,
 'papel sem atributos administrativos') from pg_roles where rolname='angrolink_acl_probe_versionada_20261028';
select acl_probe.check(not exists(select 1 from pg_auth_members m join pg_roles r on r.oid=m.member where r.rolname='angrolink_acl_probe_versionada_20261028'),'papel sem memberships');
set local role angrolink_acl_probe_versionada_20261028;
select acl_probe.check(has_database_privilege(current_user,current_database(),'TEMP'),'TEMP herdado confirmado');
select acl_probe.reject('select 1 from public.produtos','42501','sem SELECT direto comercial');
select acl_probe.reject('select 1 from parceiros_email_verificacao_privado.desafios','42501','sem acesso privado do Incremento I');
select acl_probe.reject('select public.apagar_minha_conta()','P0001','funcao invocavel mas exige sessao');
select acl_probe.reject('select public.handle_new_user()','0A000','trigger nao pode ser chamado por SELECT');
create temp table fake_auth_event(id uuid,email text,raw_user_meta_data jsonb);
create trigger proof_auth_insert after insert on fake_auth_event for each row execute function public.handle_new_user_profile();
select acl_probe.check(true,'trigger DEFINER associado a tabela temporaria');
reset role;
-- Fixture propria: Auth existente mas sem profile, para medir efeito comercial real do trigger.
delete from public.profiles where id='72610000-0000-4000-8000-000000000008';
set local role angrolink_acl_probe_versionada_20261028;
insert into fake_auth_event values('72610000-0000-4000-8000-000000000008','local-trigger@example.test','{"papel":"cliente","nome":"LOCAL"}');
reset role;
select acl_probe.check(exists(select 1 from public.profiles where id='72610000-0000-4000-8000-000000000008'), 'efeito real de trigger: profile local inserido');
insert into public.servicos(id,nome_servico,visualizacoes,destaque,destaque_inicio,destaque_ate,tipo_destaque)
values('72810000-0000-4000-8000-000000000001','LOCAL ACL',0,true,now()-interval '2 days',now()-interval '1 day','gratuito');
set local role angrolink_acl_probe_versionada_20261028;
select public.incrementar_visualizacao_servico('72810000-0000-4000-8000-000000000001');
select public.expirar_destaques_antigos();
reset role;
select acl_probe.check((select visualizacoes=1 and not destaque from public.servicos where id='72810000-0000-4000-8000-000000000001'),
 'efeitos reais sem sessao: metrica e expiracao na fixture');
rollback;
