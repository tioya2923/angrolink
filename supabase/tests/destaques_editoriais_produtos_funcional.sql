\set ON_ERROR_STOP on

-- Executar apenas numa base Supabase local descartável com 20261012010000
-- aplicada. Todas as fixtures sintéticas desaparecem no ROLLBACK.
begin;

create temporary table pg_temp.resultados_destaques_editoriais (nome text primary key) on commit drop;
create or replace function pg_temp.assert_true(p_condicao boolean, p_nome text) returns void language plpgsql as $$
begin
  if not coalesce(p_condicao, false) then raise exception 'ASSERT FAIL: %', p_nome; end if;
  insert into pg_temp.resultados_destaques_editoriais values (p_nome);
end;
$$;
create or replace function pg_temp.expect_error(p_sql text, p_nome text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
    raise exception 'ASSERT FAIL: % não falhou', p_nome;
  exception when others then
    if sqlerrm like 'ASSERT FAIL:%' then raise; end if;
  end;
  insert into pg_temp.resultados_destaques_editoriais values (p_nome);
end;
$$;
grant select, insert on pg_temp.resultados_destaques_editoriais to public;
grant execute on function pg_temp.assert_true(boolean, text), pg_temp.expect_error(text, text) to public;

-- IDs sintéticos, sem dados operacionais.
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('00000000-0000-0000-0000-000000000000','a1000000-0000-4000-8000-000000000001','authenticated','authenticated','destaque-admin-1@test.local','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','a1000000-0000-4000-8000-000000000002','authenticated','authenticated','destaque-admin-2@test.local','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','a1000000-0000-4000-8000-000000000003','authenticated','authenticated','destaque-vendedor-1@test.local','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','a1000000-0000-4000-8000-000000000004','authenticated','authenticated','destaque-vendedor-2@test.local','',now(),'{}','{}',now(),now());
insert into public.administradores(user_id) values
('a1000000-0000-4000-8000-000000000001'),('a1000000-0000-4000-8000-000000000002');

-- A fixture administrativa \u00e9 criada sob a identidade do primeiro Admin,
-- respeitando o trigger autoritativo de campos administrativos de vendedores.
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);

insert into public.vendedores(id,user_id,nome_comercial,nome_responsavel,telefone_whatsapp,email,provincia,municipio,tipo_vendedor,status_aprovacao,conta_ativa)
values
('b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003','Vendedor editorial 1','Responsável','923100001','destaque-vendedor-1@test.local','Huambo','Huambo','revendedor','aprovado',true),
('b1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000004','Vendedor editorial 2','Responsável','923100002','destaque-vendedor-2@test.local','Huambo','Huambo','revendedor','aprovado',true);

-- Reutiliza uma categoria operacional do schema local, sem assumir IDs externos.
insert into public.produtos(id,vendedor_id,nome_produto,categoria_id,provincia,municipio,publicado,disponivel,preco_aproximado,unidade,tipo_venda)
select 'c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Produto editorial 1', c.id, 'Huambo', 'Huambo', true, true, 100, 'unidade', 'retalho'
from public.categorias c where lower(btrim(c.nome)) = 'alimentos' limit 1;
insert into public.produtos(id,vendedor_id,nome_produto,categoria_id,provincia,municipio,publicado,disponivel,preco_aproximado,unidade,tipo_venda)
select 'c1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'Produto editorial 2', c.id, 'Huambo', 'Huambo', true, true, 100, 'unidade', 'retalho'
from public.categorias c where lower(btrim(c.nome)) = 'alimentos' limit 1;

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
-- FROM executa a RPC composta uma única vez; (rpc()).* poderia expandi-la
-- em múltiplas avaliações e transformar a própria prova em colisão real.
select d.* from public.criar_destaque_produto_editorial_admin('c1000000-0000-4000-8000-000000000001') d \gset destaque_
select pg_temp.assert_true(
  (select fim_em = inicio_em + interval '7 days' and posicao = 1 from public.destaques_produtos_editoriais where id = :'destaque_id'::uuid),
  'Admin cria destaque imediato de sete dias na menor posição livre'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.eventos_destaques_produtos_editoriais where destaque_id = :'destaque_id'::uuid and acao = 'criado'),
  'criação grava histórico privado'
);

-- Outro Admin recebe a próxima posição; o mesmo vendedor não pode ocupar outra.
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
select d.* from public.criar_destaque_produto_editorial_admin('c1000000-0000-4000-8000-000000000002') d \gset destaque2_
select pg_temp.assert_true((select posicao = 2 from public.destaques_produtos_editoriais where id = :'destaque2_id'::uuid),'segunda sessão Admin recebe posição livre distinta');
select pg_temp.expect_error($$select public.criar_destaque_produto_editorial_admin('c1000000-0000-4000-8000-000000000001'::uuid)$$,'produto e vendedor não recebem destaque sobreposto');

-- Produto inelegível não entra na exposição e revogação remove da projeção.
update public.produtos set disponivel = false where id = 'c1000000-0000-4000-8000-000000000002';
select pg_temp.assert_true(not exists(select 1 from public.listar_destaques_produtos_editoriais_publicos(8) item where item->>'id'='c1000000-0000-4000-8000-000000000002'),'produto inelegível deixa de aparecer sem revogar o histórico');
update public.produtos set disponivel = true where id = 'c1000000-0000-4000-8000-000000000002';
select pg_temp.assert_true(exists(select 1 from public.listar_destaques_produtos_editoriais_publicos(8) item where item->>'id'='c1000000-0000-4000-8000-000000000002'),'produto recupera exposição quando volta a ser elegível');
select d.* from public.revogar_destaque_produto_editorial_admin(:'destaque2_id'::uuid,'motivo interno') d \gset revogado_
select pg_temp.assert_true(not exists(select 1 from public.listar_destaques_produtos_editoriais_publicos(8) item where item->>'id'='c1000000-0000-4000-8000-000000000002'),'revogação remove o produto da projeção pública');

-- Browser não altera flags legados nem chama as RPCs antigas; edição normal mantém-se.
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
select pg_temp.expect_error($$update public.produtos set destaque=true where id='c1000000-0000-4000-8000-000000000001'::uuid$$,'browser não faz bypass por UPDATE legado');
select pg_temp.assert_true(
  not has_function_privilege('authenticated','public.destacar_produto_gratis(uuid)','execute')
  and not has_function_privilege('authenticated','public.remover_destaque_produto(uuid)','execute'),
  'RPCs antigas não são executáveis pelo browser'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select pg_temp.expect_error(
  $$update public.produtos set destaque=true where id='c1000000-0000-4000-8000-000000000001'::uuid$$,
  'Admin autenticado não faz bypass por UPDATE legado'
);
reset role;
update public.produtos set descricao='Edição normal preservada' where id='c1000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select descricao='Edição normal preservada' from public.produtos where id='c1000000-0000-4000-8000-000000000001'),'edição normal não altera flags e permanece possível');

select pg_temp.assert_true(
  not has_function_privilege('anon','public.criar_destaque_produto_editorial_admin(uuid)','execute')
  and has_function_privilege('authenticated','public.criar_destaque_produto_editorial_admin(uuid)','execute')
  and not has_table_privilege('anon','public.eventos_destaques_produtos_editoriais','select'),
  'histórico e criação são protegidos por grants mínimos'
);
-- O insert/UPDATE normal preserva os campos legados neutros. A permissao
-- final do vendedor e coberta pelo contrato existente de RLS; esta fixture
-- administrativa evita transformar o teste editorial num teste de grants
-- legados de vendedores ausentes da baseline estrutural.
reset role;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
insert into public.produtos(id,vendedor_id,nome_produto,categoria_id,provincia,municipio,publicado,disponivel,preco_aproximado,unidade,tipo_venda)
select 'c1000000-0000-4000-8000-000000000090','b1000000-0000-4000-8000-000000000001','Produto normal autenticado',id,'Huambo','Huambo',true,true,100,'unidade','retalho'
from public.categorias where lower(btrim(nome))='alimentos' limit 1;
update public.produtos set descricao='Edicao autenticada preservada' where id='c1000000-0000-4000-8000-000000000090';
set local role authenticated;
select pg_temp.expect_error(
  $$insert into public.produtos(id,vendedor_id,nome_produto,categoria_id,provincia,municipio,publicado,disponivel,preco_aproximado,unidade,tipo_venda,destaque) select 'c1000000-0000-4000-8000-000000000091','b1000000-0000-4000-8000-000000000001','Bypass legado',id,'Huambo','Huambo',true,true,100,'unidade','retalho',true from public.categorias where lower(btrim(nome))='alimentos' limit 1$$,
  'vendedor autenticado nao insere flag legado'
);
reset role;
select pg_temp.assert_true(
  (select descricao='Edicao autenticada preservada' from public.produtos where id='c1000000-0000-4000-8000-000000000090'),
  'criacao e edicao normais autenticadas permanecem possiveis'
);

-- Um segundo produto do mesmo vendedor nao pode ocupar o mesmo periodo.
insert into public.produtos(id,vendedor_id,nome_produto,categoria_id,provincia,municipio,publicado,disponivel,preco_aproximado,unidade,tipo_venda)
select 'c1000000-0000-4000-8000-000000000092','b1000000-0000-4000-8000-000000000001','Segundo produto do vendedor 1',id,'Huambo','Huambo',true,true,100,'unidade','retalho'
from public.categorias where lower(btrim(nome))='alimentos' limit 1;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select pg_temp.expect_error(
  $$select public.criar_destaque_produto_editorial_admin('c1000000-0000-4000-8000-000000000092'::uuid)$$,
  'um vendedor nao recebe dois destaques sobrepostos'
);

-- Sete vendedores adicionais preenchem as oito posicoes; o nono e recusado.
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000',
       ('a1000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
       'authenticated','authenticated','destaque-vendedor-' || i || '@test.local','',now(),'{}','{}',now(),now()
from generate_series(5,12) i;
insert into public.vendedores(id,user_id,nome_comercial,nome_responsavel,telefone_whatsapp,email,provincia,municipio,tipo_vendedor,status_aprovacao,conta_ativa)
select ('b1000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
       ('a1000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
       'Vendedor editorial ' || i,'Responsavel','9231000' || lpad(i::text,2,'0'),'destaque-vendedor-' || i || '@test.local','Huambo','Huambo','revendedor','aprovado',true
from generate_series(5,12) i;
insert into public.produtos(id,vendedor_id,nome_produto,categoria_id,provincia,municipio,publicado,disponivel,preco_aproximado,unidade,tipo_venda)
select ('c1000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
       ('b1000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
       'Produto editorial ' || i,c.id,'Huambo','Huambo',true,true,100,'unidade','retalho'
from generate_series(5,12) i cross join lateral (select id from public.categorias where lower(btrim(nome))='alimentos' limit 1) c;
do $$
declare i integer;
begin
  for i in 5..11 loop
    perform public.criar_destaque_produto_editorial_admin(('c1000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid);
  end loop;
end;
$$;
select pg_temp.assert_true(
  (select count(*)=8 and min(posicao)=1 and max(posicao)=8 from public.destaques_produtos_editoriais where revogado_em is null and fim_em>now()),
  'oito posicoes globais sao preenchidas uma vez cada'
);
select pg_temp.expect_error(
  $$select public.criar_destaque_produto_editorial_admin('c1000000-0000-4000-8000-000000000012'::uuid)$$,
  'nona posicao global e recusada'
);

-- Fim passado nao aparece publicamente e liberta uma nova selecao.
update public.destaques_produtos_editoriais
set inicio_em=now()-interval '8 days', fim_em=now()-interval '1 day'
where produto_id='c1000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(
  not exists(select 1 from public.listar_destaques_produtos_editoriais_publicos(8) item where item->>'id'='c1000000-0000-4000-8000-000000000001'),
  'destaque expirado nao e devolvido publicamente'
);
select d.* from public.criar_destaque_produto_editorial_admin('c1000000-0000-4000-8000-000000000012') d \gset destaque10_
select pg_temp.assert_true(
  (select fim_em>now() from public.destaques_produtos_editoriais where id=:'destaque10_id'::uuid),
  'expiracao permite uma nova selecao editorial'
);

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
select pg_temp.expect_error(
  $$select public.criar_destaque_produto_editorial_admin('c1000000-0000-4000-8000-000000000001'::uuid)$$,
  'nao Admin e recusado pela RPC editorial'
);
select pg_temp.assert_true(
  not exists(
    select 1 from public.listar_produtos_publicos_fase1(p_produto_id=>'c1000000-0000-4000-8000-000000000002'::uuid) item
    where item ? 'motivo_revogacao_interno' or item ? 'criado_por' or item ? 'revogado_por'
  ),
  'contrato publico nao expoe motivo nem autores internos'
);

select 'DESTAQUES_EDITORIAIS_ASSERTIONS=' || count(*) from pg_temp.resultados_destaques_editoriais;
rollback;
