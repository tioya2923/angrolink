\set ON_ERROR_STOP on

-- Executar exclusivamente numa base Supabase LOCAL descartável com as migrations
-- anteriores e 20261001010000 aplicadas. As fixtures sintéticas são removidas
-- pelo ROLLBACK final.
begin;

create temporary table pg_temp.resultados_alertas_entrega (
  teste text primary key
) on commit drop;

create or replace function pg_temp.assert_true(p_condicao boolean, p_teste text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condicao, false) then
    raise exception 'ASSERT FAIL: %', p_teste;
  end if;

  insert into pg_temp.resultados_alertas_entrega(teste) values (p_teste);
end;
$$;

grant select, insert on pg_temp.resultados_alertas_entrega to public;
grant execute on function pg_temp.assert_true(boolean, text) to public;

-- Dois administradores, participantes e uma conta externa. Não são dados reais.
insert into auth.users(instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'alerta-entrega-admin-1@test.local', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'alerta-entrega-admin-2@test.local', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'alerta-entrega-comprador@test.local', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'alerta-entrega-vendedor@test.local', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'alerta-entrega-terceiro@test.local', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'alerta-entrega-parceiro@test.local', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.administradores(user_id) values
  ('81000000-0000-4000-8000-000000000001'),
  ('81000000-0000-4000-8000-000000000002');

insert into public.profiles(id, nome, email, papel, ativo)
values ('81000000-0000-4000-8000-000000000004', 'Vendedor sintético', 'alerta-entrega-vendedor@test.local', 'vendedor', true)
on conflict (id) do update
set papel = excluded.papel,
    ativo = excluded.ativo,
    apagado_em = null;

-- O catálogo territorial pode estar vazio no dump schema-only local; a fixture
-- mantém a regra real de candidatura restrita ao Huambo sem dados operacionais.
insert into public.provincias_angola(id, codigo_oficial, numero_oficial, nome, ativo, ordem)
values ('86000000-0000-4000-8000-000000000001', 'HBO', '981001', 'Huambo', true, 981001)
on conflict (codigo_oficial) do update set ativo = excluded.ativo
returning id as provincia_id \gset territorio_

insert into public.municipios_angola(id, provincia_id, codigo_oficial, numero_oficial, nome, ativo)
values ('86000000-0000-4000-8000-000000000002', :'territorio_provincia_id'::uuid, 'HBO-ALERTA-ENTREGA', '981002', 'Huambo', true)
on conflict (codigo_oficial) do update set ativo = excluded.ativo;

insert into public.clientes(id, nome, telefone, email, provincia, municipio, conta_ativa)
values ('81000000-0000-4000-8000-000000000003', 'Comprador sintético', '923810003', 'alerta-entrega-comprador@test.local', 'Huambo', 'Huambo', true);

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
insert into public.vendedores(id, user_id, nome_comercial, nome_responsavel, telefone_whatsapp, email, provincia, municipio, tipo_vendedor, status_aprovacao, conta_ativa)
values ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000004', 'Vendedor sintético', 'Responsável sintético', '923810004', 'alerta-entrega-vendedor@test.local', 'Huambo', 'Huambo', 'revendedor', 'aprovado', true);

insert into public.parceiros_entrega(id, user_id, nome_completo, telefone, provincia, municipio, contacto_emergencia, estado, disponibilidade)
values ('85000000-0000-4000-8000-000000000010', '81000000-0000-4000-8000-000000000006', 'Parceiro sintético', '923810006', 'Huambo', 'Huambo', '923810007', 'rascunho', false);

insert into public.veiculos_entrega(id, parceiro_id, tipo_veiculo, marca, modelo, cor, matricula, capacidade_kg)
values ('85000000-0000-4000-8000-000000000011', '85000000-0000-4000-8000-000000000010', 'mota', 'Marca sintética', 'Modelo sintético', 'Verde', 'ALT-8100', 50);

-- Uma entrega pronta, um levantamento pronto, uma entrega para recusas
-- sequenciais reais e outra usada exclusivamente para injetar falha do produtor.
insert into public.encomendas(id, codigo_publico, cliente_id, vendedor_id, estado, modalidade_recebimento, subtotal_centimos, total_centimos, destinatario_nome, destinatario_telefone)
values
  ('83000000-0000-4000-8000-000000000001', 'ANG-2026-81000001', '81000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000001', 'pronta_para_levantamento', 'entrega', 1000, 1000, 'Destinatário sintético', '923810003'),
  ('83000000-0000-4000-8000-000000000002', 'ANG-2026-81000002', '81000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000001', 'pronta_para_levantamento', 'levantamento', 1000, 1000, 'Destinatário sintético', '923810003'),
  ('83000000-0000-4000-8000-000000000003', 'ANG-2026-81000003', '81000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000001', 'pronta_para_levantamento', 'entrega', 1000, 1000, 'Destinatário sintético', '923810003'),
  ('83000000-0000-4000-8000-000000000004', 'ANG-2026-81000004', '81000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000001', 'pronta_para_levantamento', 'entrega', 1000, 1000, 'Destinatário sintético', '923810003');

insert into public.eventos_encomenda(id, encomenda_id, tipo_evento, estado_anterior, estado_novo, ator_tipo, utilizador_id, metadados)
values
  ('84000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001', 'pronta_para_levantamento', 'em_preparacao', 'pronta_para_levantamento', 'vendedor', '81000000-0000-4000-8000-000000000004', '{}'::jsonb),
  ('84000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000002', 'pronta_para_levantamento', 'em_preparacao', 'pronta_para_levantamento', 'vendedor', '81000000-0000-4000-8000-000000000004', '{}'::jsonb);

insert into public.atribuicoes_entrega_encomenda(id, encomenda_id, parceiro_entrega_id, veiculo_id, atribuido_por)
values ('85000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000003', '85000000-0000-4000-8000-000000000010', '85000000-0000-4000-8000-000000000011', '81000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000006', true);
select public.recusar_atribuicao_entrega('85000000-0000-4000-8000-000000000001', 'Motivo sintético da primeira recusa.');
reset role;

insert into public.atribuicoes_entrega_encomenda(id, encomenda_id, parceiro_entrega_id, veiculo_id, atribuido_por)
values ('85000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000003', '85000000-0000-4000-8000-000000000010', '85000000-0000-4000-8000-000000000011', '81000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000006', true);
select public.recusar_atribuicao_entrega('85000000-0000-4000-8000-000000000002', 'Motivo sintético da segunda recusa.');
reset role;

select pg_temp.assert_true(
  (select count(*) from public.notificacoes where tipo = 'entrega_pronta_atribuicao' and entidade_id = '83000000-0000-4000-8000-000000000001') = 2,
  'entrega pronta cria uma linha privada para cada administrador'
);
select pg_temp.assert_true(
  (select count(*) from public.notificacoes where tipo = 'entrega_pronta_atribuicao' and entidade_id = '83000000-0000-4000-8000-000000000002') = 0,
  'levantamento pronto não cria alerta administrativo'
);
select pg_temp.assert_true(
  (select count(*) from public.notificacoes where tipo = 'entrega_reatribuicao_necessaria') = 4,
  'duas recusas reais e sequenciais de atribuições distintas criam um alerta por administrador e por evento'
);
select pg_temp.assert_true(
  (select bool_and(contexto = 'admin' and entidade_tipo = 'encomenda' and url_destino = '/dashboard/encomendas/' || entidade_id::text and metadata = '{}'::jsonb)
   from public.notificacoes
   where tipo in ('entrega_pronta_atribuicao', 'entrega_reatribuicao_necessaria')),
  'alertas administrativos usam contexto, destino e metadados seguros'
);

-- A repetição do mesmo produtor interno mantém a chave de idempotência por evento/Admin.
select public.notificar_administradores_operacao_entrega('84000000-0000-4000-8000-000000000001');
select pg_temp.assert_true(
  (select count(*) from public.notificacoes where tipo = 'entrega_pronta_atribuicao' and entidade_id = '83000000-0000-4000-8000-000000000001') = 2,
  'repetição do mesmo evento não duplica alertas'
);

insert into public.eventos_encomenda(id, encomenda_id, tipo_evento, estado_anterior, estado_novo, ator_tipo, utilizador_id, metadados)
values ('84000000-0000-4000-8000-000000000005', '83000000-0000-4000-8000-000000000001', 'entregador_aceitou', 'pronta_para_levantamento', 'pronta_para_levantamento', 'entregador', '81000000-0000-4000-8000-000000000005', '{}'::jsonb);
select pg_temp.assert_true(
  (select count(*) from public.notificacoes where contexto = 'admin' and entidade_id = '83000000-0000-4000-8000-000000000001') = 2,
  'transição operacional normal não cria alerta administrativo'
);
select pg_temp.assert_true(
  not exists (
    select 1 from public.notificacoes
    where contexto = 'admin'
      and utilizador_id in ('81000000-0000-4000-8000-000000000003', '81000000-0000-4000-8000-000000000004', '81000000-0000-4000-8000-000000000005')
  ),
  'participantes e terceiro não recebem alertas administrativos'
);

-- Falha sintética do produtor: o gatilho precisa manter o evento comercial e
-- impedir alertas parciais. O ROLLBACK final restaura a implementação real.
create or replace function public.notificar_administradores_operacao_entrega(p_evento_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception using errcode = 'P0001', message = 'falha sintética do produtor';
end;
$$;

insert into public.eventos_encomenda(id, encomenda_id, tipo_evento, estado_anterior, estado_novo, ator_tipo, utilizador_id, metadados)
values ('84000000-0000-4000-8000-000000000006', '83000000-0000-4000-8000-000000000004', 'pronta_para_levantamento', 'em_preparacao', 'pronta_para_levantamento', 'vendedor', '81000000-0000-4000-8000-000000000004', '{}'::jsonb);
select pg_temp.assert_true(
  exists (select 1 from public.eventos_encomenda where id = '84000000-0000-4000-8000-000000000006')
  and not exists (select 1 from public.notificacoes where contexto = 'admin' and entidade_id = '83000000-0000-4000-8000-000000000004'),
  'falha sintética preserva o evento comercial sem criar alerta administrativo parcial'
);

-- RLS continua privada inclusive entre administradores.
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select pg_temp.assert_true(
  (select count(*) from public.notificacoes where contexto = 'admin') = 3,
  'primeiro administrador lê apenas as próprias notificações administrativas'
);
reset role;

select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.notificar_administradores_operacao_entrega(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.notificar_administradores_operacao_entrega(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.criar_alerta_admin_operacao_entrega()', 'execute')
  and not has_function_privilege('authenticated', 'public.criar_alerta_admin_operacao_entrega()', 'execute'),
  'helpers internos não podem ser executados pelo browser'
);

select 'ALERTAS_ADMIN_OPERACOES_ENTREGA_PASS' as resultado, count(*) as sql_assertions
from pg_temp.resultados_alertas_entrega;

rollback;

do $$
begin
  if exists (
    select 1
    from auth.users
    where id between '81000000-0000-4000-8000-000000000001'::uuid and '81000000-0000-4000-8000-000000000006'::uuid
  ) or exists (select 1 from public.encomendas where id between '83000000-0000-4000-8000-000000000001'::uuid and '83000000-0000-4000-8000-000000000004'::uuid)
    or exists (select 1 from public.eventos_encomenda where id between '84000000-0000-4000-8000-000000000001'::uuid and '84000000-0000-4000-8000-000000000006'::uuid)
    or exists (select 1 from public.atribuicoes_entrega_encomenda where id in ('85000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000002'))
    or exists (select 1 from public.notificacoes where entidade_id between '83000000-0000-4000-8000-000000000001'::uuid and '83000000-0000-4000-8000-000000000004'::uuid) then
    raise exception 'ROLLBACK FAIL: fixtures persistiram';
  end if;
end;
$$;

select 'ALERTAS_ADMIN_OPERACOES_ENTREGA_ROLLBACK_OK' as resultado;
