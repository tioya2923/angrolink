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
set application_name = 'parceiros_email_bloqueador';
begin;
lock table parceiros_email_privado.ativacao in access exclusive mode;
select pg_sleep(55);
rollback;
