-- ANGROLINK: atualização em tempo real das áreas que refletem mudanças de
-- catálogo, perfis, pedidos e documentação. Execute uma única vez no SQL
-- Editor do Supabase caso estas tabelas ainda não estejam na publicação.

do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'clientes',
    'vendedores',
    'produtos',
    'servicos',
    'favoritos',
    'historico_contactos',
    'historico_contactos_servicos',
    'parceiros_entrega',
    'veiculos_entrega',
    'documentos_parceiro_entrega',
    'areas_cobertura_entrega',
    'categorias'
  ]
  loop
    if to_regclass('public.' || tabela) is not null then
      begin
        execute format('alter publication supabase_realtime add table public.%I', tabela);
      exception
        when duplicate_object then null;
        when duplicate_table then null;
      end;

      execute format('alter table public.%I replica identity full', tabela);
    end if;
  end loop;
end $$;

-- A publicação não substitui as políticas RLS: cada utilizador continuará a
-- receber somente as linhas que tem autorização de consultar.
