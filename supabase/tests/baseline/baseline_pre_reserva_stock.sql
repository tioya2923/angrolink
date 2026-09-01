-- TEST-ONLY — NÃO APLICAR EM PRODUÇÃO
-- NÃO É MIGRATION. Composição explícita da baseline local pré-Reserva Stock V1.
\ir 00_auth_test_shim.sql
\ir 10_schema_pre_reserva_stock.sql
\ir 20_funcoes_pre_reserva_stock.sql
\ir 30_rls_grants_pre_reserva_stock.sql
\ir 40_smoke_pre_reserva_stock.sql
