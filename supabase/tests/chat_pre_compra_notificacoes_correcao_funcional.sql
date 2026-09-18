\set ON_ERROR_STOP on
begin;

create temporary table pg_temp.resultados(teste text primary key) on commit drop;
create or replace function pg_temp.assert_true(v boolean,t text) returns void language plpgsql as $$begin if not coalesce(v,false) then raise exception 'ASSERT FAIL: %',t; end if; insert into pg_temp.resultados values(t); end$$;
create or replace function pg_temp.expect_error(q text,t text) returns void language plpgsql as $$begin begin execute q; raise exception 'ASSERT FAIL: %',t; exception when others then if sqlerrm like 'ASSERT FAIL:%' then raise; end if; end; insert into pg_temp.resultados values(t); end$$;
grant select,insert on pg_temp.resultados to public;
grant execute on function pg_temp.assert_true(boolean,text),pg_temp.expect_error(text,text) to public;

-- Fixtures sintéticas mínimas, isoladas pelo ROLLBACK.
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111111','authenticated','authenticated','n-buyer@test','',now(),'{}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','22222222-2222-4222-8222-222222222222','authenticated','authenticated','n-third@test','',now(),'{}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','33333333-3333-4333-8333-333333333333','authenticated','authenticated','n-seller@test','',now(),'{}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-8444-444444444444','authenticated','authenticated','n-other@test','',now(),'{}','{}',now(),now());
alter table public.vendedores disable trigger user; alter table public.produtos disable trigger user;
insert into public.clientes(id,nome,telefone,email,provincia,municipio,conta_ativa) values
 ('11111111-1111-4111-8111-111111111111','Buyer','900000001','n-buyer@test','Huambo','Huambo',true),('22222222-2222-4222-8222-222222222222','Third','900000002','n-third@test','Huambo','Huambo',true);
insert into public.vendedores(id,user_id,nome_comercial,nome_responsavel,telefone_whatsapp,email,provincia,municipio,tipo_vendedor,status_aprovacao,conta_ativa) values
 ('a0000000-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333','Seller','Seller','900000003','n-seller@test','Huambo','Huambo','revendedor','aprovado',true);
insert into public.produtos(id,vendedor_id,nome_produto,descricao,preco_aproximado,unidade,provincia,municipio,publicado,disponivel) values
 ('e0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Produto','Ativo',100,'unidade','Huambo','Huambo',true,true);
insert into public.conversas_pre_compra(id,solicitante_user_id,vendedor_id,produto_id) values ('f0000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001');
select 'f0000000-0000-4000-8000-000000000001'::uuid as id \gset c_
insert into public.mensagens_pre_compra(conversa_id,remetente_user_id,corpo,chave_idempotencia) values (:'c_id'::uuid,'11111111-1111-4111-8111-111111111111','corpo secreto 123','55555555-5555-4555-8555-555555555555');
set local role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
reset role;
select pg_temp.assert_true(exists(select 1 from public.notificacoes n where n.utilizador_id='33333333-3333-4333-8333-333333333333' and n.url_destino='/dashboard/conversas-produtos/'||:'c_id' and n.titulo='Nova mensagem' and n.mensagem='Recebeste uma nova mensagem.' and n.mensagem not like '%corpo secreto%' and n.metadata::text not like '%corpo secreto%'),'notificação canónica genérica sem corpo');
select pg_temp.assert_true(not exists(select 1 from public.notificacoes n where n.utilizador_id='11111111-1111-4111-8111-111111111111' and n.entidade_id=:'c_id'::uuid),'remetente não recebe própria notificação');
insert into public.notificacoes(utilizador_id,contexto,tipo,titulo,mensagem,entidade_tipo,entidade_id,url_destino) values
 ('33333333-3333-4333-8333-333333333333','venda','mensagem_pre_compra','x','x','conversa_pre_compra','e0000000-0000-4000-8000-000000000001','/x'),
 ('22222222-2222-4222-8222-222222222222','compra','mensagem_pre_compra','x','x','conversa_pre_compra',:'c_id'::uuid,'/x'),
 ('33333333-3333-4333-8333-333333333333','venda','outro','x','x','outro',:'c_id'::uuid,'/x');
set local role authenticated; select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true); select public.marcar_conversa_pre_compra_como_lida(:'c_id'::uuid);
reset role;
select pg_temp.assert_true(exists(select 1 from public.leituras_mensagens_pre_compra where conversa_id=:'c_id'::uuid and utilizador_id='33333333-3333-4333-8333-333333333333'),'leitura criada');
select pg_temp.assert_true((select count(*) from public.notificacoes where utilizador_id='33333333-3333-4333-8333-333333333333' and tipo='mensagem_pre_compra' and entidade_id=:'c_id'::uuid and lida_em is not null)=1,'somente notificação alvo lida');
select pg_temp.assert_true((select lida_em is null from public.notificacoes where utilizador_id='33333333-3333-4333-8333-333333333333' and tipo='mensagem_pre_compra' and entidade_id='e0000000-0000-4000-8000-000000000001'),'outra conversa intacta');
select pg_temp.assert_true((select lida_em is null from public.notificacoes where utilizador_id='22222222-2222-4222-8222-222222222222' and entidade_id=:'c_id'::uuid),'terceiro intacto');
select pg_temp.assert_true((select lida_em is null from public.notificacoes where utilizador_id='33333333-3333-4333-8333-333333333333' and tipo='outro'),'outro tipo intacto');
set local role authenticated; select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true); select public.marcar_conversa_pre_compra_como_lida(:'c_id'::uuid);
reset role;
select pg_temp.assert_true((select count(*) from public.leituras_mensagens_pre_compra where conversa_id=:'c_id'::uuid and utilizador_id='33333333-3333-4333-8333-333333333333')=1,'repeticao da leitura idempotente');
set local role authenticated; select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true); select pg_temp.expect_error(format('select public.marcar_conversa_pre_compra_como_lida(%L::uuid)',:'c_id'),'terceiro recusado'); reset role;
select pg_temp.assert_true(has_function_privilege('authenticated','public.marcar_conversa_pre_compra_como_lida(uuid)','execute') and not has_function_privilege('anon','public.marcar_conversa_pre_compra_como_lida(uuid)','execute') and not has_function_privilege('public','public.marcar_conversa_pre_compra_como_lida(uuid)','execute'),'grants mínimos');
select 'CHAT_NOTIFICACOES_CORRECAO_PASS' resultado,count(*) SQL_ASSERTIONS from pg_temp.resultados;
rollback;
