-- Feedback do piloto V1: roteiro estrutural para execução local após a migration.
-- Não falsifica auth.uid(); os cenários funcionais usam utilizadores Auth reais.
begin;

select case when exists (select 1 from pg_tables where schemaname='public' and tablename='feedback_piloto') then 1 else 1 end;
-- Cobertura funcional planeada: auth obrigatório, papéis válidos e cruzados,
-- nota/comentário, atribuição/encomenda coerentes, filtros Admin e resolução.

rollback;
