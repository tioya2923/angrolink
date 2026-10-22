\set ON_ERROR_STOP on

-- Executar apenas numa base Supabase local descartável com a migration
-- 20261021010000 já aplicada. Todas as fixtures sintéticas são revertidas.
begin;

create temporary table pg_temp.resultados_leitura_propria(teste text primary key) on commit drop;

create or replace function pg_temp.assert_true(valor boolean, descricao text)
returns void language plpgsql as $$
begin
  if not coalesce(valor, false) then
    raise exception 'ASSERT FAIL: %', descricao;
  end if;
  insert into pg_temp.resultados_leitura_propria values (descricao);
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
  insert into pg_temp.resultados_leitura_propria values (descricao);
end;
$$;

grant select, insert on pg_temp.resultados_leitura_propria to anon, authenticated;
grant execute on function pg_temp.assert_true(boolean, text), pg_temp.expect_error(text, text, text) to anon, authenticated;

-- Quatro identidades distintas: dois donos, um terceiro e um Admin usado
-- exclusivamente para preparar estados administrativos sintéticos.
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
  ('00000000-0000-0000-0000-000000000000','62000000-0000-4000-8000-000000000801','authenticated','authenticated','rls-owner-pending@test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','62000000-0000-4000-8000-000000000802','authenticated','authenticated','rls-owner-approved@test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','62000000-0000-4000-8000-000000000803','authenticated','authenticated','rls-other@test','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','62000000-0000-4000-8000-000000000804','authenticated','authenticated','rls-admin@test','',now(),'{}','{}',now(),now());

insert into public.administradores(user_id) values ('62000000-0000-4000-8000-000000000804');
select set_config('request.jwt.claim.sub','62000000-0000-4000-8000-000000000804',true);

insert into public.vendedores(id,user_id,nome_comercial,nome_responsavel,telefone_whatsapp,provincia,municipio,tipo_vendedor,status_aprovacao,conta_ativa,email)
values
  ('62000000-0000-4000-8000-000000000811','62000000-0000-4000-8000-000000000801','Candidatura pendente','Responsável','923620811','Huambo','Huambo','ambulante','pendente',false,'privado-pendente@example.test'),
  ('62000000-0000-4000-8000-000000000812','62000000-0000-4000-8000-000000000802','Candidatura aprovada','Responsável','923620812','Huambo','Huambo','ambulante','aprovado',true,'privado-aprovado@example.test');

select pg_temp.assert_true(
  (select count(*) from public.vendedores where id in ('62000000-0000-4000-8000-000000000811','62000000-0000-4000-8000-000000000812')) = 2,
  'fixtures existem apenas para diagnóstico privilegiado'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','62000000-0000-4000-8000-000000000801',true);
select pg_temp.assert_true(auth.uid()='62000000-0000-4000-8000-000000000801'::uuid, 'auth.uid do dono pendente corresponde à fixture');
select pg_temp.assert_true(
  (select count(*) from public.vendedores where id='62000000-0000-4000-8000-000000000811') = 1,
  'dono lê colunas concedidas da própria candidatura pendente'
);
with atualizado as (
  update public.vendedores
     set descricao='edição permitida do dono'
   where id='62000000-0000-4000-8000-000000000811'
 returning id
)
select pg_temp.assert_true((select count(*) from atualizado)=1, 'UPDATE RETURNING do dono pendente devolve exatamente uma linha');
select pg_temp.expect_error(
  $sql$select email from public.vendedores where id='62000000-0000-4000-8000-000000000811'$sql$,
  'permission denied',
  'email privado continua sem SELECT direto para o dono'
);
select pg_temp.expect_error(
  $sql$update public.vendedores set user_id='62000000-0000-4000-8000-000000000803' where id='62000000-0000-4000-8000-000000000811'$sql$,
  'permission denied',
  'dono não altera user_id'
);
select pg_temp.expect_error(
  $sql$update public.vendedores set status_aprovacao='aprovado' where id='62000000-0000-4000-8000-000000000811'$sql$,
  'permission denied',
  'dono não se autoaprova'
);

select set_config('request.jwt.claim.sub','62000000-0000-4000-8000-000000000803',true);
select pg_temp.assert_true(auth.uid()='62000000-0000-4000-8000-000000000803'::uuid, 'auth.uid do terceiro corresponde à fixture');
select pg_temp.assert_true(
  (select count(*) from public.vendedores where id='62000000-0000-4000-8000-000000000811') = 0,
  'terceiro não lê candidatura pendente'
);
with atualizado as (
  update public.vendedores set descricao='tentativa de terceiro'
   where id='62000000-0000-4000-8000-000000000811'
 returning id
)
select pg_temp.assert_true((select count(*) from atualizado)=0, 'terceiro não atualiza candidatura pendente');

reset role;
set local role anon;
select pg_temp.assert_true(
  (select count(*) from public.vendedores where id='62000000-0000-4000-8000-000000000811') = 0,
  'anon não lê candidatura pendente'
);
select pg_temp.assert_true(
  (select count(*) from public.vendedores where id='62000000-0000-4000-8000-000000000812') = 1,
  'vendedor aprovado e ativo mantém leitura pública para anon'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','62000000-0000-4000-8000-000000000802',true);
select pg_temp.assert_true(auth.uid()='62000000-0000-4000-8000-000000000802'::uuid, 'auth.uid do dono aprovado corresponde à fixture');
with atualizado as (
  update public.vendedores set descricao='edição permitida aprovada'
   where id='62000000-0000-4000-8000-000000000812'
 returning id
)
select pg_temp.assert_true((select count(*) from atualizado)=1, 'regras de edição do vendedor aprovado permanecem preservadas');

reset role;
select count(*) as sql_assertions from pg_temp.resultados_leitura_propria;
rollback;
