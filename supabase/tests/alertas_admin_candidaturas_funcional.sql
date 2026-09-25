\set ON_ERROR_STOP on
begin;

create temporary table pg_temp.resultados(teste text primary key) on commit drop;
create or replace function pg_temp.assert_true(v boolean, t text) returns void language plpgsql as $$
begin
  if not coalesce(v, false) then raise exception 'ASSERT FAIL: %', t; end if;
  insert into pg_temp.resultados values (t);
end;
$$;
grant select, insert on pg_temp.resultados to public;
grant execute on function pg_temp.assert_true(boolean, text) to public;

-- O dump schema-only não inclui a lista territorial. A candidatura de vendedor
-- valida o território no próprio banco, portanto esta fixture reproduz Huambo
-- sem depender de dados operacionais ou de parâmetros externos.
insert into public.provincias_angola(id, codigo_oficial, numero_oficial, nome, ativo, ordem)
values ('30000000-0000-4000-8000-000000000001', 'HBO', '999991', 'Huambo', true, 999991)
on conflict (codigo_oficial) do update set ativo = excluded.ativo
returning id as provincia_id \gset territorio_

insert into public.municipios_angola(id, provincia_id, codigo_oficial, numero_oficial, nome, ativo)
values ('30000000-0000-4000-8000-000000000002', :'territorio_provincia_id'::uuid, 'HBO-ALERTA-TESTE', '999992', 'Huambo', true)
on conflict (codigo_oficial) do update set ativo = excluded.ativo;

-- Fixtures sintéticas: dois administradores, um vendedor e um parceiro.
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-000000000001','authenticated','authenticated','alert-admin-1@test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-000000000002','authenticated','authenticated','alert-admin-2@test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-000000000003','authenticated','authenticated','alert-outsider@test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-000000000004','authenticated','authenticated','alert-vendor@test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-000000000005','authenticated','authenticated','alert-partner@test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-000000000006','authenticated','authenticated','alert-incomplete-vendor@test','',now(),'{}','{}',now(),now());
insert into public.administradores(user_id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002');
insert into public.clientes(id,nome,telefone,email,provincia,municipio,conta_ativa)
values ('10000000-0000-4000-8000-000000000003','Comprador sem alerta','900000003','alert-outsider@test','Huambo','Huambo',true);

insert into public.vendedores(id,user_id,nome_comercial,nome_responsavel,telefone_whatsapp,email,provincia,municipio,tipo_vendedor,status_aprovacao,conta_ativa)
values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','Vendedor alerta','Responsável','900000004','alert-vendor@test','Huambo','Huambo','revendedor','pendente',false);

-- A inserção do único documento obrigatório do revendedor torna a candidatura pronta.
insert into public.documentos_vendedor(vendedor_id,tipo_documento,frente_path,verso_path,estado)
values ('20000000-0000-4000-8000-000000000001','bi','alert/vendor/bi-frente.jpg','alert/vendor/bi-verso.jpg','pendente');

select pg_temp.assert_true(
  (select count(*) from public.notificacoes where tipo='candidatura_vendedor_pronta' and entidade_id='20000000-0000-4000-8000-000000000001') = 2,
  'submissão inicial do vendedor notifica os dois administradores'
);
select pg_temp.assert_true(
  (select count(*) from public.notificacoes where tipo='candidatura_vendedor_pronta' and url_destino='/dashboard/pedidos-vendedores' and contexto='admin' and metadata='{}'::jsonb) = 2,
  'alerta de vendedor usa contexto e rota administrativos sem metadados privados'
);
select pg_temp.assert_true(
  (select count(*) from public.notificacoes where tipo='candidatura_vendedor_pronta' and titulo='Nova candidatura de vendedor' and mensagem='Uma candidatura de vendedor está pronta para análise.') = 2,
  'alerta de vendedor usa texto genérico sem dados sensíveis'
);

-- Uma atualização que não representa novo envio não gera duplicado.
-- Um documento pendente é imutável por contrato. Repetimos a mesma chave do
-- evento já produzido pelo trigger para provar a idempotência por destinatário.
select public.notificar_administradores_candidatura_pronta(
  'candidatura_vendedor_pronta',
  'vendedor',
  '20000000-0000-4000-8000-000000000001',
  '/dashboard/pedidos-vendedores',
  (select regexp_replace(chave_idempotencia, ':admin:[^:]+$', '')
   from public.notificacoes
   where tipo='candidatura_vendedor_pronta'
   order by criado_em
   limit 1)
);
select pg_temp.assert_true(
  (select count(*) from public.notificacoes where tipo='candidatura_vendedor_pronta' and entidade_id='20000000-0000-4000-8000-000000000001') = 2,
  'repetição do mesmo evento de vendedor não duplica alertas'
);

-- Rejeição seguida de reenvio pendente inicia uma nova revisão e alerta novamente.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
update public.documentos_vendedor
set estado='rejeitado', motivo_rejeicao='Documento precisa de nova imagem.'
where vendedor_id='20000000-0000-4000-8000-000000000001' and tipo_documento='bi';
reset role;
-- now() é estável dentro da única transação desta suíte. Desligamos apenas o
-- trigger de timestamp para representar a submissão posterior sem perder o
-- trigger de alerta nem a proteção de reenvio do documento.
alter table public.documentos_vendedor disable trigger atualizar_documento_vendedor_em;
update public.candidaturas_vendedor_revisoes set transacao_pronta=txid_current()-1
where vendedor_id='20000000-0000-4000-8000-000000000001' and numero=1;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
update public.documentos_vendedor
set estado='pendente',
    frente_path='10000000-0000-4000-8000-000000000004/alert/vendor/bi-frente-reenvio.jpg',
    verso_path='10000000-0000-4000-8000-000000000004/alert/vendor/bi-verso-reenvio.jpg',
    atualizado_em=clock_timestamp()
where vendedor_id='20000000-0000-4000-8000-000000000001' and tipo_documento='bi';
reset role;
alter table public.documentos_vendedor enable trigger atualizar_documento_vendedor_em;
select pg_temp.assert_true(
  (select count(*) from public.notificacoes where tipo='candidatura_vendedor_pronta' and entidade_id='20000000-0000-4000-8000-000000000001') = 4,
  'reenvio de documentos do vendedor cria um alerta por administrador'
);

-- A RPC atómica é o evento autoritativo: somente após criar parceiro, veículo,
-- área e documentos consegue transitar para em análise e emitir o alerta.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',true);
select public.criar_pedido_parceiro_entrega(
  jsonb_build_object('nome_completo','Parceiro alerta','telefone','900000005','provincia','Huambo','municipio','Huambo','contacto_emergencia','900000006'),
  jsonb_build_object('tipo_veiculo','mota','marca','Marca','modelo','Modelo','cor','Verde','matricula','ALR-0001','capacidade_kg',50),
  jsonb_build_array(
    jsonb_build_object('tipo_documento','bi','frente_path','alert/partner/bi-f.jpg','verso_path','alert/partner/bi-v.jpg'),
    jsonb_build_object('tipo_documento','carta_conducao','frente_path','alert/partner/carta-f.jpg','verso_path','alert/partner/carta-v.jpg'),
    jsonb_build_object('tipo_documento','livrete_veiculo','frente_path','alert/partner/livrete-f.jpg','verso_path','alert/partner/livrete-v.jpg'),
    jsonb_build_object('tipo_documento','seguro_automovel','frente_path','alert/partner/seguro-f.jpg','verso_path','alert/partner/seguro-v.jpg')
  ),
  jsonb_build_object('provincia','Huambo','municipio','Huambo')
) as id \gset parceiro_
reset role;
select pg_temp.assert_true(
  (select count(*) from public.notificacoes where tipo='candidatura_parceiro_entrega_pronta' and entidade_id=:'parceiro_id'::uuid) = 2,
  'submissão inicial do parceiro notifica os dois administradores'
);
select pg_temp.assert_true(
  (select count(*) from public.notificacoes where tipo='candidatura_parceiro_entrega_pronta' and url_destino='/dashboard/pedidos-entregadores' and contexto='admin' and metadata='{}'::jsonb) = 2,
  'alerta de parceiro usa rota administrativa e metadados vazios'
);
update public.parceiros_entrega set disponibilidade=false where id=:'parceiro_id'::uuid;
select pg_temp.assert_true(
  (select count(*) from public.notificacoes where tipo='candidatura_parceiro_entrega_pronta' and entidade_id=:'parceiro_id'::uuid) = 2,
  'repetição sem nova transição de parceiro não duplica alertas'
);

-- Com um só administrador restante, a candidatura incompleta não alerta; ao
-- completar todos os documentos obrigatórios, alerta precisamente esse Admin.
delete from public.administradores where user_id='10000000-0000-4000-8000-000000000002';
insert into public.administradores(user_id) values ('10000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into public.vendedores(id,user_id,nome_comercial,nome_responsavel,telefone_whatsapp,email,provincia,municipio,tipo_vendedor,status_aprovacao,conta_ativa)
values ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000006','Vendedor incompleto','Responsável','900000007','alert-incomplete-vendor@test','Huambo','Huambo','grossista','pendente',false);
insert into public.documentos_vendedor(vendedor_id,tipo_documento,frente_path,verso_path,estado)
values ('20000000-0000-4000-8000-000000000002','bi','alert/incomplete/bi-f.jpg','alert/incomplete/bi-v.jpg','pendente');
select pg_temp.assert_true(
  (select count(*) from public.notificacoes where tipo='candidatura_vendedor_pronta' and entidade_id='20000000-0000-4000-8000-000000000002') = 0,
  'candidatura de vendedor incompleta não alerta'
);
insert into public.documentos_vendedor(vendedor_id,tipo_documento,frente_path,verso_path,estado)
values ('20000000-0000-4000-8000-000000000002','nif','alert/incomplete/nif-f.jpg','alert/incomplete/nif-v.jpg','pendente');
select pg_temp.assert_true(
  (select count(*) from public.notificacoes where tipo='candidatura_vendedor_pronta' and entidade_id='20000000-0000-4000-8000-000000000002') = 0,
  'documentos obrigatórios enviados separadamente não alertam antes de completar a revisão'
);
insert into public.documentos_vendedor(vendedor_id,tipo_documento,frente_path,verso_path,estado)
values ('20000000-0000-4000-8000-000000000002','alvara','alert/incomplete/alvara-f.jpg','alert/incomplete/alvara-v.jpg','pendente');
select pg_temp.assert_true(
  (select count(*) from public.notificacoes where tipo='candidatura_vendedor_pronta' and entidade_id='20000000-0000-4000-8000-000000000002' and utilizador_id='10000000-0000-4000-8000-000000000001') = 1
  and (select count(*) from public.notificacoes where tipo='candidatura_vendedor_pronta' and entidade_id='20000000-0000-4000-8000-000000000002' and utilizador_id='10000000-0000-4000-8000-000000000002') = 1,
  'cada administrador recebe uma linha privada quando a revisão fica completa'
);
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
update public.documentos_vendedor set estado='rejeitado', motivo_rejeicao='NIF ilegível.'
where vendedor_id='20000000-0000-4000-8000-000000000002' and tipo_documento='nif';
reset role;
-- A suíte usa uma transação única; este marcador representa a próxima
-- transação HTTP que abre a revisão posterior.
update public.candidaturas_vendedor_revisoes set transacao_pronta=txid_current()-1
where vendedor_id='20000000-0000-4000-8000-000000000002' and numero=1;
alter table public.documentos_vendedor disable trigger atualizar_documento_vendedor_em;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000006',true);
update public.documentos_vendedor set estado='pendente', atualizado_em=clock_timestamp(),
  frente_path='10000000-0000-4000-8000-000000000006/alert/incomplete/nif-reenvio-f.jpg',
  verso_path='10000000-0000-4000-8000-000000000006/alert/incomplete/nif-reenvio-v.jpg'
where vendedor_id='20000000-0000-4000-8000-000000000002' and tipo_documento='nif';
reset role;
alter table public.documentos_vendedor enable trigger atualizar_documento_vendedor_em;
select pg_temp.assert_true(
  (select count(*) from public.notificacoes where tipo='candidatura_vendedor_pronta' and entidade_id='20000000-0000-4000-8000-000000000002' and utilizador_id='10000000-0000-4000-8000-000000000001') = 2
  and (select count(*) from public.notificacoes where tipo='candidatura_vendedor_pronta' and entidade_id='20000000-0000-4000-8000-000000000002' and utilizador_id='10000000-0000-4000-8000-000000000002') = 2,
  'reenvio após rejeição parcial cria uma segunda revisão por administrador'
);
delete from public.administradores where user_id='10000000-0000-4000-8000-000000000002';
select pg_temp.assert_true(
  not exists(select 1 from public.notificacoes where utilizador_id in ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000005')),
  'comprador, vendedor e parceiro não recebem alertas administrativos'
);

-- RLS mantém as notificações estritamente individuais, mesmo entre administradores.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true((select count(*) from public.listar_notificacoes(100,null) where contexto='admin') = 5, 'primeiro administrador lê somente os próprios cinco alertas');
select pg_temp.assert_true((select count(*) from public.notificacoes where utilizador_id='10000000-0000-4000-8000-000000000002') = 0, 'RLS não revela os alertas do segundo administrador');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select pg_temp.assert_true((select count(*) from public.listar_notificacoes(100,null)) = 0, 'conta sem responsabilidade administrativa não recebe alertas');
reset role;

select 'ALERTAS_ADMIN_CANDIDATURAS_PASS' resultado, count(*) assertions_pass from pg_temp.resultados;
rollback;
