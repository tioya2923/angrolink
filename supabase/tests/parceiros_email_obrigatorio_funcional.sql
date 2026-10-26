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
-- Helpers apenas da suíte. Sem EXECUTE de funções comerciais privadas ao browser.
create function pg_temp.assert_true(ok boolean, titulo text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ASSERT FAIL: %', titulo; end if;
raise notice 'ASSERT PASS: %', titulo; end; $$;
create function pg_temp.recusar(sql text, estado text, restricao text, titulo text) returns void language plpgsql as $$
declare codigo text; nome text;
begin
  begin execute sql;
  exception when others then
    get stacked diagnostics codigo=returned_sqlstate, nome=constraint_name;
    if codigo=estado and (restricao is null or nome=restricao) then
      raise notice 'ASSERT PASS: %', titulo; return;
    end if;
    raise exception 'ERRO INCORRETO: %, SQLSTATE %, constraint %', titulo,codigo,nome;
  end;
  raise exception 'ASSERT FAIL (operação permitida): %',titulo;
end; $$;
grant execute on function pg_temp.assert_true(boolean,text),pg_temp.recusar(text,text,text,text) to authenticated,anon;

select pg_temp.assert_true((select count(*)=2 from parceiros_email_privado.legados),'snapshot somente dos dois parceiros históricos');
select pg_temp.assert_true(not has_schema_privilege('authenticated','parceiros_email_privado','USAGE'),'schema privado sem USAGE browser');
select pg_temp.assert_true(not has_function_privilege('authenticated','parceiros_email_privado.exigir_email_novo_parceiro()','EXECUTE'),'helper privado sem EXECUTE browser');

set local role authenticated;
select set_config('request.jwt.claim.sub','72610000-0000-4000-8000-000000000003',true);
select pg_temp.assert_true(auth.uid()='72610000-0000-4000-8000-000000000003','identidade nova confirmada');
select pg_temp.recusar($q$insert into public.parceiros_entrega(user_id,nome_completo,telefone,provincia,municipio,contacto_emergencia)
values(auth.uid(),'Novo','+244923726103','Huambo','Huambo','+244923726199')$q$,'23514','parceiro_email_nova_candidatura','INSERT direto sem email recusado pela regra');
select pg_temp.recusar($q$insert into public.parceiros_entrega(user_id,nome_completo,telefone,provincia,municipio,contacto_emergencia,email)
values(auth.uid(),'Novo','+244923726103','Huambo','Huambo','+244923726199','invalido')$q$,'23514','parceiro_email_nova_candidatura','formato inválido recusado');
select pg_temp.recusar($q$insert into public.parceiros_entrega(user_id,nome_completo,telefone,provincia,municipio,contacto_emergencia,email)
values(auth.uid(),'Novo','+244923726103','Huambo','Huambo','+244923726199','   ')$q$,'23514','parceiro_email_nova_candidatura','email em branco recusado');
select pg_temp.recusar($q$insert into public.parceiros_entrega(user_id,nome_completo,telefone,provincia,municipio,contacto_emergencia,email)
values(auth.uid(),'Novo','+244923726103','Huambo','Huambo','+244923726199','244923726103@TELEFONE.ANGROLINK')$q$,'23514','parceiro_email_nova_candidatura','domínio sintético recusado');
select pg_temp.recusar($q$insert into public.parceiros_entrega(user_id,nome_completo,telefone,provincia,municipio,contacto_emergencia,criado_em)
values(auth.uid(),'Novo','+244923726103','Huambo','Huambo','+244923726199','1990-01-01')$q$,'23514','parceiro_email_nova_candidatura','falsificar antiguidade não concede isenção');

insert into public.parceiros_entrega(user_id,nome_completo,telefone,provincia,municipio,contacto_emergencia,email)
values(auth.uid(),'Novo','+244923726103','Huambo','Huambo','+244923726199','  CONTA@EXAMPLE.TEST  ');
select pg_temp.assert_true((select email='conta@example.test' and user_id=auth.uid() from public.parceiros_entrega where user_id=auth.uid()),'INSERT válido normalizado e ownership preservado');
select pg_temp.recusar($q$update public.parceiros_entrega set email=null where user_id=auth.uid()$q$,'23514','parceiro_email_nova_candidatura','UPDATE para NULL recusado');
select pg_temp.recusar($q$update public.parceiros_entrega set email='invalido' where user_id=auth.uid()$q$,'23514','parceiro_email_nova_candidatura','UPDATE inválido recusado');
update public.parceiros_entrega set bairro='Correção normal' where user_id=auth.uid();
select pg_temp.assert_true((select bairro='Correção normal' from public.parceiros_entrega where user_id=auth.uid()),'UPDATE comum novo permitido');
select pg_temp.recusar($q$select * from parceiros_email_privado.legados$q$,'42501',null,'leitura do registo privado recusada');
select pg_temp.recusar($q$insert into parceiros_email_privado.legados values(auth.uid(),gen_random_uuid())$q$,'42501',null,'escrita do registo privado recusada');
select pg_temp.recusar($q$delete from parceiros_email_privado.ativacao$q$,'42501',null,'reinicialização do snapshot recusada');

select set_config('request.jwt.claim.sub','72610000-0000-4000-8000-000000000004',true);
select pg_temp.assert_true(auth.uid()='72610000-0000-4000-8000-000000000004','identidade antiga sem candidatura confirmada');
select pg_temp.assert_true((select count(*)=0 from public.parceiros_entrega),'RLS não expõe outros parceiros');
-- Payload documental completo, para que o erro negativo não seja de documentos.
select pg_temp.recusar($q$select public.criar_pedido_parceiro_entrega(
'{"nome_completo":"Novo RPC","telefone":"+244923726104","provincia":"Huambo","municipio":"Huambo","contacto_emergencia":"+244923726199"}',
'{"tipo_veiculo":"mota","marca":"Teste","modelo":"Teste","cor":"Azul","capacidade_kg":25,"matricula":"PROVA-726104"}',
'[{"tipo_documento":"bi","frente_path":"prova/bi-f","verso_path":"prova/bi-v"},{"tipo_documento":"carta_conducao","frente_path":"prova/c-f","verso_path":"prova/c-v"},{"tipo_documento":"livrete_veiculo","frente_path":"prova/l-f","verso_path":"prova/l-v"},{"tipo_documento":"seguro_automovel","frente_path":"prova/s-f","verso_path":"prova/s-v"}]',
'{"provincia":"Huambo","municipio":"Huambo"}')$q$,'23514','parceiro_email_nova_candidatura','RPC direta de conta Auth antiga sem candidatura recusada');

select set_config('request.jwt.claim.sub','72610000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true(auth.uid()='72610000-0000-4000-8000-000000000001','identidade histórica confirmada');
select pg_temp.assert_true((select email is null from public.parceiros_entrega where user_id=auth.uid()),'histórico sem email preservado');
update public.parceiros_entrega set bairro='Histórico corrigido' where user_id=auth.uid();
select pg_temp.assert_true((select bairro='Histórico corrigido' and email is null from public.parceiros_entrega where user_id=auth.uid()),'correção histórica sem email permitida');
select public.criar_pedido_parceiro_entrega(
'{"nome_completo":"Histórico recriado","telefone":"+244923726101","provincia":"Huambo","municipio":"Huambo","contacto_emergencia":"+244923726199"}',
'{"tipo_veiculo":"mota","marca":"Teste","modelo":"Teste","cor":"Azul","capacidade_kg":25,"matricula":"PROVA-726101"}',
'[{"tipo_documento":"bi","frente_path":"prova/bi-f","verso_path":"prova/bi-v"},{"tipo_documento":"carta_conducao","frente_path":"prova/c-f","verso_path":"prova/c-v"},{"tipo_documento":"livrete_veiculo","frente_path":"prova/l-f","verso_path":"prova/l-v"},{"tipo_documento":"seguro_automovel","frente_path":"prova/s-f","verso_path":"prova/s-v"}]',
'{"provincia":"Huambo","municipio":"Huambo"}');
select pg_temp.assert_true((select email is null and user_id=auth.uid() and estado='em_analise' and not disponibilidade from public.parceiros_entrega where user_id=auth.uid()),'recriação histórica sem email e UUID Auth preservados');
select pg_temp.assert_true((select count(*)=4 from public.documentos_parceiro_entrega d join public.parceiros_entrega p on p.id=d.parceiro_id where p.user_id=auth.uid()),'documentos da RPC preservados');
select pg_temp.assert_true((select count(*)=1 from public.veiculos_entrega v join public.parceiros_entrega p on p.id=v.parceiro_id where p.user_id=auth.uid()),'veículo da RPC preservado');
select pg_temp.recusar($q$update public.parceiros_entrega set estado='aprovado' where user_id=auth.uid()$q$,'P0001',null,'autoaprovação continua recusada');

select set_config('request.jwt.claim.sub','72610000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true(auth.uid()='72610000-0000-4000-8000-000000000002','segunda identidade histórica confirmada');
update public.parceiros_entrega set bairro='Fictício preservado' where user_id=auth.uid();
select pg_temp.assert_true((select email='email histórico inválido' from public.parceiros_entrega where user_id=auth.uid()),'email fictício histórico não revalidado');
reset role;
select pg_temp.assert_true((select count(*)=2 from parceiros_email_privado.legados),'operações novas não ampliaram isenções');
select pg_temp.assert_true((select count(*)=8 from auth.users where id::text like '72610000-%'),'nenhuma identidade Auth criada ou eliminada na prova');
rollback;
-- A preparação histórica está fora desta transação e será limpa separadamente.
