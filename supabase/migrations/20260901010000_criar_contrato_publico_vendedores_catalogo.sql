begin;

create or replace function public.listar_vendedores_publicos(
  p_vendedor_ids uuid[] default null
)
returns table(
  id uuid,
  nome_comercial text,
  descricao text,
  telefone_whatsapp text,
  whatsapp text,
  provincia text,
  municipio text,
  bairro text,
  mercado_bairro text,
  endereco_detalhado text,
  tipo_vendedor text,
  verificado boolean,
  foto_perfil text,
  ano_inicio integer,
  data_inicio_atividade date,
  horario_atendimento text,
  entrega_disponivel boolean,
  tipo_producao text,
  area_cultivada numeric,
  principais_culturas text,
  producao_mensal text,
  venda_grosso boolean,
  venda_retalho boolean,
  tipos_produtos text,
  compra_produtores boolean,
  volume_minimo text,
  entrega_outras_provincias boolean,
  tipo_loja text,
  mercado_localizado text,
  venda_presencial boolean,
  criado_em timestamp without time zone
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    v.nome_comercial,
    v.descricao,
    v.telefone_whatsapp,
    v.whatsapp,
    v.provincia,
    v.municipio,
    v.bairro,
    v.mercado_bairro,
    v.endereco_detalhado,
    v.tipo_vendedor,
    v.verificado,
    v.foto_perfil,
    v.ano_inicio,
    v.data_inicio_atividade,
    v.horario_atendimento,
    v.entrega_disponivel,
    v.tipo_producao,
    v.area_cultivada,
    v.principais_culturas,
    v.producao_mensal,
    v.venda_grosso,
    v.venda_retalho,
    v.tipos_produtos,
    v.compra_produtores,
    v.volume_minimo,
    v.entrega_outras_provincias,
    v.tipo_loja,
    v.mercado_localizado,
    v.venda_presencial,
    v.criado_em
  from public.vendedores v
  where v.status_aprovacao = 'aprovado'
    and coalesce(v.conta_ativa, false) = true
    and (p_vendedor_ids is null or v.id = any(p_vendedor_ids))
  order by v.nome_comercial, v.id;
$$;

revoke all on function public.listar_vendedores_publicos(uuid[]) from public, anon, authenticated;
grant execute on function public.listar_vendedores_publicos(uuid[]) to anon, authenticated;

commit;
