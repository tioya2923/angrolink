-- ANGROLINK staging baseline: membership da publicação Realtime confirmado
-- por dump estrutural remoto em 2026-08-31.
do $$
declare
  tabela text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'A publicação supabase_realtime não existe no projeto de staging.';
  end if;

  foreach tabela in array array['documentos_vendedor', 'encomendas', 'eventos_encomenda', 'notificacoes'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tabela
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tabela);
    end if;
  end loop;
end;
$$;
