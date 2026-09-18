-- Suite funcional autossuficiente do chat pre-compra.
-- Executar APENAS numa base Supabase local descartavel, com a migration
-- 20260915010000_criar_chat_pre_compra_seguro.sql ja aplicada.
-- A suite cria fixtures sinteticas dentro de uma transacao e termina com ROLLBACK.

\set ON_ERROR_STOP on
\pset pager off

begin;

do $preflight$
begin
  -- NULL significa ligacao por Unix socket dentro do contentor local.
  if inet_server_addr() is not null
     and inet_server_addr() is distinct from inet '127.0.0.1'
     and inet_server_addr() is distinct from inet '::1' then
    raise exception 'RECUSADO: esta suite so pode ser executada em PostgreSQL local (servidor atual: %).', inet_server_addr();
  end if;

  if current_database() <> 'postgres' then
    raise exception 'RECUSADO: base esperada postgres; base atual: %.', current_database();
  end if;

  if to_regclass('public.conversas_pre_compra') is null
     or to_regclass('public.mensagens_pre_compra') is null
     or to_regclass('public.leituras_mensagens_pre_compra') is null
     or to_regclass('public.acessos_telefone_encomenda') is null then
    raise exception 'A migration do chat pre-compra ainda nao esta aplicada nesta base local.';
  end if;
end
$preflight$;

create temporary table chat_pre_compra_resultados (
  ordem bigserial primary key,
  teste text not null,
  estado text not null default 'PASS'
) on commit drop;

grant select, insert on table pg_temp.chat_pre_compra_resultados to public;
grant usage, select on sequence pg_temp.chat_pre_compra_resultados_ordem_seq to public;

create or replace function pg_temp.assert_true(p_condicao boolean, p_teste text)
returns void
language plpgsql
as $fn$
begin
  if not coalesce(p_condicao, false) then
    raise exception 'ASSERT FAIL: %', p_teste;
  end if;

  insert into pg_temp.chat_pre_compra_resultados(teste) values (p_teste);
end
$fn$;

create or replace function pg_temp.expect_error(
  p_sql text,
  p_teste text,
  p_fragmento text default null
)
returns void
language plpgsql
as $fn$
declare
  v_erro text;
begin
  begin
    execute p_sql;
  exception when others then
    v_erro := sqlerrm;
  end;

  if v_erro is null then
    raise exception 'ASSERT FAIL: % (a operacao deveria falhar)', p_teste;
  end if;

  if p_fragmento is not null
     and position(lower(p_fragmento) in lower(v_erro)) = 0 then
    raise exception 'ASSERT FAIL: % (erro inesperado: %)', p_teste, v_erro;
  end if;

  insert into pg_temp.chat_pre_compra_resultados(teste) values (p_teste);
end
$fn$;

grant execute on function pg_temp.assert_true(boolean, text) to public;
grant execute on function pg_temp.expect_error(text, text, text) to public;

-- Contrato real do schema que anteriormente revelou quatro referencias invalidas.
select pg_temp.assert_true(
  position(
    'p.nome_produto'
    in pg_get_functiondef('public.listar_caixa_entrada_pre_compra(integer,timestamptz,uuid)'::regprocedure)
  ) > 0,
  'caixa de entrada usa produtos.nome_produto'
);
select pg_temp.assert_true(
  position(
    'cl.id=c.solicitante_user_id'
    in replace(pg_get_functiondef('public.listar_caixa_entrada_pre_compra(integer,timestamptz,uuid)'::regprocedure),' ','')
  ) > 0,
  'caixa de entrada relaciona clientes por clientes.id'
);
select pg_temp.assert_true(
  position(
    'c.user_id'
    in pg_get_functiondef('public.vincular_conversa_pre_compra_encomenda(uuid,uuid)'::regprocedure)
  ) = 0,
  'vinculo nao referencia clientes.user_id inexistente'
);
select pg_temp.assert_true(
  position(
    'select c.id, true'
    in pg_get_functiondef('public.obter_telefone_contraparte_encomenda(uuid)'::regprocedure)
  ) > 0,
  'telefone identifica o comprador por clientes.id'
);

-- UUIDs das fixtures:
-- 11 comprador; 22 terceiro; 33 vendedor principal; 44 vendedor-comprador;
-- 55 admin; 66 vendedor inativo; 77/88/99 utilizadores de rate limit.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111111','authenticated','authenticated','chat.buyer@example.test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-4222-8222-222222222222','authenticated','authenticated','chat.third@example.test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','33333333-3333-4333-8333-333333333333','authenticated','authenticated','chat.seller@example.test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-8444-444444444444','authenticated','authenticated','chat.sellerbuyer@example.test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','55555555-5555-4555-8555-555555555555','authenticated','authenticated','chat.admin@example.test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','66666666-6666-4666-8666-666666666666','authenticated','authenticated','chat.inactive@example.test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','77777777-7777-4777-8777-777777777777','authenticated','authenticated','chat.rate15@example.test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','88888888-8888-4888-8888-888888888888','authenticated','authenticated','chat.rate100@example.test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','99999999-9999-4999-8999-999999999999','authenticated','authenticated','chat.rate24@example.test','',now(),'{}','{}',now(),now());

-- Os triggers de dominio nao fazem parte da criacao das fixtures. As FKs e checks
-- continuam ativos; apenas triggers USER sao suspensos durante esta preparacao.
alter table public.vendedores disable trigger user;
alter table public.configuracao_operacional_catalogo_produto disable trigger user;
alter table public.produtos disable trigger user;
alter table public.encomendas disable trigger user;
alter table public.itens_encomenda disable trigger user;

insert into public.clientes(id,nome,telefone,email,provincia,municipio,conta_ativa)
values
  ('11111111-1111-4111-8111-111111111111','Comprador Teste','923 000 002','chat.buyer@example.test','Huambo','Huambo',true),
  ('22222222-2222-4222-8222-222222222222','Terceiro Teste','923000003','chat.third@example.test','Huambo','Huambo',true);

insert into public.vendedores(
  id,user_id,nome_comercial,nome_responsavel,telefone_whatsapp,whatsapp,
  email,provincia,municipio,tipo_vendedor,status_aprovacao,conta_ativa
)
values
  ('a0000000-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333','Loja Principal','Vendedor Principal','+244 923-000-001',null,'chat.seller@example.test','Huambo','Huambo','revendedor','aprovado',true),
  ('a0000000-0000-4000-8000-000000000002','44444444-4444-4444-8444-444444444444','Loja Compradora','Vendedor Comprador','+244923000004',null,'chat.sellerbuyer@example.test','Huambo','Huambo','revendedor','aprovado',true),
  ('a0000000-0000-4000-8000-000000000003','66666666-6666-4666-8666-666666666666','Loja Inativa','Vendedor Inativo','+244923000006',null,'chat.inactive@example.test','Huambo','Huambo','revendedor','aprovado',false);

insert into public.administradores(user_id)
values ('55555555-5555-4555-8555-555555555555');

insert into public.provincias_angola(id,codigo_oficial,numero_oficial,nome,ativo,ordem)
values ('b0000000-0000-4000-8000-000000000001','HBO','11','Huambo',true,11);

insert into public.categorias(id,nome)
values ('c0000000-0000-4000-8000-000000000001','Produtos agrícolas');

insert into public.configuracao_operacional_catalogo_produto(
  id,provincia_id,categoria_id,subcategoria_id,estado,requer_revisao_admin
)
values (
  'd0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001',
  null,'ativa',false
);

insert into public.produtos(
  id,vendedor_id,nome_produto,descricao,preco_aproximado,unidade,
  provincia,municipio,categoria_id,publicado,disponivel
)
values
  ('e0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Milho amarelo','Produto ativo',1000,'kg','Huambo','Huambo','c0000000-0000-4000-8000-000000000001',true,true),
  ('e0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','Feijão manteiga','Segundo produto ativo',1500,'kg','Huambo','Huambo','c0000000-0000-4000-8000-000000000001',true,true),
  ('e0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','Produto indisponível','Indisponível',1200,'unidade','Huambo','Huambo','c0000000-0000-4000-8000-000000000001',true,false),
  ('e0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000003','Produto de loja inativa','Inativo',1200,'unidade','Huambo','Huambo','c0000000-0000-4000-8000-000000000001',true,true);

insert into public.encomendas(
  id,codigo_publico,cliente_id,vendedor_id,estado,modalidade_recebimento,
  subtotal_centimos,desconto_centimos,entrega_centimos,total_centimos,
  destinatario_nome,destinatario_telefone,provincia,municipio,concluido_em
)
values
  ('f0000000-0000-4000-8000-000000000001','ANG-2026-A0000001','11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000001','confirmada','levantamento',100000,0,0,100000,'Comprador Teste','923000002','Huambo','Huambo',null),
  ('f0000000-0000-4000-8000-000000000002','ANG-2026-A0000002','11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000001','confirmada','levantamento',100000,0,0,100000,'Comprador Teste','923000002','Huambo','Huambo',null),
  ('f0000000-0000-4000-8000-000000000003','ANG-2026-A0000003','11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000001','aguardando_confirmacao','levantamento',100000,0,0,100000,'Comprador Teste','923000002','Huambo','Huambo',null),
  ('f0000000-0000-4000-8000-000000000004','ANG-2026-A0000004','11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000001','cancelada','levantamento',100000,0,0,100000,'Comprador Teste','923000002','Huambo','Huambo',null),
  ('f0000000-0000-4000-8000-000000000005','ANG-2026-A0000005','11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000001','concluida','levantamento',100000,0,0,100000,'Comprador Teste','923000002','Huambo','Huambo',null),
  ('f0000000-0000-4000-8000-000000000006','ANG-2026-A0000006','11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000001','concluida','levantamento',100000,0,0,100000,'Comprador Teste','923000002','Huambo','Huambo',now()-interval '8 days'),
  ('f0000000-0000-4000-8000-000000000007','ANG-2026-A0000007','11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000001','concluida','levantamento',100000,0,0,100000,'Comprador Teste','923000002','Huambo','Huambo',now()-interval '2 days'),
  ('f0000000-0000-4000-8000-000000000008','ANG-2026-A0000008','11111111-1111-4111-8111-111111111111','a0000000-0000-4000-8000-000000000001','levantada','levantamento',100000,0,0,100000,'Comprador Teste','923000002','Huambo','Huambo',null);

insert into public.itens_encomenda(
  id,encomenda_id,produto_id,vendedor_id,quantidade,unidade,
  tipo_preco_snapshot,valor_unitario_centimos,subtotal_centimos,nome_produto_snapshot
)
values
  ('01000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001',1,'unidade','normal',100000,100000,'Milho amarelo'),
  ('01000000-0000-4000-8000-000000000002','f0000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001',1,'unidade','normal',100000,100000,'Milho amarelo');

-- Conversas historicas sinteticas para provar os dois limites de abertura.
insert into public.conversas_pre_compra(
  solicitante_user_id,vendedor_id,produto_id,estado,criado_em,atualizado_em,encerrada_em
)
select
  '77777777-7777-4777-8777-777777777777',
  'a0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'somente_leitura',now()-interval '5 minutes',now()-interval '5 minutes',now()-interval '5 minutes'
from generate_series(1,5);

insert into public.conversas_pre_compra(
  solicitante_user_id,vendedor_id,produto_id,estado,criado_em,atualizado_em,encerrada_em
)
select
  '99999999-9999-4999-8999-999999999999',
  'a0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'somente_leitura',now()-interval '2 hours',now()-interval '2 hours',now()-interval '2 hours'
from generate_series(1,20);

alter table public.itens_encomenda enable trigger user;
alter table public.encomendas enable trigger user;
alter table public.produtos enable trigger user;
alter table public.configuracao_operacional_catalogo_produto enable trigger user;
alter table public.vendedores enable trigger user;

-- Permissoes minimas, isolamento e ausencia de exposicao do log telefonico.
select pg_temp.assert_true(
  not has_function_privilege('authenticated','public.vincular_conversa_pre_compra_encomenda(uuid,uuid)','EXECUTE'),
  'browser autenticado nao executa o vinculo interno'
);
select pg_temp.assert_true(
  not has_function_privilege('anon','public.abrir_ou_obter_conversa_pre_compra(uuid)','EXECUTE'),
  'anon nao executa abertura de conversa'
);
select pg_temp.assert_true(
  not has_table_privilege('authenticated','public.acessos_telefone_encomenda','SELECT'),
  'log de telefone nao e legivel pelo browser'
);
select pg_temp.assert_true(
  not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='acessos_telefone_encomenda'
      and column_name ~* 'telefone|phone|numero'
  ),
  'log de telefone nao guarda o numero'
);

-- Comprador abre conversa e a repeticao devolve a mesma conversa.
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select id from public.abrir_ou_obter_conversa_pre_compra('e0000000-0000-4000-8000-000000000001') \gset buyer_
select id from public.abrir_ou_obter_conversa_pre_compra('e0000000-0000-4000-8000-000000000001') \gset buyer_repeat_
select pg_temp.assert_true(:'buyer_id'::uuid=:'buyer_repeat_id'::uuid,'abertura e idempotente enquanto a conversa esta aberta');

-- Vendedor tambem pode comprar de outro vendedor.
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select id from public.abrir_ou_obter_conversa_pre_compra('e0000000-0000-4000-8000-000000000001') \gset seller_buyer_
select pg_temp.assert_true(:'seller_buyer_id'::uuid is not null,'vendedor pode abrir conversa como comprador de outra loja');

-- Auto-contacto, Admin, anonimo e catalogo inelegivel sao recusados.
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select pg_temp.expect_error(
  $sql$select * from public.abrir_ou_obter_conversa_pre_compra('e0000000-0000-4000-8000-000000000001')$sql$,
  'vendedor nao abre conversa consigo proprio'
);
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
select pg_temp.expect_error(
  $sql$select * from public.abrir_ou_obter_conversa_pre_compra('e0000000-0000-4000-8000-000000000001')$sql$,
  'Admin nao abre conversa comercial'
);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select pg_temp.expect_error(
  $sql$select * from public.abrir_ou_obter_conversa_pre_compra('e0000000-0000-4000-8000-000000000003')$sql$,
  'produto indisponivel nao abre conversa'
);
select pg_temp.expect_error(
  $sql$select * from public.abrir_ou_obter_conversa_pre_compra('e0000000-0000-4000-8000-000000000004')$sql$,
  'vendedor inativo nao recebe conversa'
);
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.expect_error(
  $sql$select * from public.abrir_ou_obter_conversa_pre_compra('e0000000-0000-4000-8000-000000000001')$sql$,
  'anonimo nao abre conversa'
);

-- Limites de abertura: cinco em 15 minutos e vinte em 24 horas.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',true);
select pg_temp.expect_error(
  $sql$select * from public.abrir_ou_obter_conversa_pre_compra('e0000000-0000-4000-8000-000000000002')$sql$,
  'sexta conversa em 15 minutos e recusada'
);
select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
select pg_temp.expect_error(
  $sql$select * from public.abrir_ou_obter_conversa_pre_compra('e0000000-0000-4000-8000-000000000002')$sql$,
  'vigesima primeira conversa em 24 horas e recusada'
);

-- Mensagem, idempotencia e notificacao sem conteudo sensivel.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.enviar_mensagem_pre_compra(
  :'buyer_id'::uuid,'  SEGREDO-NAO-NOTIFICAR  ','10000000-0000-4000-8000-000000000001'
) as id \gset message_
select public.enviar_mensagem_pre_compra(
  :'buyer_id'::uuid,'corpo ignorado no replay','10000000-0000-4000-8000-000000000001'
) as id \gset message_repeat_
select pg_temp.assert_true(:'message_id'::uuid=:'message_repeat_id'::uuid,'replay idempotente devolve a mesma mensagem');
select pg_temp.assert_true(
  (select count(*)=1 from public.mensagens_pre_compra
   where conversa_id=:'buyer_id'::uuid
     and remetente_user_id='11111111-1111-4111-8111-111111111111'
     and chave_idempotencia='10000000-0000-4000-8000-000000000001'),
  'idempotencia nao duplica a mensagem'
);

reset role;
select pg_temp.assert_true(
  (select count(*)=1 from public.notificacoes
   where entidade_tipo='conversa_pre_compra' and entidade_id=:'buyer_id'::uuid
     and tipo='mensagem_pre_compra'),
  'primeira mensagem cria uma notificacao unica'
);
select pg_temp.assert_true(
  (select bool_and(mensagem='Recebeste uma nova mensagem.' and mensagem not ilike '%SEGREDO%')
   from public.notificacoes
   where entidade_tipo='conversa_pre_compra' and entidade_id=:'buyer_id'::uuid
     and tipo='mensagem_pre_compra'),
  'notificacao e generica e nao contem o corpo da mensagem'
);

-- O vendedor ve resumo, contraparte, previa e nao lidas; depois marca como lida.
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select pg_temp.assert_true(
  exists (
    select 1 from public.listar_caixa_entrada_pre_compra(20,null,null) c
    where c.id=:'buyer_id'::uuid
      and c.produto_nome='Milho amarelo'
      and c.contraparte_nome='Comprador Teste'
      and c.ultima_mensagem_previa='SEGREDO-NAO-NOTIFICAR'
      and c.mensagens_nao_lidas=1
  ),
  'caixa de entrada devolve resumo seguro e uma nao lida'
);
select public.marcar_conversa_pre_compra_como_lida(:'buyer_id'::uuid);
select pg_temp.assert_true(
  exists (
    select 1 from public.listar_caixa_entrada_pre_compra(20,null,null) c
    where c.id=:'buyer_id'::uuid and c.mensagens_nao_lidas=0
  ),
  'marcar como lida zera o contador'
);
select pg_temp.assert_true(
  (select count(*)=1 from public.listar_mensagens_pre_compra(:'buyer_id'::uuid,30,null,null)),
  'vendedor participante lista as mensagens'
);

-- Terceiro e Admin nao veem por RLS nem pelas RPCs.
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select pg_temp.assert_true(
  not exists(select 1 from public.conversas_pre_compra where id=:'buyer_id'::uuid),
  'RLS oculta conversa de terceiro'
);
select pg_temp.expect_error(
  'select * from public.listar_mensagens_pre_compra('||quote_literal(:'buyer_id')||'::uuid,30,null,null)',
  'terceiro nao lista mensagens'
);
select pg_temp.expect_error(
  'select public.enviar_mensagem_pre_compra('||quote_literal(:'buyer_id')||'::uuid,''intrusao'',''10000000-0000-4000-8000-000000000002''::uuid)',
  'terceiro nao envia mensagem'
);
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
select pg_temp.assert_true(
  not exists(select 1 from public.conversas_pre_compra where id=:'buyer_id'::uuid),
  'RLS tambem oculta conversa do Admin'
);
select pg_temp.expect_error(
  'select * from public.obter_conversa_pre_compra('||quote_literal(:'buyer_id')||'::uuid)',
  'Admin nao consulta conversa comercial'
);

-- Validacao de corpo e produto desativado depois da abertura.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select pg_temp.expect_error(
  'select public.enviar_mensagem_pre_compra('||quote_literal(:'buyer_id')||'::uuid,''   '',''10000000-0000-4000-8000-000000000003''::uuid)',
  'mensagem vazia e recusada'
);
select pg_temp.expect_error(
  'select public.enviar_mensagem_pre_compra('||quote_literal(:'buyer_id')||'::uuid,repeat(''x'',1001),''10000000-0000-4000-8000-000000000004''::uuid)',
  'mensagem acima de 1000 caracteres e recusada'
);
reset role;
set local session_replication_role=replica;
update public.produtos set disponivel=false where id='e0000000-0000-4000-8000-000000000001';
set local session_replication_role=origin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select pg_temp.expect_error(
  'select public.enviar_mensagem_pre_compra('||quote_literal(:'buyer_id')||'::uuid,''nao deve sair'',''10000000-0000-4000-8000-000000000005''::uuid)',
  'conversa aberta deixa de enviar se o produto ficar indisponivel'
);
reset role;
set local session_replication_role=replica;
update public.produtos set disponivel=true where id='e0000000-0000-4000-8000-000000000001';
set local session_replication_role=origin;

-- Dez mensagens por minuto: ja existe uma; nove fixtures completam o limite.
set local session_replication_role=replica;
insert into public.mensagens_pre_compra(conversa_id,remetente_user_id,corpo,chave_idempotencia,criado_em)
select :'buyer_id'::uuid,'11111111-1111-4111-8111-111111111111','rate minuto '||g,
       ('20000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,now()
from generate_series(1,9) g;
set local session_replication_role=origin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select pg_temp.expect_error(
  'select public.enviar_mensagem_pre_compra('||quote_literal(:'buyer_id')||'::uuid,''decima primeira'',''20000000-0000-4000-8000-000000000010''::uuid)',
  'decima primeira mensagem no minuto e recusada'
);

-- Cem mensagens em 24 horas, mas fora da janela de um minuto.
select set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888888',true);
select id from public.abrir_ou_obter_conversa_pre_compra('e0000000-0000-4000-8000-000000000002') \gset daily_
reset role;
set local session_replication_role=replica;
insert into public.mensagens_pre_compra(conversa_id,remetente_user_id,corpo,chave_idempotencia,criado_em)
select :'daily_id'::uuid,'88888888-8888-4888-8888-888888888888','rate diario '||g,
       ('30000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,now()-interval '2 hours'
from generate_series(1,100) g;
set local session_replication_role=origin;
set local role authenticated;
select set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888888',true);
select pg_temp.expect_error(
  'select public.enviar_mensagem_pre_compra('||quote_literal(:'daily_id')||'::uuid,''centésima primeira'',''30000000-0000-4000-8000-000000000101''::uuid)',
  'centesima primeira mensagem em 24 horas e recusada'
);

-- O browser nao pode vincular. O checkout interno vincula sob a sessao do comprador.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select pg_temp.expect_error(
  'select public.vincular_conversa_pre_compra_encomenda('||quote_literal(:'buyer_id')||'::uuid,''f0000000-0000-4000-8000-000000000001''::uuid)',
  'browser nao chama diretamente o vinculo interno',
  'permission denied'
);
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.vincular_conversa_pre_compra_encomenda(:'buyer_id'::uuid,'f0000000-0000-4000-8000-000000000001');
select public.vincular_conversa_pre_compra_encomenda(:'buyer_id'::uuid,'f0000000-0000-4000-8000-000000000001');
select pg_temp.assert_true(
  exists(select 1 from public.conversas_pre_compra
         where id=:'buyer_id'::uuid and estado='somente_leitura'
           and encomenda_id='f0000000-0000-4000-8000-000000000001'
           and encerrada_em is not null),
  'vinculo interno fecha a conversa e e idempotente para o mesmo par'
);
select pg_temp.expect_error(
  'select public.vincular_conversa_pre_compra_encomenda('||quote_literal(:'buyer_id')||'::uuid,''f0000000-0000-4000-8000-000000000002''::uuid)',
  'conversa nao pode ser revinculada a outra encomenda'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select pg_temp.expect_error(
  'select public.enviar_mensagem_pre_compra('||quote_literal(:'buyer_id')||'::uuid,''depois do checkout'',''40000000-0000-4000-8000-000000000001''::uuid)',
  'conversa vinculada fica somente leitura'
);
select id from public.abrir_ou_obter_conversa_pre_compra('e0000000-0000-4000-8000-000000000001') \gset buyer_new_
select pg_temp.assert_true(:'buyer_new_id'::uuid<>:'buyer_id'::uuid,'nova compra pode abrir nova conversa depois do vinculo');
select pg_temp.assert_true(
  (select count(*)=1 from public.conversas_pre_compra
   where solicitante_user_id='11111111-1111-4111-8111-111111111111'
     and vendedor_id='a0000000-0000-4000-8000-000000000001'
     and produto_id='e0000000-0000-4000-8000-000000000001'
     and estado='aberta'),
  'unicidade parcial permite exatamente uma conversa aberta'
);

-- Telefone: apenas participantes, estados autorizados e janela de sete dias.
select telefone from public.obter_telefone_contraparte_encomenda('f0000000-0000-4000-8000-000000000001') \gset buyer_phone_
select pg_temp.assert_true(:'buyer_phone_telefone'='+244923000001','comprador recebe telefone normalizado do vendedor');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select telefone from public.obter_telefone_contraparte_encomenda('f0000000-0000-4000-8000-000000000001') \gset seller_phone_
select pg_temp.assert_true(:'seller_phone_telefone'='923000002','vendedor recebe telefone normalizado do comprador');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select telefone from public.obter_telefone_contraparte_encomenda('f0000000-0000-4000-8000-000000000007') \gset recent_phone_
select pg_temp.assert_true(:'recent_phone_telefone'='+244923000001','concluida ha menos de sete dias permite contacto');
select telefone from public.obter_telefone_contraparte_encomenda('f0000000-0000-4000-8000-000000000008') \gset pickup_phone_
select pg_temp.assert_true(:'pickup_phone_telefone'='+244923000001','estado levantada permanece autorizado');

reset role;
select pg_temp.assert_true(
  (select count(*)=4 from public.acessos_telefone_encomenda),
  'cada consulta telefonica bem-sucedida e auditada'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select pg_temp.expect_error(
  $sql$select * from public.obter_telefone_contraparte_encomenda('f0000000-0000-4000-8000-000000000001')$sql$,
  'terceiro nao obtem telefone'
);
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
select pg_temp.expect_error(
  $sql$select * from public.obter_telefone_contraparte_encomenda('f0000000-0000-4000-8000-000000000001')$sql$,
  'Admin nao obtem telefone comercial'
);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select pg_temp.expect_error(
  $sql$select * from public.obter_telefone_contraparte_encomenda('f0000000-0000-4000-8000-000000000003')$sql$,
  'aguardando confirmacao nao revela telefone'
);
select pg_temp.expect_error(
  $sql$select * from public.obter_telefone_contraparte_encomenda('f0000000-0000-4000-8000-000000000004')$sql$,
  'encomenda cancelada nao revela telefone'
);
select pg_temp.expect_error(
  $sql$select * from public.obter_telefone_contraparte_encomenda('f0000000-0000-4000-8000-000000000005')$sql$,
  'concluida sem timestamp nao revela telefone'
);
select pg_temp.expect_error(
  $sql$select * from public.obter_telefone_contraparte_encomenda('f0000000-0000-4000-8000-000000000006')$sql$,
  'concluida ha mais de sete dias nao revela telefone'
);

reset role;
select pg_temp.assert_true(
  (select count(*)=4 from public.acessos_telefone_encomenda),
  'tentativas telefonicas recusadas nao geram auditoria'
);

select 'SQL_FUNCTIONAL_PASS' as resultado, count(*) as assertions_pass
from pg_temp.chat_pre_compra_resultados;

rollback;
