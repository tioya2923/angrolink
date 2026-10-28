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
create schema acl_probe authorization postgres;
grant usage on schema acl_probe to anon,authenticated,angrolink_acl_probe_versionada_20261028;
create function acl_probe.check(ok boolean,title text) returns void language plpgsql security invoker as $$
begin if ok is distinct from true then raise exception 'ASSERT FAIL: %',title; end if;
raise notice 'ASSERT PASS: %',title; end $$;
create function acl_probe.reject(q text,code text,title text) returns void language plpgsql security invoker as $$
declare observed text;
begin
 begin execute q; exception when others then get stacked diagnostics observed=returned_sqlstate; end;
 perform acl_probe.check(observed=code,title||' SQLSTATE='||coalesce(observed,'none'));
end $$;
grant execute on function acl_probe.check(boolean,text),acl_probe.reject(text,text,text) to anon,authenticated,angrolink_acl_probe_versionada_20261028;
create function acl_probe.inventory() returns jsonb language sql security invoker as $$
 select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definer',p.prosecdef,
 'owner',pg_get_userbyid(p.proowner),'config',p.proconfig,'trigger',p.prorettype='trigger'::regtype,
 'aclRaw',p.proacl::text,'aclEffective',coalesce(p.proacl,acldefault('f',p.proowner))::text,
 'public',exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'),
 'backend',has_function_privilege('angrolink_acl_probe_versionada_20261028',p.oid,'EXECUTE'),
 'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),
 'service_role',has_function_privilege('service_role',p.oid,'EXECUTE')) order by p.proname)
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';
$$;
-- Lista nominal: nao se altera qualquer funcao fora deste conjunto auditado.
create table acl_probe.allowed(signature text primary key);
insert into acl_probe.allowed values
('public.apagar_minha_conta()'),
('public.criar_pedido_parceiro_entrega(jsonb,jsonb,jsonb,jsonb)'),
('public.criar_versao_inicial_documento_parceiro()'),
('public.desativar_minha_conta()'),
('public.destacar_servico_gratis(uuid)'),
('public.expirar_destaques_antigos()'),
('public.handle_new_user()'),
('public.handle_new_user_profile()'),
('public.incrementar_clique_whatsapp_servico(uuid)'),
('public.incrementar_visualizacao_servico(uuid)'),
('public.is_admin_atual()'),
('public.is_dono_vendedor(uuid)'),
('public.is_vendedor_aprovado(uuid)'),
('public.proteger_analise_documento_vendedor()'),
('public.proteger_campos_vendedor()'),
('public.proteger_eventos_documento_parceiro()'),
('public.proteger_versao_documento_parceiro()'),
('public.registar_evento_documento_vendedor()'),
('public.remover_destaque_servico(uuid)'),
('public.sincronizar_analise_versao_documento_parceiro()'),
('public.submeter_pedido_parceiro_entrega(uuid)'),
('public.validar_veiculo_do_documento_parceiro()');
create table acl_probe.acl_before as select p.oid,p.oid::regprocedure::text as signature,p.proacl,
  exists(select 1 from acl_probe.allowed l where to_regprocedure(l.signature)=p.oid) as allowed
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';
create table acl_probe.changed(oid oid primary key,signature text,old_acl aclitem[]);
create view acl_probe.metadata_now as
select 'function'::text kind,p.oid::text key,pg_get_functiondef(p.oid)||row(p.proowner,p.proconfig)::text val
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','auth','parceiros_email_privado','parceiros_email_verificacao_privado') and p.prokind='f'
union all select 'trigger',t.oid::text,pg_get_triggerdef(t.oid)||t.tgenabled::text from pg_trigger t where not t.tgisinternal
union all select 'policy',p.oid::text,row(p.polrelid,p.polname,p.polcmd,p.polroles,p.polqual,p.polwithcheck)::text from pg_policy p
union all select 'table',c.oid::text,row(c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity)::text
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','auth','parceiros_email_privado','parceiros_email_verificacao_privado')
union all select 'constraint',oid::text,pg_get_constraintdef(oid) from pg_constraint where connamespace in
 (select oid from pg_namespace where nspname in('public','auth','parceiros_email_privado','parceiros_email_verificacao_privado'))
union all select 'schema',oid::text,row(nspowner,nspacl)::text from pg_namespace where nspname in('public','auth','parceiros_email_privado','parceiros_email_verificacao_privado')
union all select 'defaults',oid::text,row(defaclrole,defaclnamespace,defaclobjtype,defaclacl)::text from pg_default_acl
union all select 'snapshot','legados',coalesce(jsonb_agg(to_jsonb(l) order by to_jsonb(l)::text)::text,'[]') from parceiros_email_privado.legados l
union all select 'snapshot','ativacao',coalesce(jsonb_agg(to_jsonb(l) order by to_jsonb(l)::text)::text,'[]') from parceiros_email_privado.ativacao l;
create table acl_probe.metadata_before as select * from acl_probe.metadata_now;
create table acl_probe.data_before(rel text primary key,digest text);
create table acl_probe.auth_before as select id,email,aud,role,created_at,updated_at,raw_app_meta_data,raw_user_meta_data from auth.users;
do $$declare r record; d text; begin
 for r in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' loop
 execute format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''[]'')) from %I.%I t',r.nspname,r.relname) into d;
 insert into acl_probe.data_before values(format('%I.%I',r.nspname,r.relname),d);
 end loop; end $$;


insert into acl_probe.changed
select p.oid,l.signature,p.proacl from acl_probe.allowed l
join pg_proc p on p.oid=to_regprocedure(l.signature)
where exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 where a.grantee=0 and a.privilege_type='EXECUTE');
