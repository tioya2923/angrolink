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
do $$ begin
 if current_database() not like 'angrolink_parceiros_email_%' then
  raise exception 'Destino de limpeza não autorizado';
 end if;
 if (select count(*) from auth.users)<>8
 or (select count(*) from auth.users where id in (select ('72610000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,8)n))<>8
 then raise exception 'Identidades divergentes: não limpar'; end if;
 delete from auth.users where id in (select ('72610000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,8)n);
 if exists(select 1 from auth.users) or exists(select 1 from public.profiles)
 or exists(select 1 from public.parceiros_entrega) or exists(select 1 from public.veiculos_entrega)
 or exists(select 1 from public.areas_cobertura_entrega) or exists(select 1 from public.documentos_parceiro_entrega)
 or exists(select 1 from public.versoes_documento_parceiro_entrega)
 or exists(select 1 from public.eventos_documento_parceiro_entrega)
 or exists(select 1 from parceiros_email_privado.legados)
 then raise exception 'Limpeza incompleta'; end if;
 raise notice 'ASSERT PASS: zero fixtures Auth, perfis, parceiros, veiculos, areas, documentos, versoes, eventos e isencoes';
end $$;
commit;
