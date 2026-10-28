\set ON_ERROR_STOP on
-- Executar depois de contratos_antes.sql e da migration, na mesma sessao local.
begin;
create function pg_temp.verificar(ok boolean, titulo text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERT FAIL: %', titulo; end if;
  raise notice 'ASSERT PASS: %', titulo;
end $$;
create function pg_temp.recusar(sql text, codigo text, titulo text) returns void language plpgsql as $$
declare observado text;
begin
  begin
    execute sql;
    set constraints all immediate;
  exception when others then
    get stacked diagnostics observado = returned_sqlstate;
  end;
  perform pg_temp.verificar(observado = codigo,titulo);
end $$;
select pg_temp.verificar(not exists(
  (select * from contrato_anterior except select * from contrato_anterior_atual)
  union all (select * from contrato_anterior_atual except select * from contrato_anterior)
), 'RPCs, triggers comerciais, constraints, RLS, grants e snapshot intactos');
select pg_temp.verificar((select count(*)=6 and bool_and(c.relrowsecurity)
  and bool_and(pg_get_userbyid(c.relowner)='postgres')
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='parceiros_email_verificacao_privado' and c.relkind='r'),
  'seis tabelas privadas, owner postgres e RLS');
select pg_temp.verificar(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='parceiros_email_verificacao_privado'), 'nenhuma funcao operacional');
select pg_temp.verificar(not exists(select 1 from pg_policy where polrelid in
  (select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='parceiros_email_verificacao_privado')), 'nenhuma policy permissiva');
select pg_temp.verificar(not exists(select 1 from pg_namespace n,
  lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
  where n.nspname='parceiros_email_verificacao_privado' and a.grantee=0), 'PUBLIC sem grants no schema');
select pg_temp.verificar(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace,
  lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
  where n.nspname='parceiros_email_verificacao_privado' and a.grantee=0), 'PUBLIC sem grants nas tabelas');
select pg_temp.verificar(not has_schema_privilege(r,'parceiros_email_verificacao_privado','USAGE')
  and not exists(select 1 from pg_tables t where t.schemaname='parceiros_email_verificacao_privado'
    and has_table_privilege(r,format('%I.%I',t.schemaname,t.tablename),'SELECT,INSERT,UPDATE,DELETE')),
  r||' sem acesso privado') from unnest(array['anon','authenticated','service_role']) r;
-- Namespace temporario da sessao acessivel pelos papeis; helper e SECURITY INVOKER.
grant execute on function pg_temp.recusar(text,text,text), pg_temp.verificar(boolean,text) to anon, authenticated;
set local role anon;
select pg_temp.verificar(current_user='anon', 'negativa anon usa papel sem privilegios administrativos');
select pg_temp.recusar('select 1 from parceiros_email_verificacao_privado.desafios','42501','anon recusado na leitura real');
reset role;
set local role authenticated;
select pg_temp.verificar(current_user='authenticated', 'negativa authenticated usa papel sem privilegios administrativos');
select pg_temp.recusar('insert into parceiros_email_verificacao_privado.desafios default values','42501','authenticated recusado na escrita real');
reset role;
set local search_path = parceiros_email_verificacao_privado, pg_catalog;
-- Dois UUIDs ficticios ja preparados exclusivamente na copia local.
insert into desafios(id,user_id,email_normalizado,geracao,versao_criptografica,verificador,
  criado_em,expira_em,proximo_envio_em,estado,finalizado_em)
select ('72710000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  ('72610000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'controlado@example.test',1,1,decode(repeat('ab',32),'hex'),
  now()-interval '2 days',now()-interval '1 day',now()-interval '2 days','consumido',now()-interval '1 day'
from generate_series(3,4) n;
insert into comprovacoes(id,user_id,email_normalizado,desafio_id,versao)
select id,user_id,email_normalizado,id,1 from desafios;
set constraints all immediate;
select pg_temp.verificar((select count(*)=2 from comprovacoes where estado='ativa'),
  'mesmo email pode ter provas separadas por UUID; OTP expirado nao expira comprovacao');
select pg_temp.recusar($q$update desafios set estado='expirado'$q$,'23503',
  'desafio comprovado conserva estado terminal consumido');
update desafios set verificador=null,verificador_eliminado_em=now();
select pg_temp.verificar((select count(*)=2 from comprovacoes),
  'verificador pode ser purgado sem eliminar origem ou comprovacao');
select pg_temp.recusar($q$update desafios set email_normalizado='A@example.test'$q$,'23514','email deve estar normalizado');
select pg_temp.recusar($q$update desafios set email_normalizado='923@telefone.angrolink'$q$,'23514','email sintetico recusado');
select pg_temp.recusar($q$update desafios set email_normalizado='invalido'$q$,'23514','email malformado recusado');
select pg_temp.recusar($q$update desafios set verificador=decode('ab','hex')$q$,'23514','verificador curto recusado');
select pg_temp.recusar($q$update desafios set tentativas=6$q$,'23514','limite de tentativas estrutural');
select pg_temp.recusar($q$update desafios set expira_em=criado_em$q$,'23514','prazo de desafio invalido recusado');
select pg_temp.recusar($q$update comprovacoes set user_id='72610000-0000-4000-8000-000000000005'
  where user_id='72610000-0000-4000-8000-000000000003'$q$,'23503','comprovacao nao transferivel entre UUIDs');
select pg_temp.recusar($q$update comprovacoes set email_normalizado='outro@example.test'$q$,'23503','comprovacao nao transferivel entre emails');
select pg_temp.recusar($q$delete from desafios$q$,'23503','origem auditavel nao pode ser eliminada isoladamente');
select pg_temp.recusar($q$update comprovacoes set estado='revogada'$q$,'23514','revogacao exige data explicita');
insert into continuacoes(id,user_id,comprovacao_id,email_normalizado,tentativa_id,operacao,chave_idempotencia,
  criado_em,expira_em,estado,encerrada_em)
select id,user_id,id,email_normalizado,id,'submeter_candidatura','72710000-0000-4000-8000-000000000003'::uuid,
  now()-interval '1 hour',now()-interval '30 minutes','expirada',now() from comprovacoes;
select pg_temp.verificar((select count(*)=2 from comprovacoes where estado='ativa'), 'continuacao expirada nao revoga prova');
select pg_temp.recusar($q$update continuacoes set user_id='72610000-0000-4000-8000-000000000005'
  where user_id='72610000-0000-4000-8000-000000000003'$q$,'23503','continuacao vinculada ao UUID comprovado');
select pg_temp.recusar($q$update continuacoes set email_normalizado='outro@example.test'$q$,'23503','continuacao vinculada ao email comprovado');
select pg_temp.recusar($q$update continuacoes set expira_em=criado_em$q$,'23514','prazo independente da continuacao validado');
insert into outbox(user_id,desafio_id,geracao,chave_deduplicacao,versao_chave,conteudo_cifrado,nonce,tag)
select user_id,id,geracao,id,1,decode('ab','hex'),decode(repeat('ab',12),'hex'),decode(repeat('ab',16),'hex') from desafios;
select pg_temp.recusar($q$update outbox set geracao=2$q$,'23503','outbox vinculada a geracao exata');
select pg_temp.recusar($q$update outbox set nonce=decode('ab','hex')$q$,'23514','nonce invalido recusado');
select pg_temp.recusar($q$update outbox set estado='processando'$q$,'23514','processamento exige lease');
select pg_temp.recusar($q$update outbox set conteudo_cifrado=null$q$,'23514','envelope parcial recusado');
insert into idempotencia(user_id,operacao,chave_idempotencia,tentativa_id,continuacao_id,versao_intencao,hash_intencao)
select user_id,operacao,chave_idempotencia,tentativa_id,id,1,decode(repeat('ab',32),'hex') from continuacoes;
select pg_temp.recusar($q$insert into idempotencia(user_id,operacao,chave_idempotencia,tentativa_id,continuacao_id,versao_intencao,hash_intencao)
  select user_id,operacao,chave_idempotencia,tentativa_id,id,1,decode(repeat('ab',32),'hex') from continuacoes$q$,
  '23505','ledger unico por UUID operacao chave');
select pg_temp.recusar($q$update idempotencia set hash_intencao=decode('ab','hex')$q$,'23514','hash de intencao com formato protegido');
select pg_temp.recusar($q$update idempotencia set operacao='outra_operacao'$q$,'23503','ledger nao troca operacao sem continuacao correspondente');
select pg_temp.recusar($q$update idempotencia set estado='concluida',finalizado_em=now(),resultado_parceiro_id=continuacao_id,
  resposta_minima=jsonb_build_object('parceiro_id',continuacao_id,'estado','em_analise','segredo','nao')$q$,
  '23514','resposta minima rejeita campos adicionais');
update idempotencia set estado='concluida',finalizado_em=now(),resultado_parceiro_id=continuacao_id,
  resposta_minima=jsonb_build_object('parceiro_id',continuacao_id,'estado','em_analise');
select pg_temp.verificar((select count(*)=2 from idempotencia where estado='concluida'), 'referencia e resposta minima coerentes aceites');
insert into orcamentos(tipo_sujeito,user_id,metrica,janela_inicio,janela_fim,limite)
select 'identidade',user_id,'emissoes',now(),now()+interval '1 hour',5 from desafios;
insert into orcamentos(tipo_sujeito,metrica,janela_inicio,janela_fim,limite)
values ('global','emissoes',now(),now()+interval '1 hour',5),
       ('global','falhas_validacao',now(),now()+interval '1 hour',5);
select pg_temp.recusar($q$insert into orcamentos(tipo_sujeito,metrica,janela_inicio,janela_fim,limite)
 values ('global','emissoes',now(),now()+interval '1 hour',5)$q$,'23505','unicidade inclui sujeitos NULL');
select pg_temp.recusar($q$update orcamentos set utilizado=4,reservado=2$q$,'23514','reservas respeitam limite');
select pg_temp.recusar($q$insert into orcamentos(tipo_sujeito,metrica,janela_inicio,janela_fim,limite)
 values ('origem','emissoes',now(),now()+interval '1 hour',5)$q$,'23514','origem exige pseudonimo versionado');
select pg_temp.verificar((select count(*)=2 from orcamentos where tipo_sujeito='global'), 'emissao e falhas possuem orcamentos separados');
-- Uma nova geracao nao revoga automaticamente uma comprovacao anterior.
insert into desafios(user_id,email_normalizado,geracao,versao_criptografica,verificador,expira_em,proximo_envio_em)
values ('72610000-0000-4000-8000-000000000003','novo@example.test',2,1,decode(repeat('ab',32),'hex'),now()+interval '5 minutes',now());
select pg_temp.recusar($q$insert into comprovacoes(user_id,email_normalizado,desafio_id,versao,estado,revogada_em)
  select user_id,email_normalizado,id,1,'revogada',now() from desafios where geracao=2$q$,
  '23503','desafio ainda ativo nao comprova posse');
update desafios set estado='consumido',finalizado_em=now() where geracao=2;
select pg_temp.recusar($q$insert into comprovacoes(user_id,email_normalizado,desafio_id,versao)
  select user_id,email_normalizado,id,1 from desafios where geracao=2$q$,
  '23505','apenas uma comprovacao ativa por UUID e finalidade');
select pg_temp.verificar((select count(*)=2 from comprovacoes where estado='ativa'), 'reenvio ou novo email nao revoga prova automaticamente');
select pg_temp.recusar($q$insert into desafios(user_id,email_normalizado,geracao,versao_criptografica,verificador,expira_em,proximo_envio_em)
 values ('72610000-0000-4000-8000-000000000003','novo@example.test',2,1,decode(repeat('ab',32),'hex'),now()+interval '5 minutes',now())$q$,
 '23505','geracao unica por identidade e finalidade');
insert into continuacoes(user_id,comprovacao_id,email_normalizado,tentativa_id,operacao,chave_idempotencia,expira_em)
select user_id,id,email_normalizado,gen_random_uuid(),'outra_operacao','72710000-0000-4000-8000-000000000003'::uuid,
  now()+interval '10 minutes' from comprovacoes;
insert into idempotencia(user_id,operacao,chave_idempotencia,tentativa_id,continuacao_id,versao_intencao,hash_intencao)
select user_id,operacao,chave_idempotencia,tentativa_id,id,1,decode(repeat('ab',32),'hex') from continuacoes where operacao='outra_operacao';
select pg_temp.verificar((select count(*)=4 and count(distinct chave_idempotencia)=1
  and count(distinct user_id)=2 and count(distinct operacao)=2 from idempotencia),
  'mesma chave isolada por operacao e identidade');
update comprovacoes set estado='revogada',revogada_em=now() where user_id='72610000-0000-4000-8000-000000000003';
select pg_temp.verificar((select count(*)=1 from comprovacoes where estado='revogada'), 'revogacao explicita conserva historico');
set constraints all deferred;
delete from auth.users where id='72610000-0000-4000-8000-000000000004';
set constraints all immediate;
select pg_temp.verificar(not exists(select 1 from desafios where user_id='72610000-0000-4000-8000-000000000004')
  and not exists(select 1 from comprovacoes where user_id='72610000-0000-4000-8000-000000000004')
  and not exists(select 1 from continuacoes where user_id='72610000-0000-4000-8000-000000000004')
  and not exists(select 1 from outbox where user_id='72610000-0000-4000-8000-000000000004')
  and not exists(select 1 from idempotencia where user_id='72610000-0000-4000-8000-000000000004')
  and not exists(select 1 from orcamentos where user_id='72610000-0000-4000-8000-000000000004'), 'eliminacao Auth limpa seis estruturas da identidade');
select pg_temp.verificar(exists(select 1 from comprovacoes where user_id='72610000-0000-4000-8000-000000000003'), 'eliminacao nao afeta outra identidade');
rollback;
