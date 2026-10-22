\set ON_ERROR_STOP on
-- Limpeza obrigatória da preparação histórica local; nunca executar contra staging/produção.
begin;
delete from public.documentos_vendedor where vendedor_id='61000000-0000-4000-8000-000000000110';
delete from public.vendedores where id='61000000-0000-4000-8000-000000000110';
delete from auth.users where id='61000000-0000-4000-8000-000000000021';
delete from public.administradores where user_id='61000000-0000-4000-8000-000000000023';
delete from auth.users where id='61000000-0000-4000-8000-000000000023';
delete from public.municipios_angola where id='61000000-0000-4000-8000-000000000002' and codigo_oficial='HBO-EMAIL-POLITICA';
delete from public.provincias_angola where id='61000000-0000-4000-8000-000000000001' and codigo_oficial='HBO';
do $$
declare
  v_restantes integer;
begin
  select
    (select count(*) from public.vendedores where id='61000000-0000-4000-8000-000000000110')
    + (select count(*) from public.documentos_vendedor where vendedor_id='61000000-0000-4000-8000-000000000110')
    + (select count(*) from auth.users where id='61000000-0000-4000-8000-000000000021')
    + (select count(*) from auth.users where id='61000000-0000-4000-8000-000000000023')
    + (select count(*) from public.municipios_angola where id='61000000-0000-4000-8000-000000000002')
    + (select count(*) from public.provincias_angola where id='61000000-0000-4000-8000-000000000001')
  into v_restantes;

  if v_restantes <> 0 then
    raise exception 'Limpeza incompleta: % fixtures sintéticas permanecem', v_restantes;
  end if;

  raise notice 'fixtures_restantes=0';
end;
$$;
commit;
