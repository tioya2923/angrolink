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
-- Apenas prepara os objetos privados vazios para coordenar a primeira ativação
-- com locks reais. Não instala trigger, não captura isenções e não muda a candidata.
begin;
create schema parceiros_email_privado authorization postgres;
revoke all on schema parceiros_email_privado from public,anon,authenticated;
create table parceiros_email_privado.ativacao(
 unica boolean primary key default true check(unica),
 ativado_em timestamptz not null default transaction_timestamp()
);
create table parceiros_email_privado.legados(
 user_id uuid primary key references auth.users(id) on delete cascade,
 parceiro_id_original uuid not null
);
revoke all on all tables in schema parceiros_email_privado from public,anon,authenticated;
commit;
