-- ANGROLINK — atualizações em tempo real exclusivamente para encomendas.
-- A publicação transmite apenas alterações; a autorização de cada linha continua
-- a ser avaliada pelas políticas RLS já existentes nas tabelas.

do $$
declare
  tabela text;
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    raise exception 'A publicação supabase_realtime não existe neste projeto.';
  end if;

  foreach tabela in array array['encomendas', 'eventos_encomenda']
  loop
    if to_regclass('public.' || tabela) is null then
      raise exception 'A tabela pública % não existe.', tabela;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tabela
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        tabela
      );
    end if;

    -- Necessário para que alterações de estado possam ser tratadas de forma
    -- consistente pelo Realtime, sem expor dados fora da RLS.
    execute format('alter table public.%I replica identity full', tabela);
  end loop;
end;
$$;

-- itens_encomenda não entra na publicação: é um snapshot imutável depois da
-- criação e é sempre carregado junto da encomenda pelo detalhe/lista.
