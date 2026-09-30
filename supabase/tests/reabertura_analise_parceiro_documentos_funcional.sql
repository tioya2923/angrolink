\set ON_ERROR_STOP on

-- Executar apenas numa base Supabase local descartavel. Todas as fixtures
-- sinteticas sao removidas pelo ROLLBACK final.
begin;

create temporary table pg_temp.resultados_reabertura(teste text primary key) on commit drop;
grant select, insert on pg_temp.resultados_reabertura to public;

create or replace function pg_temp.assert_true(p_condicao boolean, p_teste text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condicao, false) then
    raise exception 'ASSERT FAIL: %', p_teste;
  end if;

  insert into pg_temp.resultados_reabertura(teste) values (p_teste);
end;
$$;
grant execute on function pg_temp.assert_true(boolean, text) to public;

create or replace function pg_temp.expect_error(p_sql text, p_fragmento text, p_teste text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
    raise exception 'ASSERT FAIL: % nao recusou a operacao', p_teste;
  exception when others then
    if position(lower(p_fragmento) in lower(sqlerrm)) = 0 then
      raise exception 'ASSERT FAIL: % devolveu erro inesperado: %', p_teste, sqlerrm;
    end if;
  end;

  insert into pg_temp.resultados_reabertura(teste) values (p_teste);
end;
$$;
grant execute on function pg_temp.expect_error(text, text, text) to public;

-- A RPC atomica valida o territorio. Estas fixtures nao dependem de dados
-- operacionais importados pelo schema-only.
insert into public.provincias_angola(id, codigo_oficial, numero_oficial, nome, ativo, ordem)
values ('62800000-0000-4000-8000-000000000001', 'HBO-REABERTURA', '628001', 'Huambo', true, 628001)
on conflict (codigo_oficial) do update set ativo = excluded.ativo
returning id as provincia_id \gset reabertura_

insert into public.municipios_angola(id, provincia_id, codigo_oficial, numero_oficial, nome, ativo)
values ('62800000-0000-4000-8000-000000000002', :'reabertura_provincia_id'::uuid, 'HBO-REABERTURA-MUN', '628002', 'Huambo', true)
on conflict (codigo_oficial) do update set ativo = excluded.ativo;

insert into auth.users(
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '62800000-0000-4000-8000-000000000010', 'authenticated', 'authenticated', 'reabertura-admin@test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '62800000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'reabertura-partner@test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.administradores(user_id)
values ('62800000-0000-4000-8000-000000000010');

select pg_temp.assert_true(
  (select relrowsecurity from pg_class where oid = 'public.parceiros_entrega'::regclass),
  'RLS permanece ativa para parceiros de entrega'
);
select pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.reenviar_documento_parceiro(uuid,text,text,text,date)', 'execute')
  and not has_function_privilege('anon', 'public.reenviar_documento_parceiro(uuid,text,text,text,date)', 'execute')
  and not has_function_privilege('public', 'public.reenviar_documento_parceiro(uuid,text,text,text,date)', 'execute'),
  'reenviar documento conserva grants minimos'
);

-- A criacao usa a mesma RPC publica da candidatura. O parceiro entra em
-- analise com todos os documentos exigidos, sem depender de contas reais.
set local role authenticated;
select set_config('request.jwt.claim.sub', '62800000-0000-4000-8000-000000000011', true);
select public.criar_pedido_parceiro_entrega(
  jsonb_build_object(
    'nome_completo', 'Parceiro reabertura',
    'telefone', '923628011',
    'provincia', 'Huambo',
    'municipio', 'Huambo',
    'contacto_emergencia', '923628012'
  ),
  jsonb_build_object(
    'tipo_veiculo', 'mota', 'marca', 'Teste', 'modelo', 'Reabertura',
    'cor', 'Verde', 'matricula', 'RBR-6280', 'capacidade_kg', 50
  ),
  jsonb_build_array(
    jsonb_build_object('tipo_documento', 'bi', 'frente_path', 'reabertura/bi-f.jpg', 'verso_path', 'reabertura/bi-v.jpg'),
    jsonb_build_object('tipo_documento', 'carta_conducao', 'frente_path', 'reabertura/carta-f.jpg', 'verso_path', 'reabertura/carta-v.jpg'),
    jsonb_build_object('tipo_documento', 'livrete_veiculo', 'frente_path', 'reabertura/livrete-f.jpg', 'verso_path', 'reabertura/livrete-v.jpg'),
    jsonb_build_object('tipo_documento', 'seguro_automovel', 'frente_path', 'reabertura/seguro-f.jpg', 'verso_path', 'reabertura/seguro-v.jpg')
  ),
  jsonb_build_object('provincia', 'Huambo', 'municipio', 'Huambo')
) as parceiro_id \gset reabertura_
reset role;

select pg_temp.assert_true(
  (select estado = 'em_analise' and not disponibilidade from public.parceiros_entrega where id = :'reabertura_parceiro_id'::uuid),
  'candidatura inicial permanece em analise'
);

-- O parceiro ja aprovado e posteriormente suspenso representa o caso real.
set local role authenticated;
select set_config('request.jwt.claim.sub', '62800000-0000-4000-8000-000000000010', true);
update public.documentos_parceiro_entrega
   set estado = 'aprovado', motivo_rejeicao = null, analisado_por = auth.uid(), analisado_em = now()
 where parceiro_id = :'reabertura_parceiro_id'::uuid;
select public.aprovar_parceiro_entrega_admin(:'reabertura_parceiro_id'::uuid);
reset role;

select pg_temp.assert_true(
  (select estado = 'aprovado' from public.parceiros_entrega where id = :'reabertura_parceiro_id'::uuid),
  'parceiro so fica aprovado depois de todos os documentos aprovados'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '62800000-0000-4000-8000-000000000010', true);
update public.documentos_parceiro_entrega
   set estado = 'rejeitado', motivo_rejeicao = 'Imagem insuficiente para analise.', analisado_por = auth.uid(), analisado_em = now()
 where parceiro_id = :'reabertura_parceiro_id'::uuid
   and tipo_documento in ('bi', 'carta_conducao');
update public.parceiros_entrega
   set estado = 'suspenso', disponibilidade = false, motivo_suspensao = 'Suspensao administrativa.'
 where id = :'reabertura_parceiro_id'::uuid;
reset role;

select pg_temp.assert_true(
  (select estado = 'suspenso' and motivo_suspensao is not null from public.parceiros_entrega where id = :'reabertura_parceiro_id'::uuid),
  'suspensao conserva o motivo administrativo separado'
);
select pg_temp.assert_true(
  (select count(*) = 2 from public.documentos_parceiro_entrega where parceiro_id = :'reabertura_parceiro_id'::uuid and tipo_documento in ('bi', 'carta_conducao') and estado = 'rejeitado' and motivo_rejeicao is not null),
  'duas rejeicoes documentais conservam os motivos privados nos documentos'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '62800000-0000-4000-8000-000000000011', true);
select pg_temp.expect_error(
  format(
    'select public.reenviar_documento_parceiro(%L::uuid, %L, %L, null, null)',
    (select id::text from public.documentos_parceiro_entrega where parceiro_id = :'reabertura_parceiro_id'::uuid and tipo_documento = 'bi'),
    'reabertura/bi-f-reenvio.jpg',
    'reabertura/bi-v-reenvio.jpg'
  ),
  'reaberta',
  'reenvio e recusado antes da reabertura administrativa'
);
reset role;

-- A acao Admin existente continua a pedir em_analise, mas o trigger converte
-- para documentos_pendentes enquanto a rejeicao documental existir.
set local role authenticated;
select set_config('request.jwt.claim.sub', '62800000-0000-4000-8000-000000000010', true);
update public.parceiros_entrega
   set estado = 'em_analise', disponibilidade = false
 where id = :'reabertura_parceiro_id'::uuid;
reset role;

select pg_temp.assert_true(
  (select estado = 'documentos_pendentes' and not disponibilidade and motivo_suspensao is null and motivo_rejeicao is null from public.parceiros_entrega where id = :'reabertura_parceiro_id'::uuid),
  'reabertura com documento rejeitado entra em documentos pendentes e limpa motivos administrativos'
);
select pg_temp.assert_true(
  (select motivo_rejeicao = 'Imagem insuficiente para analise.' from public.documentos_parceiro_entrega where parceiro_id = :'reabertura_parceiro_id'::uuid and tipo_documento = 'bi'),
  'reabertura nao apaga o motivo documental'
);
select pg_temp.assert_true(
  not coalesce(public.entregador_pode_receber_entregas(:'reabertura_parceiro_id'::uuid), false),
  'tarefas e acoes operacionais ficam bloqueadas fora do estado aprovado'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '62800000-0000-4000-8000-000000000011', true);
select set_config('angrolink.submeter_parceiro', 'true', true);
select pg_temp.expect_error(
  format('update public.parceiros_entrega set estado = %L where id = %L::uuid', 'em_analise', :'reabertura_parceiro_id'),
  'administrativo',
  'RLS e trigger recusam tentativa direta mesmo com a GUC de submissao'
);
select set_config('angrolink.reenviar_documento', 'true', true);
select pg_temp.expect_error(
  format('update public.documentos_parceiro_entrega set estado = %L where id = %L::uuid', 'pendente', (select id::text from public.documentos_parceiro_entrega where parceiro_id = :'reabertura_parceiro_id'::uuid and tipo_documento = 'carta_conducao')),
  'administrador',
  'RLS e trigger recusam reenvio documental direto mesmo com a GUC interna'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '62800000-0000-4000-8000-000000000010', true);
select pg_temp.expect_error(
  format('select public.aprovar_parceiro_entrega_admin(%L::uuid)', :'reabertura_parceiro_id'),
  'Analise e aprove todos os documentos',
  'aprovacao e impedida enquanto existe documento rejeitado'
);
reset role;

-- O reenvio autorizado cria nova versao pendente, volta somente a analise e
-- nunca aprova o parceiro de forma automatica.
set local role authenticated;
select set_config('request.jwt.claim.sub', '62800000-0000-4000-8000-000000000011', true);
select public.reenviar_documento_parceiro(
  (select id from public.documentos_parceiro_entrega where parceiro_id = :'reabertura_parceiro_id'::uuid and tipo_documento = 'bi'),
  'reabertura/bi-f-reenvio.jpg',
  'reabertura/bi-v-reenvio.jpg',
  null,
  null
);
reset role;

select pg_temp.assert_true(
  (select estado = 'pendente' and motivo_rejeicao is null from public.documentos_parceiro_entrega where parceiro_id = :'reabertura_parceiro_id'::uuid and tipo_documento = 'bi'),
  'primeiro reenvio autorizado deixa o documento pendente para nova analise'
);
select pg_temp.assert_true(
  (select estado = 'rejeitado' from public.documentos_parceiro_entrega where parceiro_id = :'reabertura_parceiro_id'::uuid and tipo_documento = 'carta_conducao')
  and (select estado = 'documentos_pendentes' and not disponibilidade from public.parceiros_entrega where id = :'reabertura_parceiro_id'::uuid),
  'primeiro reenvio mantem a segunda pendencia corrigivel e a candidatura restrita'
);
select pg_temp.assert_true(
  not coalesce(public.entregador_pode_receber_entregas(:'reabertura_parceiro_id'::uuid), false),
  'reenvio nao libera operacoes nem aprova automaticamente'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '62800000-0000-4000-8000-000000000011', true);
select public.reenviar_documento_parceiro(
  (select id from public.documentos_parceiro_entrega where parceiro_id = :'reabertura_parceiro_id'::uuid and tipo_documento = 'carta_conducao'),
  'reabertura/carta-f-reenvio.jpg',
  'reabertura/carta-v-reenvio.jpg',
  null,
  null
);
reset role;

select pg_temp.assert_true(
  (select count(*) = 2 from public.documentos_parceiro_entrega where parceiro_id = :'reabertura_parceiro_id'::uuid and tipo_documento in ('bi', 'carta_conducao') and estado = 'pendente')
  and (select estado = 'em_analise' and not disponibilidade from public.parceiros_entrega where id = :'reabertura_parceiro_id'::uuid),
  'ultimo reenvio resolve as pendencias e devolve somente a analise'
);

-- Depois da analise documental aprovar todos os documentos, a RPC existente
-- pode aprovar o parceiro. Sem rejeicao documental, reabrir uma suspensao
-- conserva a transicao normal para em_analise.
set local role authenticated;
select set_config('request.jwt.claim.sub', '62800000-0000-4000-8000-000000000010', true);
update public.documentos_parceiro_entrega
   set estado = 'aprovado', motivo_rejeicao = null, analisado_por = auth.uid(), analisado_em = now()
 where parceiro_id = :'reabertura_parceiro_id'::uuid;
select public.aprovar_parceiro_entrega_admin(:'reabertura_parceiro_id'::uuid);
reset role;

select pg_temp.assert_true(
  (select estado = 'aprovado' from public.parceiros_entrega where id = :'reabertura_parceiro_id'::uuid),
  'aprovacao so ocorre apos a analise documental aprovada'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '62800000-0000-4000-8000-000000000010', true);
update public.parceiros_entrega
   set estado = 'suspenso', disponibilidade = false, motivo_suspensao = 'Nova suspensao administrativa.'
 where id = :'reabertura_parceiro_id'::uuid;
update public.parceiros_entrega
   set estado = 'em_analise', disponibilidade = false
 where id = :'reabertura_parceiro_id'::uuid;
reset role;

select pg_temp.assert_true(
  (select estado = 'em_analise' and motivo_suspensao is null from public.parceiros_entrega where id = :'reabertura_parceiro_id'::uuid),
  'reabertura sem pendencia documental conserva a transicao normal para analise'
);
select pg_temp.assert_true(
  not coalesce(public.entregador_pode_receber_entregas(:'reabertura_parceiro_id'::uuid), false),
  'acoes operacionais continuam bloqueadas ate nova aprovacao'
);

-- Documento expirado usa o estado documental proprio, continua corrigivel e
-- exige uma nova validade; tambem nao aprova o parceiro automaticamente.
set local role authenticated;
select set_config('request.jwt.claim.sub', '62800000-0000-4000-8000-000000000010', true);
update public.documentos_parceiro_entrega
   set estado = 'expirado',
       validade = current_date - 1,
       motivo_rejeicao = 'Documento expirado.',
       analisado_por = auth.uid(),
       analisado_em = now()
 where parceiro_id = :'reabertura_parceiro_id'::uuid
   and tipo_documento = 'seguro_automovel';
update public.parceiros_entrega
   set estado = 'suspenso', disponibilidade = false, motivo_suspensao = 'Suspensao por documento expirado.'
 where id = :'reabertura_parceiro_id'::uuid;
update public.parceiros_entrega
   set estado = 'em_analise', disponibilidade = false
 where id = :'reabertura_parceiro_id'::uuid;
reset role;

select pg_temp.assert_true(
  (select estado = 'documentacao_expirada' from public.parceiros_entrega where id = :'reabertura_parceiro_id'::uuid),
  'reabertura com documento expirado conserva o estado documental de renovacao'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '62800000-0000-4000-8000-000000000011', true);
select public.reenviar_documento_parceiro(
  (select id from public.documentos_parceiro_entrega where parceiro_id = :'reabertura_parceiro_id'::uuid and tipo_documento = 'seguro_automovel'),
  'reabertura/seguro-f-renovado.jpg',
  'reabertura/seguro-v-renovado.jpg',
  null,
  current_date + 30
);
reset role;

select pg_temp.assert_true(
  (select estado = 'pendente' and validade = current_date + 30 from public.documentos_parceiro_entrega where parceiro_id = :'reabertura_parceiro_id'::uuid and tipo_documento = 'seguro_automovel')
  and (select estado = 'em_analise' from public.parceiros_entrega where id = :'reabertura_parceiro_id'::uuid)
  and not coalesce(public.entregador_pode_receber_entregas(:'reabertura_parceiro_id'::uuid), false),
  'renovacao expirada volta somente a analise e mantem operacoes bloqueadas'
);

select 'REABERTURA_PARCEIRO_DOCUMENTOS_FUNCTIONAL_PASS' as resultado,
       count(*) as assertions_pass
  from pg_temp.resultados_reabertura;

rollback;
