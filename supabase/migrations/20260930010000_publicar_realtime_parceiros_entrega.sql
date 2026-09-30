begin;

-- Realtime avalia RLS ao entregar cada alteração. Esta migration apenas
-- publica as duas tabelas já protegidas; não altera policies, grants ou dados.
do $$
declare
  tabela text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'A publicação supabase_realtime não existe.';
  end if;

  foreach tabela in array array['parceiros_entrega', 'documentos_parceiro_entrega'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tabela) then
      execute format('alter publication supabase_realtime add table public.%I', tabela);
    end if;
  end loop;
end;
$$;

commit;
