\set ON_ERROR_STOP on
\set QUIET 1

begin;

create temporary table pg_temp.chat_checkout_resultados (
  id bigint generated always as identity primary key,
  mensagem text not null
) on commit drop;

create or replace function pg_temp.assert_true(p_cond boolean, p_mensagem text)
returns void language plpgsql as $$
begin
  if coalesce(p_cond, false) is not true then
    raise exception 'ASSERT: %', p_mensagem;
  end if;
  insert into pg_temp.chat_checkout_resultados(mensagem) values (p_mensagem);
end $$;

create or replace function pg_temp.expect_error(p_sql text, p_mensagem text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    insert into pg_temp.chat_checkout_resultados(mensagem) values (p_mensagem);
    return;
  end;
  raise exception 'EXPECT_ERROR: %', p_mensagem;
end $$;

-- Todos os identificadores e linhas desta fixture são sintéticos e o ROLLBACK
-- final restaura também estas substituições transitórias das RPCs históricas.
do $$
declare
  comprador uuid := '11111111-1111-1111-1111-111111111111';
  vendedor_user uuid := '22222222-2222-2222-2222-222222222222';
  vendedor_comprador uuid := '33333333-3333-3333-3333-333333333333';
  terceiro uuid := '44444444-4444-4444-4444-444444444444';
  admin uuid := '55555555-5555-5555-5555-555555555555';
  vendedor_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  outro_vendedor_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  produto_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  outro_produto_id uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
begin
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data)
  values
    (comprador,'authenticated','authenticated','comprador-chat-fixture@example.test','{}','{}'),
    (vendedor_user,'authenticated','authenticated','vendedor-chat-fixture@example.test','{}','{}'),
    (vendedor_comprador,'authenticated','authenticated','vendedor-comprador-chat-fixture@example.test','{}','{}'),
    (terceiro,'authenticated','authenticated','terceiro-chat-fixture@example.test','{}','{}'),
    (admin,'authenticated','authenticated','admin-chat-fixture@example.test','{}','{}');
  insert into public.administradores(user_id) values (admin);
  insert into public.profiles(id,nome,email,papel,ativo) values
    (vendedor_user,'Vendedor','vendedor-chat-fixture@example.test','vendedor',true),
    (vendedor_comprador,'Vendedor comprador','vendedor-comprador-chat-fixture@example.test','vendedor',true)
  on conflict (id) do update set papel=excluded.papel, ativo=excluded.ativo, apagado_em=null;
  insert into public.clientes(id,nome,telefone,conta_ativa) values
    (comprador,'Comprador','923000001',true),
    (vendedor_comprador,'Vendedor comprador','923000002',true),
    (terceiro,'Terceiro','923000003',true);
  insert into public.provincias_angola(id,codigo_oficial,numero_oficial,nome,ordem,ativo)
  values ('99999999-9999-9999-9999-999999999991','HBO',8,'Huambo',8,true);
  insert into public.municipios_angola(id,provincia_id,codigo_oficial,numero_oficial,nome,ativo)
  values ('99999999-9999-9999-9999-999999999992','99999999-9999-9999-9999-999999999991','HBO-HBO',801,'Huambo',true);
  insert into public.categorias(id,nome) values ('99999999-9999-9999-9999-999999999993','Alimentos');
  insert into public.subcategorias_produto(id,categoria_id,nome,slug,ordem_exibicao) values ('99999999-9999-9999-9999-999999999994','99999999-9999-9999-9999-999999999993','Teste','teste-chat',1);
  insert into public.configuracao_operacional_catalogo_produto(provincia_id,categoria_id,subcategoria_id,estado)
  values ('99999999-9999-9999-9999-999999999991','99999999-9999-9999-9999-999999999993','99999999-9999-9999-9999-999999999994','ativa');
  insert into public.configuracoes_financeiras(chave,comissao_bps,prazo_repasse_horas,ativo)
  values ('padrao',0,0,true);
  insert into public.vendedores(id,user_id,nome_comercial,telefone_whatsapp,provincia,municipio)
  values (vendedor_id,vendedor_user,'Loja válida','923111111','Huambo','Huambo'),
         (outro_vendedor_id,vendedor_comprador,'Outra loja','923222222','Huambo','Huambo');
  perform set_config('request.jwt.claim.sub',admin::text,true);
  update public.vendedores set status_aprovacao='aprovado' where id in (vendedor_id,outro_vendedor_id);
  insert into public.produtos(id,vendedor_id,nome_produto,preco_aproximado,quantidade_minima,unidade,tipo_venda,provincia,categoria_id,subcategoria_id,publicado,disponivel)
  values (produto_id,vendedor_id,'Produto válido',100,1,'unidade','retalho','Huambo','99999999-9999-9999-9999-999999999993','99999999-9999-9999-9999-999999999994',true,true),
         (outro_produto_id,outro_vendedor_id,'Outro produto',100,1,'unidade','retalho','Huambo','99999999-9999-9999-9999-999999999993','99999999-9999-9999-9999-999999999994',true,true);
end $$;

-- Caminhos end-to-end: não usam doubles e exercitam as RPCs históricas reais.
do $$
declare
  comprador uuid := '11111111-1111-1111-1111-111111111111';
  produto uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  conversa_l uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeea1';
  conversa_d uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeea2';
  chave_l uuid := '20000000-0000-0000-0000-000000000001';
  chave_d uuid := '20000000-0000-0000-0000-000000000002';
  encomenda_l uuid; encomenda_d uuid;
  l_encomendas integer; l_itens integer; l_pagamentos integer; l_tentativas integer; l_idempotencias integer;
  d_encomendas integer; d_itens integer; d_pagamentos integer; d_tentativas integer; d_idempotencias integer;
  f_encomendas integer; f_itens integer; f_pagamentos integer; f_tentativas integer; f_idempotencias integer;
  f_estado text; f_encomenda_id uuid;
  depois_encomendas integer; depois_itens integer; depois_pagamentos integer; depois_tentativas integer; depois_idempotencias integer;
  depois_estado text; depois_encomenda_id uuid;
begin
  perform set_config('request.jwt.claim.sub',comprador::text,true);
  insert into public.conversas_pre_compra(id,solicitante_user_id,vendedor_id,produto_id)
  values(conversa_l,comprador,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',produto);
  select id into encomenda_l from public.criar_encomenda_levantamento_com_conversa(
    jsonb_build_array(jsonb_build_object('produto_id',produto,'quantidade',1)),
    'levantamento','Comprador','923000001','',chave_l,conversa_l);
  perform pg_temp.assert_true(
    (select count(*)=1 from public.itens_encomenda where encomenda_id=encomenda_l)
    and (select count(*)=1 from public.pagamentos where encomenda_id=encomenda_l)
    and (select count(*)=1 from public.tentativas_pagamento t join public.pagamentos p on p.id=t.pagamento_id where p.encomenda_id=encomenda_l)
    and (select conversa_pre_compra_id=conversa_l from public.idempotencia_checkout_encomenda where chave_idempotencia=chave_l)
    and (select estado='somente_leitura' and encomenda_id=encomenda_l from public.conversas_pre_compra where id=conversa_l),
    'levantamento real cria todos os efeitos e vincula conversa');
  select count(*) into l_encomendas from public.encomendas;
  select count(*) into l_itens from public.itens_encomenda;
  select count(*) into l_pagamentos from public.pagamentos;
  select count(*) into l_tentativas from public.tentativas_pagamento;
  select count(*) into l_idempotencias from public.idempotencia_checkout_encomenda;
  perform pg_temp.assert_true((select id from public.criar_encomenda_levantamento_com_conversa(jsonb_build_array(jsonb_build_object('produto_id',produto,'quantidade',1)),'levantamento','Comprador','923000001','',chave_l,conversa_l))=encomenda_l,'replay real de levantamento não cria nova encomenda');
  perform pg_temp.assert_true(
    l_encomendas=(select count(*) from public.encomendas)
    and l_itens=(select count(*) from public.itens_encomenda)
    and l_pagamentos=(select count(*) from public.pagamentos)
    and l_tentativas=(select count(*) from public.tentativas_pagamento)
    and l_idempotencias=(select count(*) from public.idempotencia_checkout_encomenda),
    'replay real de levantamento preserva todas as contagens');
  insert into public.conversas_pre_compra(id,solicitante_user_id,vendedor_id,produto_id)
  values(conversa_d,comprador,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',produto);
  select (public.criar_encomenda_entrega_com_conversa(jsonb_build_array(jsonb_build_object('produto_id',produto,'quantidade',1)),'Comprador','923000001','Huambo','Huambo','Centro','Rua',null,null,null,chave_d,conversa_d)->>'id')::uuid into encomenda_d;
  perform pg_temp.assert_true(
    (select count(*)=1 from public.itens_encomenda where encomenda_id=encomenda_d)
    and (select count(*)=1 from public.pagamentos where encomenda_id=encomenda_d)
    and (select count(*)=1 from public.tentativas_pagamento t join public.pagamentos p on p.id=t.pagamento_id where p.encomenda_id=encomenda_d)
    and (select conversa_pre_compra_id=conversa_d from public.idempotencia_checkout_encomenda where chave_idempotencia=chave_d)
    and (select estado='somente_leitura' and encomenda_id=encomenda_d from public.conversas_pre_compra where id=conversa_d),
    'entrega real cria todos os efeitos e vincula conversa');
  select count(*) into d_encomendas from public.encomendas;
  select count(*) into d_itens from public.itens_encomenda;
  select count(*) into d_pagamentos from public.pagamentos;
  select count(*) into d_tentativas from public.tentativas_pagamento;
  select count(*) into d_idempotencias from public.idempotencia_checkout_encomenda;
  perform pg_temp.assert_true((select (public.criar_encomenda_entrega_com_conversa(jsonb_build_array(jsonb_build_object('produto_id',produto,'quantidade',1)),'Comprador','923000001','Huambo','Huambo','Centro','Rua',null,null,null,chave_d,conversa_d)->>'id')::uuid)=encomenda_d,'replay real de entrega não cria nova encomenda');
  perform pg_temp.assert_true(
    d_encomendas=(select count(*) from public.encomendas)
    and d_itens=(select count(*) from public.itens_encomenda)
    and d_pagamentos=(select count(*) from public.pagamentos)
    and d_tentativas=(select count(*) from public.tentativas_pagamento)
    and d_idempotencias=(select count(*) from public.idempotencia_checkout_encomenda),
    'replay real de entrega preserva todas as contagens');
  select count(*) into f_encomendas from public.encomendas;
  select count(*) into f_itens from public.itens_encomenda;
  select count(*) into f_pagamentos from public.pagamentos;
  select count(*) into f_tentativas from public.tentativas_pagamento;
  select count(*) into f_idempotencias from public.idempotencia_checkout_encomenda;
  select estado,encomenda_id into f_estado,f_encomenda_id from public.conversas_pre_compra where id=conversa_l;
  perform pg_temp.expect_error(format($q$select public.criar_encomenda_levantamento_com_conversa('[{"produto_id":"%s","quantidade":1}]'::jsonb,'levantamento','C','923','',gen_random_uuid(),'%s'::uuid)$q$,produto,conversa_l),'falha real de revínculo');
  select count(*) into depois_encomendas from public.encomendas;
  select count(*) into depois_itens from public.itens_encomenda;
  select count(*) into depois_pagamentos from public.pagamentos;
  select count(*) into depois_tentativas from public.tentativas_pagamento;
  select count(*) into depois_idempotencias from public.idempotencia_checkout_encomenda;
  select estado,encomenda_id into depois_estado,depois_encomenda_id from public.conversas_pre_compra where id=conversa_l;
  perform pg_temp.assert_true(
    f_encomendas=depois_encomendas and f_itens=depois_itens and f_pagamentos=depois_pagamentos
    and f_tentativas=depois_tentativas and f_idempotencias=depois_idempotencias
    ,'falha real de revínculo preserva as cinco contagens');
  perform pg_temp.assert_true(
    f_estado='somente_leitura' and depois_estado=f_estado
    and f_encomenda_id=depois_encomenda_id and depois_encomenda_id=encomenda_l,
    'falha real de revínculo preserva a conversa original');
end $$;

-- Doubles transacionais: verificam que os novos wrappers preservam cada efeito
-- atómico da API antiga sem duplicar dependências do checkout já testadas noutro bloco.
create or replace function public.criar_encomenda_levantamento(
  p_itens jsonb,p_modalidade text,p_nome_destinatario text,p_telefone_destinatario text,p_observacoes_cliente text,p_idempotency_key uuid
) returns public.encomendas language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_encomenda public.encomendas%rowtype; v_id uuid; v_prod uuid := (p_itens->0->>'produto_id')::uuid; v_vendedor uuid;
begin
  select vendedor_id into v_vendedor from public.produtos where id=v_prod;
  select e.* into v_encomenda from public.encomendas e join public.idempotencia_checkout_encomenda i on i.encomenda_id=e.id where i.cliente_id=auth.uid() and i.modalidade_recebimento='levantamento' and i.chave_idempotencia=p_idempotency_key;
  if found then return v_encomenda; end if;
  v_id:=gen_random_uuid();
  insert into public.encomendas(id,codigo_publico,cliente_id,vendedor_id,modalidade_recebimento,subtotal_centimos,total_centimos,destinatario_nome,destinatario_telefone) values(v_id,'ANG-0001-'||upper(substr(md5(v_id::text),1,8)),auth.uid(),v_vendedor,'levantamento',10000,10000,'Teste','923000001') returning * into v_encomenda;
  insert into public.itens_encomenda(encomenda_id,produto_id,vendedor_id,quantidade,unidade,tipo_preco_snapshot,valor_unitario_centimos,subtotal_centimos,nome_produto_snapshot) values(v_id,v_prod,v_vendedor,1,'unidade','normal',10000,10000,'Teste');
  insert into public.idempotencia_checkout_encomenda(cliente_id,modalidade_recebimento,chave_idempotencia,payload_hash,encomenda_id,concluida_em) values(auth.uid(),'levantamento',p_idempotency_key,repeat('a',64),v_id,now());
  insert into public.pagamentos(encomenda_id,cliente_id,vendedor_id,moeda,referencia_interna,chave_idempotencia_criacao,subtotal_centimos,entrega_centimos,comissao_angrolink_centimos,valor_vendedor_centimos,valor_logistica_centimos,valor_total_centimos,total_cliente_centimos,comissao_bps_snapshot) values(v_id,auth.uid(),v_vendedor,'AOA','PL'||replace(v_id::text,'-',''),gen_random_uuid(),10000,0,0,10000,0,10000,10000,0);
  insert into public.tentativas_pagamento(pagamento_id,metodo,referencia_interna,chave_idempotencia) select id,'pagamento_no_levantamento','TL'||replace(v_id::text,'-',''),gen_random_uuid() from public.pagamentos where encomenda_id=v_id;
  return v_encomenda;
end $$;

create or replace function public.criar_encomenda_entrega(
  p_itens jsonb,p_destinatario_nome text,p_destinatario_telefone text,p_provincia text,p_municipio text,p_bairro text,p_endereco_detalhado text,p_ponto_referencia text,p_instrucoes_entrega text,p_observacoes text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_encomenda public.encomendas%rowtype; v_id uuid; v_prod uuid := (p_itens->0->>'produto_id')::uuid; v_vendedor uuid;
begin
  select vendedor_id into v_vendedor from public.produtos where id=v_prod;
  select e.* into v_encomenda from public.encomendas e join public.idempotencia_checkout_encomenda i on i.encomenda_id=e.id where i.cliente_id=auth.uid() and i.modalidade_recebimento='entrega' and i.chave_idempotencia=p_idempotency_key;
  if found then return jsonb_build_object('id',v_encomenda.id); end if;
  v_id:=gen_random_uuid();
  insert into public.encomendas(id,codigo_publico,cliente_id,vendedor_id,modalidade_recebimento,subtotal_centimos,total_centimos,destinatario_nome,destinatario_telefone,provincia,municipio,bairro,endereco_levantamento) values(v_id,'ANG-0001-'||upper(substr(md5(v_id::text),1,8)),auth.uid(),v_vendedor,'entrega',10000,10000,'Teste','923000001','Huambo','Huambo','Centro','Rua') returning * into v_encomenda;
  insert into public.itens_encomenda(encomenda_id,produto_id,vendedor_id,quantidade,unidade,tipo_preco_snapshot,valor_unitario_centimos,subtotal_centimos,nome_produto_snapshot) values(v_id,v_prod,v_vendedor,1,'unidade','normal',10000,10000,'Teste');
  insert into public.idempotencia_checkout_encomenda(cliente_id,modalidade_recebimento,chave_idempotencia,payload_hash,encomenda_id,concluida_em) values(auth.uid(),'entrega',p_idempotency_key,repeat('a',64),v_id,now());
  insert into public.pagamentos(encomenda_id,cliente_id,vendedor_id,moeda,referencia_interna,chave_idempotencia_criacao,subtotal_centimos,entrega_centimos,comissao_angrolink_centimos,valor_vendedor_centimos,valor_logistica_centimos,valor_total_centimos,total_cliente_centimos,comissao_bps_snapshot) values(v_id,auth.uid(),v_vendedor,'AOA','PD'||replace(v_id::text,'-',''),gen_random_uuid(),10000,0,0,10000,0,10000,10000,0);
  insert into public.tentativas_pagamento(pagamento_id,metodo,referencia_interna,chave_idempotencia) select id,'pagamento_na_entrega','TD'||replace(v_id::text,'-',''),gen_random_uuid() from public.pagamentos where encomenda_id=v_id;
  return jsonb_build_object('id',v_encomenda.id);
end $$;

do $$
declare
  comprador uuid := '11111111-1111-1111-1111-111111111111'; vendedor_comprador uuid := '33333333-3333-3333-3333-333333333333';
  produto uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc'; outro_produto uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  conversa_l uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1'; conversa_d uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2'; conversa_terceiro uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3'; conversa_divergente uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4'; conversa_sem_item uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5'; conversa_seller uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee6';
  k_old uuid := '10000000-0000-0000-0000-000000000001'; k_l uuid := '10000000-0000-0000-0000-000000000002'; k_d uuid := '10000000-0000-0000-0000-000000000003'; k_fail uuid := '10000000-0000-0000-0000-000000000004'; k_seller uuid := '10000000-0000-0000-0000-000000000005';
  e_l uuid; e_d uuid; before_count integer; after_count integer;
begin
  insert into public.conversas_pre_compra(id,solicitante_user_id,vendedor_id,produto_id) values
    (conversa_l,comprador,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',produto),
    (conversa_terceiro,'44444444-4444-4444-4444-444444444444','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',produto),
    (conversa_divergente,comprador,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',outro_produto),
    (conversa_sem_item,comprador,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',outro_produto);
  perform set_config('request.jwt.claim.sub',comprador::text,true);
  perform public.criar_encomenda_levantamento(jsonb_build_array(jsonb_build_object('produto_id',produto,'quantidade',1)),'levantamento','Teste','923','',k_old);
  perform pg_temp.assert_true((select conversa_pre_compra_id is null from public.idempotencia_checkout_encomenda where chave_idempotencia=k_old),'RPC antiga levantamento aceita ausência de conversa');
  perform public.criar_encomenda_entrega(jsonb_build_array(jsonb_build_object('produto_id',produto,'quantidade',1)),'Teste','923','Huambo','Huambo','Centro','Rua',null,null,null,gen_random_uuid());
  select id into e_l from public.criar_encomenda_levantamento_com_conversa(jsonb_build_array(jsonb_build_object('produto_id',produto,'quantidade',1)),'levantamento','Teste','923','',k_l,conversa_l);
  perform pg_temp.assert_true((select estado='somente_leitura' and encomenda_id=e_l from public.conversas_pre_compra where id=conversa_l),'levantamento vincula conversa');
  perform pg_temp.assert_true((select count(*)=1 from public.itens_encomenda where encomenda_id=e_l) and (select count(*)=1 from public.pagamentos where encomenda_id=e_l) and (select count(*)=1 from public.tentativas_pagamento t join public.pagamentos p on p.id=t.pagamento_id where p.encomenda_id=e_l),'levantamento mantém itens, pagamento e tentativa');
  perform pg_temp.assert_true((select id from public.criar_encomenda_levantamento_com_conversa(jsonb_build_array(jsonb_build_object('produto_id',produto,'quantidade',1)),'levantamento','Teste','923','',k_l,conversa_l))=e_l,'replay levantamento devolve a mesma encomenda');
  perform pg_temp.assert_true((select count(*)=1 from public.encomendas where id=e_l) and (select count(*)=1 from public.itens_encomenda where encomenda_id=e_l) and (select count(*)=1 from public.pagamentos where encomenda_id=e_l) and (select count(*)=1 from public.idempotencia_checkout_encomenda where chave_idempotencia=k_l),'replay levantamento não duplica efeitos');
  insert into public.conversas_pre_compra(id,solicitante_user_id,vendedor_id,produto_id)
  values (conversa_d,comprador,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',produto);
  select (public.criar_encomenda_entrega_com_conversa(jsonb_build_array(jsonb_build_object('produto_id',produto,'quantidade',1)),'Teste','923','Huambo','Huambo','Centro','Rua',null,null,null,k_d,conversa_d)->>'id')::uuid into e_d;
  perform pg_temp.assert_true((select estado='somente_leitura' and encomenda_id=e_d from public.conversas_pre_compra where id=conversa_d),'entrega vincula conversa');
  perform pg_temp.assert_true((select (public.criar_encomenda_entrega_com_conversa(jsonb_build_array(jsonb_build_object('produto_id',produto,'quantidade',1)),'Teste','923','Huambo','Huambo','Centro','Rua',null,null,null,k_d,conversa_d)->>'id')::uuid)=e_d,'replay entrega devolve a mesma encomenda');
  perform pg_temp.assert_true((select count(*)=1 from public.encomendas where id=e_d) and (select count(*)=1 from public.itens_encomenda where encomenda_id=e_d) and (select count(*)=1 from public.pagamentos where encomenda_id=e_d) and (select count(*)=1 from public.idempotencia_checkout_encomenda where chave_idempotencia=k_d),'replay entrega não duplica efeitos');
  perform pg_temp.expect_error(format($q$select public.criar_encomenda_levantamento_com_conversa('[{"produto_id":"%s","quantidade":1}]'::jsonb,'levantamento','T','923','', '%s'::uuid,'%s'::uuid)$q$,produto,k_l,conversa_sem_item),'mesma chave com conversa diferente é recusada');
  perform pg_temp.expect_error(format($q$select public.criar_encomenda_levantamento_com_conversa('[{"produto_id":"%s","quantidade":1}]'::jsonb,'levantamento','T','923','', '%s'::uuid,'%s'::uuid)$q$,produto,k_old,conversa_sem_item),'chave antiga sem conversa não muda');
  select count(*) into before_count from public.encomendas;
  perform pg_temp.expect_error(format($q$select public.criar_encomenda_levantamento_com_conversa('[{"produto_id":"%s","quantidade":1}]'::jsonb,'levantamento','T','923','', '%s'::uuid,'%s'::uuid)$q$,produto,k_fail,conversa_terceiro),'conversa de terceiro é recusada');
  select count(*) into after_count from public.encomendas;
  perform pg_temp.assert_true(before_count=after_count,'falha do vínculo faz rollback integral');
  select count(*) into before_count from public.encomendas;
  perform pg_temp.expect_error(format($q$select public.criar_encomenda_levantamento_com_conversa('[{"produto_id":"%s","quantidade":1}]'::jsonb,'levantamento','T','923','',gen_random_uuid(),'%s'::uuid)$q$,produto,conversa_l),'uma conversa não pode vincular uma segunda encomenda');
  select count(*) into after_count from public.encomendas;
  perform pg_temp.assert_true(before_count=after_count,'revinculação também faz rollback integral');
  perform pg_temp.expect_error(format($q$select public.criar_encomenda_levantamento_com_conversa('[{"produto_id":"%s","quantidade":1}]'::jsonb,'levantamento','T','923','',gen_random_uuid(),'%s'::uuid)$q$,produto,conversa_divergente),'vendedor divergente é recusado');
  perform pg_temp.expect_error(format($q$select public.criar_encomenda_levantamento_com_conversa('[{"produto_id":"%s","quantidade":1}]'::jsonb,'levantamento','T','923','',gen_random_uuid(),'%s'::uuid)$q$,produto,conversa_sem_item),'produto da conversa ausente é recusado');
  perform set_config('request.jwt.claim.sub',vendedor_comprador::text,true);
  insert into public.conversas_pre_compra(id,solicitante_user_id,vendedor_id,produto_id) values(conversa_seller,vendedor_comprador,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',produto);
  perform public.criar_encomenda_levantamento_com_conversa(jsonb_build_array(jsonb_build_object('produto_id',produto,'quantidade',1)),'levantamento','Vendedor','923','',k_seller,conversa_seller);
  perform pg_temp.assert_true(exists(select 1 from public.clientes where id=vendedor_comprador),'vendedor comprador é representado por clientes.id = auth.uid');
  perform pg_temp.assert_true(not has_function_privilege('anon','public.criar_encomenda_levantamento_com_conversa(jsonb,text,text,text,text,uuid,uuid)','execute') and has_function_privilege('authenticated','public.criar_encomenda_levantamento_com_conversa(jsonb,text,text,text,text,uuid,uuid)','execute') and not has_function_privilege('anon','public.criar_encomenda_entrega_com_conversa(jsonb,text,text,text,text,text,text,text,text,text,uuid,uuid)','execute') and has_function_privilege('authenticated','public.criar_encomenda_entrega_com_conversa(jsonb,text,text,text,text,text,text,text,text,text,uuid,uuid)','execute'),'grants novos são authenticated apenas');
  perform pg_temp.assert_true(not has_function_privilege('authenticated','public.vincular_conversa_pre_compra_encomenda(uuid,uuid)','execute') and not has_function_privilege('anon','public.vincular_conversa_pre_compra_encomenda(uuid,uuid)','execute'),'helper interno permanece sem execute browser');
  perform pg_temp.assert_true(exists(select 1 from pg_indexes where schemaname='public' and indexname='idempotencia_checkout_encomenda_conversa_unica_idx'),'índice parcial da conversa existe');
end $$;

select 'CHAT_CHECKOUT_FUNCTIONAL_PASS' as resultado, count(*) as assertions_pass
from pg_temp.chat_checkout_resultados;

rollback;
