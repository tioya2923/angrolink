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
do $$ begin
 if (select count(*) from parceiros_email_privado.legados)<>2
 or exists(select 1 from parceiros_email_privado.legados where user_id='72610000-0000-4000-8000-000000000004')
 or exists(select 1 from public.parceiros_entrega where user_id='72610000-0000-4000-8000-000000000004')
 then raise exception 'Corrida ampliou isenções ou persistiu candidatura inválida'; end if;
 raise notice 'ASSERT PASS: ativação concorrente não criou isenção nem candidatura indevida';
end $$;
