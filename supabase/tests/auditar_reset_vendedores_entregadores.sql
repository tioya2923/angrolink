-- AUDITORIA SOMENTE LEITURA — não altera dados, schema, Storage ou Auth.
-- Execute no SQL Editor com privilégio administrativo e guarde apenas as contagens.

with vendedores_alvo as (
  select id, user_id from public.vendedores
),
parceiros_alvo as (
  select id, user_id from public.parceiros_entrega
),
utilizadores_alvo as (
  select user_id from vendedores_alvo where user_id is not null
  union
  select user_id from parceiros_alvo where user_id is not null
),
encomendas_alvo as (
  select e.id
  from public.encomendas e
  where e.vendedor_id in (select id from vendedores_alvo)
     or e.cliente_id in (select user_id from utilizadores_alvo)
),
produtos_alvo as (
  select id from public.produtos where vendedor_id in (select id from vendedores_alvo)
),
servicos_alvo as (
  select id from public.servicos where vendedor_id in (select id from vendedores_alvo)
)
select
  (select count(*) from vendedores_alvo) as vendedores_alvo,
  (select count(*) from parceiros_alvo) as parceiros_alvo,
  (select count(*) from utilizadores_alvo) as auth_users_alvo,
  (select count(*) from vendedores_alvo v join parceiros_alvo p on p.user_id = v.user_id) as sobreposicao_vendedor_parceiro,
  (select count(*) from public.administradores a join utilizadores_alvo u on u.user_id = a.user_id) as sobreposicao_admin_alvo,
  (select count(*) from public.clientes c join utilizadores_alvo u on u.user_id = c.id) as clientes_secundarios_alvo,
  (select count(*) from public.clientes c where not exists (select 1 from utilizadores_alvo u where u.user_id = c.id)) as clientes_normais_preservados,
  (select count(*) from produtos_alvo) as produtos_alvo,
  (select count(*) from servicos_alvo) as servicos_alvo,
  (select count(*) from public.documentos_vendedor where vendedor_id in (select id from vendedores_alvo)) as documentos_vendedor,
  (select count(*) from public.documentos_vendedor_eventos where vendedor_id in (select id from vendedores_alvo)) as eventos_documentos_vendedor,
  (select count(*) from public.veiculos_entrega where parceiro_id in (select id from parceiros_alvo)) as veiculos_entrega,
  (select count(*) from public.areas_cobertura_entrega where parceiro_id in (select id from parceiros_alvo)) as areas_cobertura,
  (select count(*) from public.documentos_parceiro_entrega where parceiro_id in (select id from parceiros_alvo)) as documentos_parceiro,
  (select count(*) from public.versoes_documento_parceiro_entrega where parceiro_id in (select id from parceiros_alvo)) as versoes_documento_parceiro,
  (select count(*) from public.eventos_documento_parceiro_entrega where parceiro_id in (select id from parceiros_alvo)) as eventos_documento_parceiro,
  (select count(*) from encomendas_alvo) as encomendas_alvo,
  (select count(*) from public.itens_encomenda where encomenda_id in (select id from encomendas_alvo)) as itens_encomenda,
  (select count(*) from public.eventos_encomenda where encomenda_id in (select id from encomendas_alvo)) as eventos_encomenda,
  (select count(*) from public.codigos_levantamento where encomenda_id in (select id from encomendas_alvo)) as codigos_levantamento,
  (select count(*) from public.enderecos_entrega_encomenda where encomenda_id in (select id from encomendas_alvo)) as enderecos_entrega,
  (select count(*) from public.atribuicoes_entrega_encomenda where encomenda_id in (select id from encomendas_alvo) or parceiro_entrega_id in (select id from parceiros_alvo)) as atribuicoes_entrega,
  (select count(*) from public.pagamentos where encomenda_id in (select id from encomendas_alvo)) as pagamentos,
  (select count(*) from public.tentativas_pagamento where pagamento_id in (select id from public.pagamentos where encomenda_id in (select id from encomendas_alvo))) as tentativas_pagamento,
  (select count(*) from public.eventos_pagamento where encomenda_id in (select id from encomendas_alvo)) as eventos_pagamento,
  (select count(*) from public.repasses_vendedor where encomenda_id in (select id from encomendas_alvo) or vendedor_id in (select id from vendedores_alvo)) as repasses_vendedor,
  (select count(*) from public.reembolsos_pagamento where encomenda_id in (select id from encomendas_alvo)) as reembolsos_pagamento,
  (select count(*) from public.movimentos_financeiros where encomenda_id in (select id from encomendas_alvo) or vendedor_id in (select id from vendedores_alvo) or cliente_id in (select user_id from utilizadores_alvo)) as movimentos_financeiros,
  (select count(*) from public.disputas_encomenda where encomenda_id in (select id from encomendas_alvo) or vendedor_id in (select id from vendedores_alvo) or cliente_id in (select user_id from utilizadores_alvo)) as disputas_encomenda,
  (select count(*) from public.notificacoes n where n.utilizador_id in (select user_id from utilizadores_alvo) or (n.entidade_tipo = 'encomenda' and n.entidade_id in (select id from encomendas_alvo))) as notificacoes_removiveis,
  (select count(*) from public.historico_contactos where vendedor_id in (select id from vendedores_alvo) or produto_id in (select id from produtos_alvo) or cliente_id in (select user_id from utilizadores_alvo)) as historico_contactos,
  (select count(*) from public.historico_contactos_servicos where vendedor_id in (select id from vendedores_alvo) or servico_id in (select id from servicos_alvo) or cliente_id in (select user_id from utilizadores_alvo)) as historico_contactos_servicos,
  (select count(*) from public.historico_pesquisas where cliente_id in (select user_id from utilizadores_alvo)) as historico_pesquisas,
  (select count(*) from public.favoritos where utilizador_id in (select user_id from utilizadores_alvo) or vendedor_id in (select id from vendedores_alvo) or produto_id in (select id from produtos_alvo) or servico_id in (select id from servicos_alvo)) as favoritos,
  (select count(*) from public.visualizacoes_produtos where cliente_id in (select user_id from utilizadores_alvo) or vendedor_id in (select id from vendedores_alvo) or produto_id in (select id from produtos_alvo)) as visualizacoes_produtos,
  (select count(*) from public.visualizacoes_servicos where cliente_id in (select user_id from utilizadores_alvo) or vendedor_id in (select id from vendedores_alvo) or servico_id in (select id from servicos_alvo)) as visualizacoes_servicos,
  (select count(*) from public.profiles where id in (select user_id from utilizadores_alvo)) as profiles_alvo,
  (select count(*) from public.profiles where vendedor_id in (select id from vendedores_alvo) and id not in (select user_id from utilizadores_alvo)) as profiles_externos_apontando_vendedor_alvo;

-- Mapa real de FKs no remoto. Deve ser revisto antes de executar o reset.
select
  n.nspname as schema_origem,
  c.relname as tabela_origem,
  a.attname as coluna_origem,
  nr.nspname as schema_referenciado,
  cr.relname as tabela_referenciada,
  con.conname as constraint_name,
  con.confdeltype as acao_delete
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_class cr on cr.oid = con.confrelid
join pg_namespace nr on nr.oid = cr.relnamespace
join unnest(con.conkey) with ordinality as chave(attnum, ordem) on true
join pg_attribute a on a.attrelid = c.oid and a.attnum = chave.attnum
where con.contype = 'f'
  and con.confrelid in (
    'public.vendedores'::regclass,
    'public.parceiros_entrega'::regclass,
    'public.veiculos_entrega'::regclass,
    'public.clientes'::regclass,
    'public.encomendas'::regclass,
    'public.profiles'::regclass,
    'auth.users'::regclass
  )
order by tabela_referenciada, tabela_origem, chave.ordem;

-- Inventário de referências Storage. Não expõe paths, apenas contabiliza órfãos potenciais.
with vendedores_alvo as (select id, user_id from public.vendedores),
parceiros_alvo as (select id, user_id from public.parceiros_entrega),
utilizadores_alvo as (
  select user_id from vendedores_alvo where user_id is not null
  union
  select user_id from parceiros_alvo where user_id is not null
),
produtos_alvo as (select id from public.produtos where vendedor_id in (select id from vendedores_alvo)),
servicos_alvo as (select id from public.servicos where vendedor_id in (select id from vendedores_alvo))
select * from (
  select 'vendedores.foto_perfil' as campo, 'vendedores' as origem, 'bucket vendedores (URL pública)' as origem_provavel, count(*)::bigint as referencias_que_podem_ficar_orfas from public.vendedores where id in (select id from vendedores_alvo) and foto_perfil is not null
  union all select 'vendedores.documentos', 'vendedores', 'JSON legado; origem/bucket a inventariar separadamente', count(*)::bigint from public.vendedores where id in (select id from vendedores_alvo) and documentos is not null and documentos <> '{}'::jsonb
  union all select 'clientes.foto_perfil', 'clientes secundários', 'URL legada de fotografia de perfil', count(*)::bigint from public.clientes where id in (select user_id from utilizadores_alvo) and foto_perfil is not null
  union all select 'produtos.imagem_url', 'produtos', 'bucket produtos (URL pública)', count(*)::bigint from public.produtos where id in (select id from produtos_alvo) and imagem_url is not null
  union all select 'servicos.imagem_url', 'servicos', 'bucket produtos (URL pública)', count(*)::bigint from public.servicos where id in (select id from servicos_alvo) and imagem_url is not null
  union all select 'documentos_vendedor.frente_path/verso_path', 'documentos_vendedor', 'bucket privado de documentos de vendedores', count(*)::bigint from public.documentos_vendedor where vendedor_id in (select id from vendedores_alvo) and (frente_path is not null or verso_path is not null)
  union all select 'parceiros_entrega.foto_perfil_url', 'parceiros_entrega', 'documentos-parceiros (privado)', count(*)::bigint from public.parceiros_entrega where id in (select id from parceiros_alvo) and foto_perfil_url is not null
  union all select 'veiculos_entrega.foto_veiculo_path', 'veiculos_entrega', 'documentos-parceiros (privado)', count(*)::bigint from public.veiculos_entrega where parceiro_id in (select id from parceiros_alvo) and foto_veiculo_path is not null
  union all select 'documentos_parceiro_entrega.frente_path/verso_path', 'documentos_parceiro_entrega', 'documentos-parceiros (privado)', count(*)::bigint from public.documentos_parceiro_entrega where parceiro_id in (select id from parceiros_alvo)
  union all select 'versoes_documento_parceiro_entrega.frente_path/verso_path', 'versoes_documento_parceiro_entrega', 'documentos-parceiros (privado)', count(*)::bigint from public.versoes_documento_parceiro_entrega where parceiro_id in (select id from parceiros_alvo)
) inventario
order by origem, campo;
