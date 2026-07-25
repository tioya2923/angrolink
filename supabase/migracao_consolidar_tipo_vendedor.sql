-- ========================================
-- MIGRAÇÃO: consolidar tipos de vendedor redundantes
-- ========================================
-- O tipo 'fazenda' foi fundido em 'produtor' e o tipo 'mercado'
-- foi fundido em 'revendedor' (eram redundantes com estes).
-- Corre este script manualmente no editor SQL do projeto Supabase
-- "Angrolink" para atualizar vendedores já registados com os
-- valores antigos.

update vendedores set tipo_vendedor = 'produtor'   where tipo_vendedor = 'fazenda';
update vendedores set tipo_vendedor = 'revendedor' where tipo_vendedor = 'mercado';
