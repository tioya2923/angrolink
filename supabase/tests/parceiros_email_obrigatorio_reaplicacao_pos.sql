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
 if (select count(*) from parceiros_email_privado.legados)<>2
   or exists(select 1 from parceiros_email_privado.legados where user_id='72610000-0000-4000-8000-000000000003')
 then raise exception 'Reaplicação ampliou isenções'; end if;
 raise notice 'ASSERT PASS: reaplicação não isentou candidatura posterior';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','72610000-0000-4000-8000-000000000003',true);
do $$ declare c text; begin
 if auth.uid()<>'72610000-0000-4000-8000-000000000003'::uuid then raise exception 'Identidade divergente'; end if;
 begin update public.parceiros_entrega set email=null where user_id=auth.uid();
 exception when check_violation then
   get stacked diagnostics c=constraint_name;
   if c<>'parceiro_email_nova_candidatura' then raise; end if;
   raise notice 'ASSERT PASS: UPDATE NULL continua recusado após reaplicação'; return;
 end;
 raise exception 'UPDATE NULL permitido indevidamente';
end $$;
rollback;
