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
select acl_probe.check(not exists((select * from acl_probe.metadata_before except select * from acl_probe.metadata_now)
 union all(select * from acl_probe.metadata_now except select * from acl_probe.metadata_before)),
 'corpos owners search_paths triggers policies tabelas defaults snapshot intactos');
select acl_probe.check(not exists(select 1 from acl_probe.acl_before b join pg_proc p on p.oid=b.oid
 where p.proacl is distinct from b.proacl and not exists(select 1 from acl_probe.changed c where c.oid=p.oid)),
 'apenas ACLs nominais alteradas');
select acl_probe.check(not exists(
 (select b.oid,a.grantee,a.grantor,a.privilege_type,a.is_grantable from acl_probe.acl_before b cross join lateral aclexplode(coalesce(b.proacl,acldefault('f',(select proowner from pg_proc where oid=b.oid)))) a where a.grantee<>0
 except select p.oid,a.grantee,a.grantor,a.privilege_type,a.is_grantable from pg_proc p join acl_probe.acl_before b on b.oid=p.oid cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee<>0)
 union all
 (select p.oid,a.grantee,a.grantor,a.privilege_type,a.is_grantable from pg_proc p join acl_probe.acl_before b on b.oid=p.oid cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee<>0
 except select b.oid,a.grantee,a.grantor,a.privilege_type,a.is_grantable from acl_probe.acl_before b cross join lateral aclexplode(coalesce(b.proacl,acldefault('f',(select proowner from pg_proc where oid=b.oid)))) a where a.grantee<>0)),
 'todos os grants explicitos nao PUBLIC preservados');
do $$declare r record;d text; begin
 for r in select * from acl_probe.data_before loop
 execute format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''[]'')) from %s t',r.rel) into d;
 perform acl_probe.check(d=r.digest,'dados preservados '||r.rel);
 end loop;end $$;
select acl_probe.check(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef
 and has_function_privilege('angrolink_acl_probe_versionada_20261028',p.oid,'EXECUTE')),'sem DEFINER comercial acessivel ao papel');
select acl_probe.check(not exists(
 (select * from acl_probe.auth_before except select id,email,aud,role,created_at,updated_at,raw_app_meta_data,raw_user_meta_data from auth.users)
 union all (select id,email,aud,role,created_at,updated_at,raw_app_meta_data,raw_user_meta_data from auth.users except select * from acl_probe.auth_before)),
 'fixtures Auth e metadados nao sensiveis preservados sem consultar hashes');


select acl_probe.check((select count(*) from acl_probe.allowed)=22,'allowlist exata de 22 assinaturas');
do $$declare r record;begin
 for r in select p.oid,l.signature from acl_probe.allowed l left join pg_proc p on p.oid=to_regprocedure(l.signature) loop
 perform acl_probe.check(r.oid is not null
 and not exists(select 1 from aclexplode(coalesce((select proacl from pg_proc where oid=r.oid),acldefault('f',(select proowner from pg_proc where oid=r.oid)))) a where a.grantee=0)
 and has_function_privilege('anon',r.oid,'EXECUTE')
 and has_function_privilege('authenticated',r.oid,'EXECUTE')
 and has_function_privilege('service_role',r.oid,'EXECUTE')
 and has_function_privilege('postgres',r.oid,'EXECUTE'),'ACL nominal preservada '||r.signature);
 end loop;
end $$;
