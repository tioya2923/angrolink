\set ON_ERROR_STOP on
\pset pager off

-- EXECUTAR APENAS numa base Supabase LOCAL e descartável com a migration
-- 20260923010000 aplicada. Este cenário usa COMMITs reais para simular pedidos
-- HTTP distintos. O invocador deve sempre executar o ficheiro de limpeza no
-- finally, inclusive se psql terminar por erro.

create temporary table pg_temp.verificacoes_multitrans (
  nome text primary key,
  passou boolean not null
) on commit preserve rows;

create or replace function pg_temp.verificar_multitrans(p_nome text, p_passou boolean)
returns void language plpgsql as $$
begin
  insert into pg_temp.verificacoes_multitrans values (p_nome, coalesce(p_passou, false));
end;
$$;
grant execute on function pg_temp.verificar_multitrans(text, boolean) to authenticated;

do $$
begin
  if exists (select 1 from auth.users where id in (
    '70000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000003'))
    or exists (select 1 from public.vendedores where id = '71000000-0000-4000-8000-000000000001')
    or exists (select 1 from public.notificacoes where entidade_id = '71000000-0000-4000-8000-000000000001')
  then
    raise exception 'Fixtures multitrans já existem; execute a limpeza antes de repetir.';
  end if;
end;
$$;

begin;
insert into public.provincias_angola(id,codigo_oficial,numero_oficial,nome,ativo,ordem)
values ('72000000-0000-4000-8000-000000000001','HBO','999991','Huambo',true,999991)
on conflict (codigo_oficial) do nothing;
insert into public.municipios_angola(id,provincia_id,codigo_oficial,numero_oficial,nome,ativo)
select '72000000-0000-4000-8000-000000000002',p.id,'HBO-ALERTA-MULTITX','999993','Huambo',true
from public.provincias_angola p where p.codigo_oficial='HBO'
on conflict (codigo_oficial) do nothing;
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000',u.id,'authenticated','authenticated',u.email,'',now(),'{}','{}',now(),now()
from (values
  ('70000000-0000-4000-8000-000000000001'::uuid,'multitrans-admin-1@test'),
  ('70000000-0000-4000-8000-000000000002'::uuid,'multitrans-admin-2@test'),
  ('70000000-0000-4000-8000-000000000003'::uuid,'multitrans-vendor@test')
) u(id,email);
insert into public.administradores(user_id) values
  ('70000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000002');
insert into public.vendedores(id,user_id,nome_comercial,nome_responsavel,telefone_whatsapp,email,provincia,municipio,tipo_vendedor,status_aprovacao,conta_ativa)
values ('71000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000003',
  'Grossista multitrans','Responsável','900000703','multitrans-vendor@test','Huambo','Huambo','grossista','pendente',false);
commit;

-- Três pedidos independentes: BI, NIF e alvará.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000003',true);
insert into public.documentos_vendedor(vendedor_id,tipo_documento,frente_path,verso_path,estado)
values ('71000000-0000-4000-8000-000000000001','bi','70000000-0000-4000-8000-000000000003/multitrans/bi-f.jpg','70000000-0000-4000-8000-000000000003/multitrans/bi-v.jpg','pendente');
commit;
select pg_temp.verificar_multitrans('BI isolado sem alerta', (select count(*)=0 from public.notificacoes where entidade_id='71000000-0000-4000-8000-000000000001'));

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000003',true);
insert into public.documentos_vendedor(vendedor_id,tipo_documento,frente_path,verso_path,estado)
values ('71000000-0000-4000-8000-000000000001','nif','70000000-0000-4000-8000-000000000003/multitrans/nif-f.jpg','70000000-0000-4000-8000-000000000003/multitrans/nif-v.jpg','pendente');
commit;
select pg_temp.verificar_multitrans('BI e NIF sem alerta', (select count(*)=0 from public.notificacoes where entidade_id='71000000-0000-4000-8000-000000000001'));

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000003',true);
insert into public.documentos_vendedor(vendedor_id,tipo_documento,frente_path,verso_path,estado)
values ('71000000-0000-4000-8000-000000000001','alvara','70000000-0000-4000-8000-000000000003/multitrans/alvara-f.jpg','70000000-0000-4000-8000-000000000003/multitrans/alvara-v.jpg','pendente');
commit;
select pg_temp.verificar_multitrans('primeira revisão pronta, um alerta por Admin',
  (select count(*)=2 and count(distinct utilizador_id)=2 from public.notificacoes where entidade_id='71000000-0000-4000-8000-000000000001' and chave_idempotencia like '%:revisao:1:admin:%'));
select pg_temp.verificar_multitrans('revisão um fechada',
  (select count(*)=1 from public.candidaturas_vendedor_revisoes where vendedor_id='71000000-0000-4000-8000-000000000001' and numero=1 and pronta_em is not null));

-- Documento opcional numa nova transação não cria revisão nem alerta.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000003',true);
insert into public.documentos_vendedor(vendedor_id,tipo_documento,frente_path,verso_path,estado)
values ('71000000-0000-4000-8000-000000000001','cartao_vendedor','70000000-0000-4000-8000-000000000003/multitrans/opcional-f.jpg','70000000-0000-4000-8000-000000000003/multitrans/opcional-v.jpg','pendente');
commit;
select pg_temp.verificar_multitrans('documento opcional não abre nova revisão',
  (select count(*)=1 from public.candidaturas_vendedor_revisoes where vendedor_id='71000000-0000-4000-8000-000000000001'));
select pg_temp.verificar_multitrans('documento opcional não duplica alerta',
  (select count(*)=2 from public.notificacoes where entidade_id='71000000-0000-4000-8000-000000000001'));

-- Rejeição administrativa e reenvio posterior do documento rejeitado.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000001',true);
update public.documentos_vendedor set estado='rejeitado',motivo_rejeicao='NIF ilegível.'
where vendedor_id='71000000-0000-4000-8000-000000000001' and tipo_documento='nif';
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000003',true);
update public.documentos_vendedor set estado='pendente',
  frente_path='70000000-0000-4000-8000-000000000003/multitrans/nif-reenvio-f.jpg',
  verso_path='70000000-0000-4000-8000-000000000003/multitrans/nif-reenvio-v.jpg'
where vendedor_id='71000000-0000-4000-8000-000000000001' and tipo_documento='nif';
commit;
select pg_temp.verificar_multitrans('reenvio cria revisão dois',
  (select count(*)=1 from public.candidaturas_vendedor_revisoes where vendedor_id='71000000-0000-4000-8000-000000000001' and numero=2 and pronta_em is not null));
select pg_temp.verificar_multitrans('reenvio dá dois alertas por revisão',
  (select count(*)=4 and count(distinct utilizador_id)=2 from public.notificacoes where entidade_id='71000000-0000-4000-8000-000000000001'));

-- Um erro após o trigger deve reverter revisão e alertas juntos.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000001',true);
update public.documentos_vendedor set estado='rejeitado',motivo_rejeicao='Alvará ilegível.'
where vendedor_id='71000000-0000-4000-8000-000000000001' and tipo_documento='alvara';
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000003',true);
update public.documentos_vendedor set estado='pendente',
  frente_path='70000000-0000-4000-8000-000000000003/multitrans/alvara-rollback-f.jpg',
  verso_path='70000000-0000-4000-8000-000000000003/multitrans/alvara-rollback-v.jpg'
where vendedor_id='71000000-0000-4000-8000-000000000001' and tipo_documento='alvara';
rollback;
select pg_temp.verificar_multitrans('rollback não persiste revisão três',
  (select count(*)=0 from public.candidaturas_vendedor_revisoes where vendedor_id='71000000-0000-4000-8000-000000000001' and numero=3));
select pg_temp.verificar_multitrans('rollback não persiste alertas da revisão três',
  (select count(*)=0 from public.notificacoes where entidade_id='71000000-0000-4000-8000-000000000001' and chave_idempotencia like '%:revisao:3:admin:%'));
select pg_temp.verificar_multitrans('rollback preserva rejeição anterior',
  (select count(*)=1 from public.documentos_vendedor where vendedor_id='71000000-0000-4000-8000-000000000001' and tipo_documento='alvara' and estado='rejeitado'));

select nome, passou from pg_temp.verificacoes_multitrans order by nome;
select count(*) as SQL_MULTI_TX_ASSERTIONS, count(*) filter (where not passou) as SQL_MULTI_TX_FAILURES from pg_temp.verificacoes_multitrans;

do $$
begin
  if exists (select 1 from pg_temp.verificacoes_multitrans where not passou) then
    raise exception 'SQL_MULTI_TX_FAIL: uma ou mais verificações falharam';
  end if;
end;
$$;
select 'SQL_MULTI_TX_PASS' as resultado;
