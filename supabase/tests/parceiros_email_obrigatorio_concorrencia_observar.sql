\set ON_ERROR_STOP on
\if :{?prova_db}
\else
  \echo 'ERRO: indique -v prova_db=nome_da_copia_local'
  \quit 3
\endif
select current_database() = :'prova_db'
  and current_database() like 'angrolink_parceiros_email_%' as destino_correto \gset
\if :destino_correto
\else
  \echo 'ERRO: destino nao autorizado para fixtures'
  \quit 3
\endif
\if :{?observar_writer}
\else
  \echo 'ERRO: indique -v observar_writer=true ou false'
  \quit 3
\endif
\if :observar_writer
select exists(
 select 1 from pg_stat_activity a join pg_locks l on l.pid=a.pid
 where a.application_name='parceiros_email_writer' and a.datname=current_database()
 and a.wait_event_type='Lock' and l.database=(select oid from pg_database where datname=current_database())
 and l.relation='public.parceiros_entrega'::regclass and l.mode='RowExclusiveLock' and not l.granted
) as observado \gset
\else
select exists(
 select 1 from pg_stat_activity a join pg_locks l on l.pid=a.pid
 where a.application_name='parceiros_email_ativacao' and a.datname=current_database()
 and a.wait_event_type='Lock' and l.database=(select oid from pg_database where datname=current_database())
 and l.relation='public.parceiros_entrega'::regclass and l.mode='ShareRowExclusiveLock' and l.granted
) as observado \gset
\endif
\if :observado
 \echo 'ASSERT PASS: lock concorrente observado na base alvo'
\else
 \echo 'ASSERT FAIL: condição concorrente não observada; não declarar a corrida aprovada'
 \quit 3
\endif
