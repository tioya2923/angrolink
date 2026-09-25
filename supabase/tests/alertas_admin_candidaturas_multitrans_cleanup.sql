\set ON_ERROR_STOP on
-- EXECUTAR SEMPRE no finally após alertas_admin_candidaturas_multitrans_funcional.sql.
-- Exclusivo de uma base Supabase LOCAL descartável; remove apenas fixtures com IDs reservados.
begin;
delete from public.notificacoes where entidade_id='71000000-0000-4000-8000-000000000001' and contexto='admin' and tipo='candidatura_vendedor_pronta';
delete from public.documentos_vendedor where vendedor_id='71000000-0000-4000-8000-000000000001';
delete from public.candidaturas_vendedor_revisoes where vendedor_id='71000000-0000-4000-8000-000000000001';
delete from public.vendedores where id='71000000-0000-4000-8000-000000000001';
delete from public.administradores where user_id in ('70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002');
delete from auth.users where id in ('70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000003');
delete from public.municipios_angola where id='72000000-0000-4000-8000-000000000002' and codigo_oficial='HBO-ALERTA-MULTITX';
delete from public.provincias_angola where id='72000000-0000-4000-8000-000000000001' and codigo_oficial='HBO';
commit;

do $$
begin
  if exists (select 1 from auth.users where id in ('70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000003'))
    or exists (select 1 from public.vendedores where id='71000000-0000-4000-8000-000000000001')
    or exists (select 1 from public.documentos_vendedor where vendedor_id='71000000-0000-4000-8000-000000000001')
    or exists (select 1 from public.candidaturas_vendedor_revisoes where vendedor_id='71000000-0000-4000-8000-000000000001')
    or exists (select 1 from public.notificacoes where entidade_id='71000000-0000-4000-8000-000000000001')
    or exists (select 1 from public.municipios_angola where id='72000000-0000-4000-8000-000000000002')
    or exists (select 1 from public.provincias_angola where id='72000000-0000-4000-8000-000000000001')
  then
    raise exception 'CLEANUP_FAIL: fixtures multitrans ainda existem';
  end if;
end;
$$;
select 'CLEANUP_PASS' as resultado;
