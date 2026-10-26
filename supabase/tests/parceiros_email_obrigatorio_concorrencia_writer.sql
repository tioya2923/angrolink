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
select set_config('request.jwt.claim.sub','72610000-0000-4000-8000-000000000004',true);
do $$ declare c text; begin
 if auth.uid()<>'72610000-0000-4000-8000-000000000004'::uuid then raise exception 'Identidade divergente'; end if;
 begin
  insert into public.parceiros_entrega(user_id,nome_completo,telefone,provincia,municipio,contacto_emergencia)
  values(auth.uid(),'Concorrente','+244923726104','Huambo','Huambo','+244923726199');
 exception when check_violation then
  get stacked diagnostics c=constraint_name;
  if c<>'parceiro_email_nova_candidatura' then raise; end if;
  raise notice 'ASSERT PASS: INSERT iniciado durante ativação espera e é recusado pela candidata'; return;
 end;
 raise exception 'INSERT concorrente foi permitido indevidamente';
end $$;
rollback;
