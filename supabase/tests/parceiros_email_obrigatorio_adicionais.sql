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
-- Metadata e GUCs não são usadas pela candidata como prova de legado.
select set_config('request.jwt.claims','{"sub":"72610000-0000-4000-8000-000000000004","user_metadata":{"papel":"parceiro_entrega","legado":true}}',true);
select set_config('angrolink.parceiro_legado','true',true);
do $$ declare c text; begin
 if auth.uid()<>'72610000-0000-4000-8000-000000000004'::uuid then raise exception 'Identidade divergente'; end if;
 begin
   insert into public.parceiros_entrega(user_id,nome_completo,telefone,provincia,municipio,contacto_emergencia,criado_em)
   values(auth.uid(),'Tentativa metadata','+244923726104','Huambo','Huambo','+244923726199','1990-01-01');
 exception when check_violation then
   get stacked diagnostics c=constraint_name;
   if c<>'parceiro_email_nova_candidatura' then raise; end if;
   raise notice 'ASSERT PASS: metadata, GUC e antiguidade não concedem isenção'; return;
 end;
 raise exception 'Bypass de isenção permitido';
end $$;
select public.criar_pedido_parceiro_entrega(
'{"nome_completo":"Novo RPC válido","email":"  RPC@EXAMPLE.TEST  ","telefone":"+244923726104","provincia":"Huambo","municipio":"Huambo","contacto_emergencia":"+244923726199"}',
'{"tipo_veiculo":"mota","marca":"Teste","modelo":"Teste","cor":"Azul","capacidade_kg":25,"matricula":"PROVA-726104"}',
'[{"tipo_documento":"bi","frente_path":"prova/bi-f","verso_path":"prova/bi-v"},{"tipo_documento":"carta_conducao","frente_path":"prova/c-f","verso_path":"prova/c-v"},{"tipo_documento":"livrete_veiculo","frente_path":"prova/l-f","verso_path":"prova/l-v"},{"tipo_documento":"seguro_automovel","frente_path":"prova/s-f","verso_path":"prova/s-v"}]',
'{"provincia":"Huambo","municipio":"Huambo"}');
do $$ begin
 if not exists(select 1 from public.parceiros_entrega where user_id=auth.uid() and email='rpc@example.test' and estado='em_analise' and not disponibilidade)
 then raise exception 'RPC válida não preservou estado/email/UUID'; end if;
 raise notice 'ASSERT PASS: nova RPC válida normaliza email e preserva UUID e estado';
 if (select count(*) from public.documentos_parceiro_entrega d join public.parceiros_entrega p on p.id=d.parceiro_id where p.user_id=auth.uid())<>4
 then raise exception 'Documentos divergentes'; end if;
 raise notice 'ASSERT PASS: nova RPC válida preserva quatro documentos';
end $$;
reset role;
do $$ begin
 if (select count(*) from auth.users where id::text like '72610000-%' and email='parceiro-prova-'||split_part(id::text,'-',5)::bigint||'@example.test')<>8
 then raise exception 'Identidades Auth divergentes'; end if;
 raise notice 'ASSERT PASS: UUID e email Auth das oito fixtures inalterados';
 if not (select relrowsecurity from pg_class where oid='public.parceiros_entrega'::regclass)
 then raise exception 'RLS desativada'; end if;
 raise notice 'ASSERT PASS: RLS permanece ativa';
 if exists(select 1 from parceiros_email_privado.legados where user_id='72610000-0000-4000-8000-000000000004')
 then raise exception 'Conta antiga sem candidatura ganhou isenção'; end if;
 raise notice 'ASSERT PASS: conta Auth antiga não ganhou isenção na RPC';
end $$;
do $$ begin
 if has_schema_privilege('anon','parceiros_email_privado','USAGE') then
  raise exception 'Anon tem USAGE privado'; end if;
 raise notice 'ASSERT PASS: anon sem USAGE privado';
 if has_function_privilege('anon','parceiros_email_privado.exigir_email_novo_parceiro()','EXECUTE') then
  raise exception 'Anon tem EXECUTE privado'; end if;
 raise notice 'ASSERT PASS: anon sem EXECUTE privado';
end $$;
set local role anon;
do $$ begin
 begin perform 1 from parceiros_email_privado.legados;
 exception when insufficient_privilege then
  raise notice 'ASSERT PASS: leitura privada por anon recusada'; return;
 end;
 raise exception 'Anon conseguiu ler o registo privado';
end $$;
do $$ begin
 begin insert into parceiros_email_privado.legados values(gen_random_uuid(),gen_random_uuid());
 exception when insufficient_privilege then
  raise notice 'ASSERT PASS: escrita privada por anon recusada'; return;
 end;
 raise exception 'Anon conseguiu escrever no registo privado';
end $$;
reset role;
rollback;
