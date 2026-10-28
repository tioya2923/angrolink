\set ON_ERROR_STOP on
\if :{?prova_db}
\else
 \quit 3
\endif
select current_database()=:'prova_db'
 and current_database() like 'angrolink_parceiros_email_acl_versionada_%' as safe \gset
\if :safe
\else
 \quit 3
\endif
begin;
\echo CHECKPOINT:seed
select set_config('request.jwt.claim.sub','72610000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"72610000-0000-4000-8000-000000000004","role":"authenticated"}',true);
update public.profiles set papel='admin' where id='72610000-0000-4000-8000-000000000004';
insert into public.administradores(user_id) values('72610000-0000-4000-8000-000000000004');
insert into public.clientes(id,nome,telefone) values('72610000-0000-4000-8000-000000000005','LOCAL',null),
 ('72610000-0000-4000-8000-000000000004','LOCAL ADMIN',null);
insert into public.vendedores(id,user_id,nome_comercial,tipo_vendedor,provincia,municipio,email)
values('72820000-0000-4000-8000-000000000001','72610000-0000-4000-8000-000000000003','LOCAL','ambulante','Huambo','Huambo','local@example.test');
insert into public.documentos_vendedor(vendedor_id,tipo_documento,frente_path,estado)
values('72820000-0000-4000-8000-000000000001','bi','72610000-0000-4000-8000-000000000003/local-bi','aprovado');
update public.vendedores set status_aprovacao='aprovado',conta_ativa=true,aprovado_em=now(),verificado=true
where id='72820000-0000-4000-8000-000000000001';
insert into public.servicos(id,vendedor_id,nome_servico,publicado,disponivel,visualizacoes,cliques_whatsapp)
values('72820000-0000-4000-8000-000000000002','72820000-0000-4000-8000-000000000001','LOCAL',true,true,0,0);
-- Categoria/provincia sao referencias locais da baseline, nao dados de utilizadores.
insert into public.produtos(id,vendedor_id,nome_produto,categoria_id,provincia,publicado,disponivel,visualizacoes,cliques_whatsapp)
select '72820000-0000-4000-8000-000000000003','72820000-0000-4000-8000-000000000001','LOCAL',c.id,'Huambo',true,true,0,0
from public.categorias c where public.produto_eh_operacional_fase1(c.id,null,'Huambo','72820000-0000-4000-8000-000000000001') limit 1;
select acl_probe.check(exists(select 1 from public.produtos where id='72820000-0000-4000-8000-000000000003'),'fixture produto operacional criada');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
select acl_probe.check(public.is_vendedor_publico_aprovado('72820000-0000-4000-8000-000000000001'),'helper publico vendedor');
select acl_probe.check(exists(select 1 from public.produtos where id='72820000-0000-4000-8000-000000000003'),'catalogo anon por RLS');
select public.incrementar_visualizacao_produto('72820000-0000-4000-8000-000000000003');
select public.incrementar_clique_whatsapp_produto('72820000-0000-4000-8000-000000000003');
select public.incrementar_visualizacao_servico('72820000-0000-4000-8000-000000000002');
select public.incrementar_clique_whatsapp_servico('72820000-0000-4000-8000-000000000002');
reset role;
select acl_probe.check((select visualizacoes=1 and cliques_whatsapp=1 from public.produtos where id='72820000-0000-4000-8000-000000000003'),'metricas produto anon preservadas');
select acl_probe.check((select visualizacoes=1 and cliques_whatsapp=1 from public.servicos where id='72820000-0000-4000-8000-000000000002'),'metricas servico anon preservadas');
set local role authenticated;
select set_config('request.jwt.claim.sub','72610000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"72610000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select acl_probe.check(public.is_dono_vendedor('72820000-0000-4000-8000-000000000001') and public.is_vendedor_aprovado('72820000-0000-4000-8000-000000000001'),'helpers dono e aprovado');
\echo CHECKPOINT:highlight
-- Falha PREEXISTENTE comprovada antes de qualquer REVOKE; nao e sucesso funcional.
select acl_probe.reject($q$select public.destacar_servico_gratis('72820000-0000-4000-8000-000000000002')$q$,
 'P0001','falha preexistente no primeiro destaque reproduzida (nao PASS funcional)');
reset role;
-- Outro percurso legitimo: aproveitar periodo de destaque ja existente.
select set_config('request.jwt.claim.sub','72610000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"72610000-0000-4000-8000-000000000004","role":"authenticated"}',true);
update public.servicos set destaque=true,destaque_inicio=now(),destaque_ate=now()+interval '1 day',tipo_destaque='gratuito'
where id='72820000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','72610000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"72610000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select public.destacar_servico_gratis('72820000-0000-4000-8000-000000000002');
reset role;
select acl_probe.check((select destaque from public.servicos where id='72820000-0000-4000-8000-000000000002'),'destaque legitimo preservado');
set local role authenticated;
select public.remover_destaque_servico('72820000-0000-4000-8000-000000000002');
select acl_probe.reject($q$update public.vendedores set status_aprovacao='suspenso' where id='72820000-0000-4000-8000-000000000001'$q$,'42501','ACL recusa UPDATE direto de estado administrativo');
reset role;
select acl_probe.check((select not destaque from public.servicos where id='72820000-0000-4000-8000-000000000002'),'remocao legitima destaque');
-- Candidatura real pela RPC original e pelos triggers documentais.
\echo CHECKPOINT:partner
set local role authenticated;
select set_config('request.jwt.claim.sub','72610000-0000-4000-8000-000000000006',true);
select set_config('request.jwt.claims','{"sub":"72610000-0000-4000-8000-000000000006","role":"authenticated"}',true);
select public.criar_pedido_parceiro_entrega(
 '{"nome_completo":"LOCAL","email":"parceiro@example.test","telefone":"+244900222222","provincia":"Huambo","municipio":"Huambo","contacto_emergencia":"+244900999999"}',
 '{"tipo_veiculo":"mota","marca":"LOCAL","modelo":"LOCAL","cor":"Azul","matricula":"ACL-LOCAL","capacidade_kg":25}',
 '[{"tipo_documento":"bi","frente_path":"72610000-0000-4000-8000-000000000006/bi-f","verso_path":"72610000-0000-4000-8000-000000000006/bi-v"},{"tipo_documento":"carta_conducao","frente_path":"72610000-0000-4000-8000-000000000006/c-f","verso_path":"72610000-0000-4000-8000-000000000006/c-v"},{"tipo_documento":"livrete_veiculo","frente_path":"72610000-0000-4000-8000-000000000006/l-f","verso_path":"72610000-0000-4000-8000-000000000006/l-v"},{"tipo_documento":"seguro_automovel","frente_path":"72610000-0000-4000-8000-000000000006/s-f","verso_path":"72610000-0000-4000-8000-000000000006/s-v"}]',
 '{"provincia":"Huambo","municipio":"Huambo"}') is not null as rpc_ok \gset
select acl_probe.check(:'rpc_ok'::boolean,'RPC candidatura aceite');
reset role;
select acl_probe.check((select count(*)=4 from public.documentos_parceiro_entrega d join public.parceiros_entrega p on p.id=d.parceiro_id where p.user_id='72610000-0000-4000-8000-000000000006'),'quatro documentos criados');
select acl_probe.check((select count(*)=4 from public.versoes_documento_parceiro_entrega v join public.parceiros_entrega p on p.id=v.parceiro_id where p.user_id='72610000-0000-4000-8000-000000000006'),'trigger cria quatro versoes');
select acl_probe.check((select count(*)>=4 from public.eventos_documento_parceiro_entrega e join public.parceiros_entrega p on p.id=e.parceiro_id where p.user_id='72610000-0000-4000-8000-000000000006'),'trigger regista eventos');
set local role authenticated;
select set_config('request.jwt.claim.sub','72610000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"72610000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select acl_probe.check(public.is_admin_atual(),'helper admin por sessao');
-- Policies permissivas sao combinadas por OR; a policy ALL permite o admin.
insert into public.historico_pesquisas(cliente_id,termo) values('72610000-0000-4000-8000-000000000004','LOCAL');
select acl_probe.check(exists(select 1 from public.historico_pesquisas where cliente_id='72610000-0000-4000-8000-000000000004'),
 'combinacao real de policies permite historico ao admin');
update public.documentos_parceiro_entrega set estado='aprovado' where parceiro_id in
 (select id from public.parceiros_entrega where user_id='72610000-0000-4000-8000-000000000006');
select public.aprovar_parceiro_entrega_admin(id) from public.parceiros_entrega where user_id='72610000-0000-4000-8000-000000000006';
reset role;
select acl_probe.check((select estado='aprovado' from public.parceiros_entrega where user_id='72610000-0000-4000-8000-000000000006'),'aprovacao administrativa preservada');
-- Exercitar tambem a RPC legada de submissao, nao apenas a RPC atomica do cadastro.
update public.parceiros_entrega set estado='rascunho',disponibilidade=false where user_id='72610000-0000-4000-8000-000000000006';
set local role authenticated;
select set_config('request.jwt.claim.sub','72610000-0000-4000-8000-000000000006',true);
select set_config('request.jwt.claims','{"sub":"72610000-0000-4000-8000-000000000006","role":"authenticated"}',true);
select (public.submeter_pedido_parceiro_entrega(id)).id is not null as submissao_ok from public.parceiros_entrega
 where user_id='72610000-0000-4000-8000-000000000006' \gset
select acl_probe.check(:'submissao_ok'::boolean,'RPC legada de submissao aceite');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','72610000-0000-4000-8000-000000000005',true);
select set_config('request.jwt.claims','{"sub":"72610000-0000-4000-8000-000000000005","role":"authenticated"}',true);
insert into public.historico_pesquisas(cliente_id,termo) values('72610000-0000-4000-8000-000000000005','LOCAL');
select acl_probe.check(not public.is_admin_atual(),'policy de historico aceita cliente e helper nao admin');
select public.desativar_minha_conta();
reset role;
select acl_probe.check((select not conta_ativa from public.clientes where id='72610000-0000-4000-8000-000000000005'),'desativacao propria preservada');
set local role authenticated;
select set_config('request.jwt.claim.sub','72610000-0000-4000-8000-000000000007',true);
select set_config('request.jwt.claims','{"sub":"72610000-0000-4000-8000-000000000007","role":"authenticated"}',true);
select public.apagar_minha_conta();
reset role;
select acl_probe.check(not exists(select 1 from auth.users where id='72610000-0000-4000-8000-000000000007'),'eliminacao propria da fixture preservada');
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
 ('72820000-0000-4000-8000-000000000009','authenticated','authenticated','novo-local@example.test','{}','{"papel":"cliente"}');
select acl_probe.check(exists(select 1 from public.profiles where id='72820000-0000-4000-8000-000000000009'),'triggers Auth criam profile');
rollback;
