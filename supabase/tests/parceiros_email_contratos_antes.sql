\set ON_ERROR_STOP on
\if :{?prova_db}
\else
  \quit 3
\endif
select current_database() = :'prova_db'
  and current_database() like 'angrolink_parceiros_email_inc1_%' as destino_correto \gset
\if :destino_correto
\else
  \quit 3
\endif
-- Mesma sessao psql: este snapshot temporario sobrevive ao COMMIT da migration.
-- Apenas schemas preexistentes; triggers internos de integridade referencial nao sao comerciais.
create temporary view contrato_anterior_atual as
select 'schema'::text as tipo, n.oid::text as chave,
  row(n.nspowner,n.nspacl)::text as valor
from pg_namespace n where n.nspname in ('public','auth','parceiros_email_privado')
union all
select 'relacao', c.oid::text,
  row(c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity)::text as valor
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','auth','parceiros_email_privado')
union all
select 'indice', i.indexrelid::text, pg_get_indexdef(i.indexrelid)
from pg_index i join pg_class c on c.oid=i.indrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','auth','parceiros_email_privado')
union all
select 'trigger', t.oid::text, pg_get_triggerdef(t.oid)
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and n.nspname in ('public','auth','parceiros_email_privado')
union all
select 'funcao', p.oid::text, pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'')
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','auth','parceiros_email_privado') and p.prokind in ('f','p')
union all
select 'constraint', k.oid::text, pg_get_constraintdef(k.oid)
from pg_constraint k join pg_namespace n on n.oid=k.connamespace
where n.nspname in ('public','auth','parceiros_email_privado')
union all
select 'policy', oid::text, row(polrelid,polname,polcmd,polroles,polqual,polwithcheck)::text
from pg_policy where polrelid in (select c.oid from pg_class c join pg_namespace n
  on n.oid=c.relnamespace where n.nspname in ('public','auth','parceiros_email_privado'))
union all
select 'snapshot', 'legados', coalesce(jsonb_agg(to_jsonb(l) order by to_jsonb(l)::text)::text,'[]')
from parceiros_email_privado.legados l
union all
select 'snapshot', 'ativacao', coalesce(jsonb_agg(to_jsonb(a) order by to_jsonb(a)::text)::text,'[]')
from parceiros_email_privado.ativacao a;
create temporary table contrato_anterior as select * from contrato_anterior_atual;
