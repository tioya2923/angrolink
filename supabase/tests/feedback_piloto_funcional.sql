-- Feedback do piloto V1 — teste funcional local (UTF-8).
-- Pré-requisito: Supabase local com a migration 20260912010000 aplicada e
-- fixtures sintéticas para cliente, vendedor, parceiro, Admin e encomendas.
-- Não executar contra staging ou produção.
begin;

-- Para cada cenário, usar SET LOCAL ROLE authenticated e claims JWT do
-- utilizador sintético correspondente. Nunca alterar auth.uid().
--
-- Cobertura obrigatória a executar com as fixtures locais:
-- 1. Cliente, vendedor e parceiro criam feedback geral (aplicacao/outro).
-- 2. Rejeitar vazio, nota 0, nota 6, comentário >1000 e categoria inválida.
-- 3. Cliente só associa a sua encomenda concluída; rejeitar alheia/não concluída.
-- 4. Vendedor só associa encomenda própria concluída; rejeitar alheia/não concluída.
-- 5. Parceiro só associa a sua atribuição concluída; rejeitar alheia/não concluída
--    e encomenda incompatível com a atribuição.
-- 6. Utilizador comum não lista nem atualiza; Admin lista, filtra, pagina,
--    altera novo → em_analise → resolvido e reabre limpando resolução.
-- 7. authenticated não possui SELECT/INSERT/UPDATE/DELETE direto na tabela.

do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='feedback_piloto') then
    raise exception 'Pré-requisito ausente: public.feedback_piloto não existe.';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='criar_feedback_piloto') then
    raise exception 'Pré-requisito ausente: criar_feedback_piloto não existe.';
  end if;
end;
$$;

rollback;
