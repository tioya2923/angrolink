\set ON_ERROR_STOP on
begin;

create temporary table pg_temp.resultados_email_contacto(teste text primary key) on commit drop;
create or replace function pg_temp.assert_true(valor boolean, descricao text)
returns void language plpgsql as $$
begin
  if not coalesce(valor, false) then
    raise exception 'ASSERT FAIL: %', descricao;
  end if;
  insert into pg_temp.resultados_email_contacto values (descricao);
end;
$$;

create or replace function pg_temp.expect_error(comando text, trecho_esperado text, descricao text)
returns void language plpgsql as $$
begin
  begin
    execute comando;
    raise exception 'ASSERT FAIL: % (a operação deveria falhar)', descricao;
  exception when others then
    if position(trecho_esperado in sqlerrm) = 0 then
      raise exception 'ASSERT FAIL: % (erro inesperado: %)', descricao, sqlerrm;
    end if;
  end;
  insert into pg_temp.resultados_email_contacto values (descricao);
end;
$$;
grant execute on function pg_temp.assert_true(boolean, text), pg_temp.expect_error(text, text, text) to authenticated;
grant select, insert on pg_temp.resultados_email_contacto to authenticated;

-- Fixtures sintéticas e isoladas. A suite deve correr apenas numa base local descartável.
insert into public.provincias_angola(id, codigo_oficial, numero_oficial, nome, ativo, ordem)
values ('61000000-0000-4000-8000-000000000001', 'HBO', '610001', 'Huambo', true, 610001)
on conflict (codigo_oficial) do update set ativo = excluded.ativo
returning id as provincia_id \gset email_politica_

insert into public.municipios_angola(id, provincia_id, codigo_oficial, numero_oficial, nome, ativo)
values ('61000000-0000-4000-8000-000000000002', :'email_politica_provincia_id'::uuid, 'HBO-EMAIL-POLITICA', '610002', 'Municipio Email Politica', true)
on conflict (codigo_oficial) do update set ativo = excluded.ativo;

insert into auth.users(instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','61000000-0000-4000-8000-000000000010','authenticated','authenticated','email-policy-admin-1@test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','61000000-0000-4000-8000-000000000011','authenticated','authenticated','email-policy-admin-2@test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','61000000-0000-4000-8000-000000000012','authenticated','authenticated','email-policy-admin-vendor@test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','61000000-0000-4000-8000-000000000020','authenticated','authenticated','email-policy-seller@test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','61000000-0000-4000-8000-000000000024','authenticated','authenticated','email-policy-required-1@test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','61000000-0000-4000-8000-000000000025','authenticated','authenticated','email-policy-required-2@test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','61000000-0000-4000-8000-000000000026','authenticated','authenticated','email-policy-required-3@test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','61000000-0000-4000-8000-000000000027','authenticated','authenticated','email-policy-optional@test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','61000000-0000-4000-8000-000000000022','authenticated','authenticated','email-policy-valid@test','',now(),'{}','{}',now(),now());

insert into public.administradores(user_id) values
  ('61000000-0000-4000-8000-000000000010'),
  ('61000000-0000-4000-8000-000000000011'),
  ('61000000-0000-4000-8000-000000000012');

-- Fixtures de ownership para UPDATE direto; não representam o INSERT browser.
insert into public.vendedores(id,user_id,nome_comercial,nome_responsavel,telefone_whatsapp,provincia,municipio,tipo_vendedor,status_aprovacao)
values
  ('61000000-0000-4000-8000-000000000101','61000000-0000-4000-8000-000000000020','Ambulante para update','Responsável','923610101','Huambo','Municipio Email Politica','ambulante','pendente'),
  ('61000000-0000-4000-8000-000000000112','61000000-0000-4000-8000-000000000012','Admin ambulante','Responsável','923610112','Huambo','Municipio Email Politica','ambulante','pendente');

-- INSERT direto authenticated: o ID é gerado pelo servidor e não é projetado ao browser pendente.
set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000027', true);
insert into public.vendedores(user_id,nome_comercial,nome_responsavel,telefone_whatsapp,provincia,municipio,tipo_vendedor)
values ('61000000-0000-4000-8000-000000000027','Ambulante email','Responsável','923610127','Huambo','Municipio Email Politica','ambulante');
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000020', true);
update public.vendedores set tipo_vendedor='quitandeira' where id='61000000-0000-4000-8000-000000000101';
update public.vendedores set tipo_vendedor='produtor' where id='61000000-0000-4000-8000-000000000101';
update public.vendedores set tipo_vendedor='mini_mercado' where id='61000000-0000-4000-8000-000000000101';
update public.vendedores set tipo_vendedor='revendedor' where id='61000000-0000-4000-8000-000000000101';
update public.vendedores set tipo_vendedor='prestador_servico' where id='61000000-0000-4000-8000-000000000101';
reset role;
select pg_temp.assert_true((select count(*) from public.vendedores where user_id='61000000-0000-4000-8000-000000000027' and tipo_vendedor='ambulante' and email is null) = 1, 'INSERT authenticated preserva tipo opcional com email vazio');
select pg_temp.assert_true((select tipo_vendedor='prestador_servico' and email is null from public.vendedores where id='61000000-0000-4000-8000-000000000101'), 'UPDATE authenticated preserva tipos opcionais e prestador com email vazio');

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000024', true);
select pg_temp.expect_error($sql$
  insert into public.vendedores(user_id,nome_comercial,nome_responsavel,telefone_whatsapp,provincia,municipio,tipo_vendedor)
  values ('61000000-0000-4000-8000-000000000024','Super sem email','Responsável','923610107','Huambo','Municipio Email Politica','supermercado')
$sql$, 'exige um email de contacto válido', 'supermercado sem email é recusado em INSERT authenticated');
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000025', true);
select pg_temp.expect_error($sql$
  insert into public.vendedores(user_id,nome_comercial,nome_responsavel,telefone_whatsapp,email,provincia,municipio,tipo_vendedor)
  values ('61000000-0000-4000-8000-000000000025','Hiper sintético','Responsável','923610108','244923610108@TELEFONE.ANGROLINK','Huambo','Municipio Email Politica','hipermercado')
$sql$, 'endereço interno de telefone', 'email sintético é recusado independentemente de capitalização');
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000026', true);
select pg_temp.expect_error($sql$
  insert into public.vendedores(user_id,nome_comercial,nome_responsavel,telefone_whatsapp,email,provincia,municipio,tipo_vendedor)
  values ('61000000-0000-4000-8000-000000000026','Grosso inválido','Responsável','923610109','invalido','Huambo','Municipio Email Politica','grossista')
$sql$, 'email de contacto válido', 'formato inválido é recusado em INSERT authenticated');
reset role;

-- A mesma proteção vale para uma sessão authenticated que também é Admin.
set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000012', true);
select pg_temp.expect_error(
  $sql$update public.vendedores set tipo_vendedor='grossista' where id='61000000-0000-4000-8000-000000000112'$sql$,
  'exige um email de contacto válido',
  'Admin authenticated não contorna a regra por UPDATE direto'
);
reset role;

-- A fixture histórica foi criada pelo script de preparação antes da migration.
select pg_temp.assert_true((select count(*) from public.vendedores where id='61000000-0000-4000-8000-000000000110' and email is null and tipo_vendedor='grossista') = 1, 'fixture histórica sem email existe antes da regra');
set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000021', true);
update public.vendedores set descricao='edição comum preservada' where id='61000000-0000-4000-8000-000000000110';
reset role;
select pg_temp.assert_true((select descricao='edição comum preservada' from public.vendedores where id='61000000-0000-4000-8000-000000000110'), 'conta empresarial histórica sem email edita campo comum');
set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000021', true);
select pg_temp.expect_error($sql$
  update public.vendedores set email = null where id='61000000-0000-4000-8000-000000000110'
$sql$, 'exige um email de contacto válido', 'remoção explícita do email empresarial é recusada');
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000020', true);
select pg_temp.expect_error(
  $sql$update public.vendedores set tipo_vendedor='supermercado' where id='61000000-0000-4000-8000-000000000101'$sql$,
  'exige um email de contacto válido',
  'mudança direta para tipo obrigatório é recusada'
);
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000021', true);
select pg_temp.expect_error($sql$
  insert into public.documentos_vendedor(vendedor_id,tipo_documento,frente_path,verso_path,estado)
  values ('61000000-0000-4000-8000-000000000110','bi','61000000-0000-4000-8000-000000000021/email-policy/historic-bi-f.jpg','61000000-0000-4000-8000-000000000021/email-policy/historic-bi-v.jpg','pendente')
$sql$, 'antes de enviar documentos para análise', 'submissão documental empresarial histórica sem email é recusada');
select pg_temp.expect_error($sql$
  update public.documentos_vendedor
     set estado='pendente', frente_path='61000000-0000-4000-8000-000000000021/email-policy/historic-bi-reenvio-f.jpg', verso_path='61000000-0000-4000-8000-000000000021/email-policy/historic-bi-reenvio-v.jpg'
   where vendedor_id='61000000-0000-4000-8000-000000000110' and tipo_documento='bi'
$sql$, 'antes de enviar documentos para análise', 'reenvio documental empresarial sem email é recusado');
reset role;

-- Uma candidatura válida autenticada mantém o trigger de revisão/alertas: três documentos,
-- uma revisão e uma notificação privada para cada administrador responsável.
set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000022', true);
insert into public.vendedores(user_id,nome_comercial,nome_responsavel,telefone_whatsapp,email,email_login,provincia,municipio,tipo_vendedor)
values ('61000000-0000-4000-8000-000000000022','Grossista válido','Responsável','923610111',' CONTACTO@EMPRESA.AO ','244923610111@telefone.angrolink','Huambo','Municipio Email Politica','grossista');
reset role;
select id as vendedor_valido_id
from public.vendedores
where user_id='61000000-0000-4000-8000-000000000022'
  and nome_comercial='Grossista válido'
\gset email_politica_
select pg_temp.assert_true((select email='contacto@empresa.ao' and email_login='244923610111@telefone.angrolink' from public.vendedores where id=:'email_politica_vendedor_valido_id'::uuid), 'email de contacto é normalizado sem alterar email_login');
set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000022', true);
insert into public.documentos_vendedor(vendedor_id,tipo_documento,frente_path,verso_path,estado) values
  (:'email_politica_vendedor_valido_id'::uuid,'bi','61000000-0000-4000-8000-000000000022/email-policy/valid-bi-f.jpg','61000000-0000-4000-8000-000000000022/email-policy/valid-bi-v.jpg','pendente'),
  (:'email_politica_vendedor_valido_id'::uuid,'nif','61000000-0000-4000-8000-000000000022/email-policy/valid-nif-f.jpg','61000000-0000-4000-8000-000000000022/email-policy/valid-nif-v.jpg','pendente'),
  (:'email_politica_vendedor_valido_id'::uuid,'alvara','61000000-0000-4000-8000-000000000022/email-policy/valid-alvara-f.jpg','61000000-0000-4000-8000-000000000022/email-policy/valid-alvara-v.jpg','pendente');
reset role;
select pg_temp.assert_true((select count(*) from public.candidaturas_vendedor_revisoes where vendedor_id=:'email_politica_vendedor_valido_id'::uuid) = 1, 'submissão válida preserva uma revisão de candidatura');
select pg_temp.assert_true((select count(*) from public.notificacoes where tipo='candidatura_vendedor_pronta' and entidade_id=:'email_politica_vendedor_valido_id'::uuid) = 3, 'submissão válida preserva um alerta privado por administrador');

-- A aprovação é uma última barreira. A RPC valida o contacto antes de
-- qualquer verificação documental, por isso não alteramos artificialmente
-- o estado de um documento rejeitado fora do fluxo de reenvio.
set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000010', true);
select pg_temp.expect_error($sql$
  select public.atualizar_estado_vendedor_admin('61000000-0000-4000-8000-000000000110', 'aprovado', null)
$sql$, 'sem um email de contacto válido', 'admin não aprova candidatura empresarial histórica sem contacto');
reset role;

select count(*) as sql_assertions from pg_temp.resultados_email_contacto;
rollback;
\echo ROLLBACK_CONFIRMED
