-- ========================================
-- MIGRAÇÃO: consolidar tipos de vendedor redundantes
-- ========================================
-- Valores canónicos: produtor, revendedor e mini_mercado.
-- Os valores históricos 'fazenda', 'mercado' e 'loja' deixam de ser usados.
-- Corre este script manualmente no editor SQL do projeto Supabase
-- "Angrolink" para atualizar vendedores já registados com os
-- valores antigos.

alter table vendedores drop constraint if exists tipo_vendedor_valido;
alter table vendedores drop constraint if exists vendedores_tipo_vendedor_check;

update vendedores set tipo_vendedor = 'produtor'   where tipo_vendedor = 'fazenda';
update vendedores set tipo_vendedor = 'revendedor' where tipo_vendedor = 'mercado';
update vendedores set tipo_vendedor = 'mini_mercado' where tipo_vendedor = 'loja';

alter table vendedores add constraint tipo_vendedor_valido check (
  tipo_vendedor is null or tipo_vendedor in (
    'ambulante', 'quitandeira', 'taxista', 'moto_taxista', 'produtor',
    'revendedor', 'mini_mercado', 'supermercado', 'hipermercado',
    'grossista', 'prestador_servico'
  )
);
