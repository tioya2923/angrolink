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
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','72610000-0000-4000-8000-000000000003',true);
do $$ begin if auth.uid() <> '72610000-0000-4000-8000-000000000003'::uuid then raise exception 'Identidade divergente'; end if; end $$;
insert into public.parceiros_entrega(user_id,nome_completo,telefone,provincia,municipio,contacto_emergencia,email)
values(auth.uid(),'Novo antes da reaplicação','+244923726103','Huambo','Huambo','+244923726199','nova@example.test');
commit;
