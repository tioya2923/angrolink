\set ON_ERROR_STOP on
-- Executar somente numa base local descartável, antes da migration 20261020010000.
-- Representa uma candidatura empresarial criada antes de o email de contacto ser exigido.
begin;
insert into public.provincias_angola(id, codigo_oficial, numero_oficial, nome, ativo, ordem)
values ('61000000-0000-4000-8000-000000000001', 'HBO', '610001', 'Huambo', true, 610001)
on conflict (codigo_oficial) do update set ativo = excluded.ativo
returning id as provincia_id \gset email_politica_

insert into public.municipios_angola(id, provincia_id, codigo_oficial, numero_oficial, nome, ativo)
values ('61000000-0000-4000-8000-000000000002', :'email_politica_provincia_id'::uuid, 'HBO-EMAIL-POLITICA', '610002', 'Municipio Email Politica', true)
on conflict (codigo_oficial) do update set ativo = excluded.ativo;

insert into auth.users(instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','61000000-0000-4000-8000-000000000021','authenticated','authenticated','email-policy-historic@test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','61000000-0000-4000-8000-000000000023','authenticated','authenticated','email-policy-historic-admin@test','',now(),'{}','{}',now(),now());

-- Fixture histórica controlada: existe antes de a regra nova entrar em vigor.
-- Não simula uma chamada browser e não introduz qualquer bypass na migration.
insert into public.vendedores(id,user_id,nome_comercial,nome_responsavel,telefone_whatsapp,provincia,municipio,tipo_vendedor,status_aprovacao,descricao)
values ('61000000-0000-4000-8000-000000000110','61000000-0000-4000-8000-000000000021','Grossista histórico','Responsável','923610110','Huambo','Municipio Email Politica','grossista','pendente','antes');

insert into public.documentos_vendedor(vendedor_id,tipo_documento,frente_path,verso_path,estado)
values ('61000000-0000-4000-8000-000000000110','bi','61000000-0000-4000-8000-000000000021/email-policy/historic-bi-antigo-f.jpg','61000000-0000-4000-8000-000000000021/email-policy/historic-bi-antigo-v.jpg','pendente');

insert into public.administradores(user_id) values ('61000000-0000-4000-8000-000000000023');
set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000023', true);
update public.documentos_vendedor
set estado='rejeitado', motivo_rejeicao='Documento anterior rejeitado.'
where vendedor_id='61000000-0000-4000-8000-000000000110' and tipo_documento='bi';
reset role;
delete from public.administradores where user_id='61000000-0000-4000-8000-000000000023';
commit;
