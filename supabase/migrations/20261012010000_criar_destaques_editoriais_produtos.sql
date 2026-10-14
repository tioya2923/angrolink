begin;

-- Destaques editoriais do piloto: não reutilizam nem importam os flags
-- legados de produtos. A exposição pública resulta exclusivamente desta tabela.
create extension if not exists btree_gist with schema extensions;

create table public.destaques_produtos_editoriais (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete restrict,
  vendedor_id uuid not null references public.vendedores(id) on delete restrict,
  posicao smallint not null check (posicao between 1 and 8),
  inicio_em timestamptz not null default now(),
  fim_em timestamptz not null,
  periodo tstzrange generated always as (tstzrange(inicio_em, fim_em, '[)')) stored,
  criado_por uuid not null,
  criado_em timestamptz not null default now(),
  revogado_por uuid,
  revogado_em timestamptz,
  motivo_revogacao_interno text,
  constraint destaques_produtos_editoriais_duracao_fixa
    check (fim_em = inicio_em + interval '7 days'),
  constraint destaques_produtos_editoriais_revogacao_consistente
    check ((revogado_em is null and revogado_por is null and motivo_revogacao_interno is null)
      or (revogado_em is not null and revogado_por is not null))
);

alter table public.destaques_produtos_editoriais enable row level security;

-- Oito posições globais, um produto e um vendedor por período sobreposto.
alter table public.destaques_produtos_editoriais
  add constraint destaques_produtos_editoriais_posicao_sem_sobreposicao
  exclude using gist (posicao with =, periodo with &&) where (revogado_em is null),
  add constraint destaques_produtos_editoriais_vendedor_sem_sobreposicao
  exclude using gist (vendedor_id with =, periodo with &&) where (revogado_em is null),
  add constraint destaques_produtos_editoriais_produto_sem_sobreposicao
  exclude using gist (produto_id with =, periodo with &&) where (revogado_em is null);

create table public.eventos_destaques_produtos_editoriais (
  id uuid primary key default gen_random_uuid(),
  destaque_id uuid not null references public.destaques_produtos_editoriais(id) on delete restrict,
  acao text not null check (acao in ('criado', 'revogado')),
  ator_admin_id uuid not null,
  ocorrido_em timestamptz not null default now(),
  detalhes_internos jsonb not null default '{}'::jsonb
);

alter table public.eventos_destaques_produtos_editoriais enable row level security;

revoke all on table public.destaques_produtos_editoriais, public.eventos_destaques_produtos_editoriais from anon, authenticated;

create or replace function public.proteger_flags_legados_destaque_produto()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  -- Chamadas PostgREST do browser usam os papéis anon/authenticated. A exceção
  -- é deliberadamente estreita para manter funções SECURITY DEFINER legadas
  -- de manutenção, incluindo a expiração compartilhada com serviços.
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and (
      coalesce(new.destaque, false)
      or new.destaque_inicio is not null
      or new.destaque_ate is not null
      or new.tipo_destaque is not null
    ) then
      raise exception 'Os destaques de produtos são definidos exclusivamente pela administração.';
    end if;

    if tg_op = 'UPDATE' and (
      new.destaque is distinct from old.destaque
      or new.destaque_inicio is distinct from old.destaque_inicio
      or new.destaque_ate is distinct from old.destaque_ate
      or new.tipo_destaque is distinct from old.tipo_destaque
    ) then
      raise exception 'Os destaques de produtos são definidos exclusivamente pela administração.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_flags_legados_destaque_produto on public.produtos;
create trigger proteger_flags_legados_destaque_produto
before insert or update of destaque, destaque_inicio, destaque_ate, tipo_destaque
on public.produtos
for each row execute function public.proteger_flags_legados_destaque_produto();

create or replace function public.criar_destaque_produto_editorial_admin(p_produto_id uuid)
returns public.destaques_produtos_editoriais
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_produto public.produtos%rowtype;
  v_inicio timestamptz := now();
  v_fim timestamptz := v_inicio + interval '7 days';
  v_posicao smallint;
  v_destaque public.destaques_produtos_editoriais%rowtype;
begin
  if not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  -- Serializa a escolha automática da menor posição livre entre Admins.
  perform pg_advisory_xact_lock(hashtextextended('destaques-produtos-editoriais', 0));

  select p.* into v_produto
  from public.produtos p
  where p.id = p_produto_id
  for update;

  if not found
    or not coalesce(v_produto.publicado, false)
    or not coalesce(v_produto.disponivel, false)
    or not public.is_vendedor_publico_aprovado(v_produto.vendedor_id)
    or not public.produto_eh_operacional_fase1(
      v_produto.categoria_id,
      v_produto.subcategoria_id,
      v_produto.provincia,
      v_produto.vendedor_id
    ) then
    raise exception 'Este produto não é elegível para destaque editorial.';
  end if;

  select s.posicao::smallint into v_posicao
  from generate_series(1, 8) as s(posicao)
  where not exists (
    select 1
    from public.destaques_produtos_editoriais d
    where d.revogado_em is null
      and d.periodo && tstzrange(v_inicio, v_fim, '[)')
      and d.posicao = s.posicao
  )
  order by s.posicao
  limit 1;

  if v_posicao is null then
    raise exception 'Não existem posições de destaque disponíveis.';
  end if;

  insert into public.destaques_produtos_editoriais (
    produto_id, vendedor_id, posicao, inicio_em, fim_em, criado_por
  ) values (
    v_produto.id, v_produto.vendedor_id, v_posicao, v_inicio, v_fim, auth.uid()
  ) returning * into v_destaque;

  insert into public.eventos_destaques_produtos_editoriais (
    destaque_id, acao, ator_admin_id
  ) values (v_destaque.id, 'criado', auth.uid());

  return v_destaque;
exception
  when exclusion_violation then
    raise exception 'O produto, vendedor ou posição já possui destaque nesse período.';
end;
$$;

create or replace function public.revogar_destaque_produto_editorial_admin(
  p_destaque_id uuid,
  p_motivo_interno text default null
)
returns public.destaques_produtos_editoriais
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_destaque public.destaques_produtos_editoriais%rowtype;
begin
  if not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  update public.destaques_produtos_editoriais
  set revogado_em = now(),
      revogado_por = auth.uid(),
      motivo_revogacao_interno = nullif(btrim(p_motivo_interno), '')
  where id = p_destaque_id
    and revogado_em is null
  returning * into v_destaque;

  if not found then
    raise exception 'Destaque não encontrado ou já revogado.';
  end if;

  insert into public.eventos_destaques_produtos_editoriais (
    destaque_id, acao, ator_admin_id, detalhes_internos
  ) values (
    v_destaque.id, 'revogado', auth.uid(),
    case when v_destaque.motivo_revogacao_interno is null then '{}'::jsonb
      else jsonb_build_object('motivo_revogacao_interno', v_destaque.motivo_revogacao_interno)
    end
  );

  return v_destaque;
end;
$$;

create or replace function public.listar_destaques_produtos_editoriais_publicos(
  p_limite integer default 8
)
returns setof jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select item
  from public.listar_produtos_publicos_fase1(
    p_ordenar_por_destaque => true,
    p_limite => least(greatest(coalesce(p_limite, 8), 1), 8)
  ) item
  where coalesce((item ->> 'destaque')::boolean, false)
  order by (item ->> 'destaque_posicao')::smallint asc,
           (item ->> 'destaque_fim_em')::timestamptz asc,
           (item ->> 'id')::uuid asc;
$$;

create or replace function public.listar_destaques_produtos_editoriais_admin()
returns setof jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'id', d.id,
    'produto_id', d.produto_id,
    'vendedor_id', d.vendedor_id,
    'posicao', d.posicao,
    'inicio_em', d.inicio_em,
    'fim_em', d.fim_em,
    'revogado_em', d.revogado_em,
    'produto', jsonb_build_object('id', p.id, 'nome_produto', p.nome_produto)
  )
  from public.destaques_produtos_editoriais d
  join public.produtos p on p.id = d.produto_id
  where public.eh_admin()
  order by d.inicio_em desc, d.id desc;
$$;

-- O histórico e os motivos permanecem privados. São expostos somente por
-- esta RPC administrativa, nunca pela projeção pública do catálogo.
create or replace function public.listar_eventos_destaque_produto_editorial_admin(
  p_destaque_id uuid
)
returns setof jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'id', e.id,
    'destaque_id', e.destaque_id,
    'acao', e.acao,
    'ator_admin_id', e.ator_admin_id,
    'ocorrido_em', e.ocorrido_em,
    'detalhes_internos', e.detalhes_internos
  )
  from public.eventos_destaques_produtos_editoriais e
  where public.eh_admin()
    and e.destaque_id = p_destaque_id
  order by e.ocorrido_em asc, e.id asc;
$$;

-- O contrato canónico do catálogo preserva todos os filtros já existentes e
-- passa a calcular o destaque ativo por join editorial no instante da leitura.
create or replace function public.listar_produtos_publicos_fase1(
  p_produto_id uuid default null,
  p_produto_ids uuid[] default null,
  p_vendedor_id uuid default null,
  p_categoria_id uuid default null,
  p_categoria_ids uuid[] default null,
  p_provincia text default null,
  p_municipio text default null,
  p_localizacao_ou boolean default false,
  p_pesquisa text default null,
  p_excluir_produto_id uuid default null,
  p_ordenar_por_destaque boolean default false,
  p_limite integer default 100
)
returns setof jsonb
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select jsonb_build_object(
    'id', p.id, 'vendedor_id', p.vendedor_id, 'categoria_id', p.categoria_id,
    'nome_produto', p.nome_produto, 'descricao', p.descricao,
    'preco_aproximado', p.preco_aproximado, 'preco_grosso', p.preco_grosso,
    'preco_promocional', p.preco_promocional, 'unidade', p.unidade,
    'tipo_venda', p.tipo_venda, 'quantidade_minima', p.quantidade_minima,
    'quantidade_minima_grosso', p.quantidade_minima_grosso, 'imagem_url', p.imagem_url,
    'disponivel', p.disponivel, 'destaque', (d.id is not null),
    'destaque_posicao', d.posicao, 'destaque_fim_em', d.fim_em,
    'provincia', p.provincia, 'municipio', p.municipio, 'subcategoria', p.subcategoria,
    'criado_em', p.criado_em, 'atualizado_em', p.atualizado_em,
    'visualizacoes', p.visualizacoes, 'cliques_whatsapp', p.cliques_whatsapp,
    'categoria', case when c.id is null then null else jsonb_build_object('id', c.id, 'nome', c.nome) end,
    'vendedor', jsonb_build_object(
      'id', v.id, 'nome_comercial', v.nome_comercial, 'descricao', v.descricao,
      'telefone_whatsapp', v.telefone_whatsapp, 'whatsapp', v.whatsapp,
      'provincia', v.provincia, 'municipio', v.municipio, 'bairro', v.bairro,
      'tipo_vendedor', v.tipo_vendedor, 'verificado', v.verificado,
      'foto_perfil', v.foto_perfil, 'entrega_disponivel', v.entrega_disponivel,
      'venda_grosso', v.venda_grosso, 'venda_retalho', v.venda_retalho, 'criado_em', v.criado_em
    )
  )
  from public.produtos p
  join public.vendedores v on v.id = p.vendedor_id
  left join public.categorias c on c.id = p.categoria_id
  left join public.destaques_produtos_editoriais d
    on d.produto_id = p.id
   and d.revogado_em is null
   and d.inicio_em <= now()
   and d.fim_em > now()
  where p.publicado = true
    and p.disponivel = true
    and public.is_vendedor_publico_aprovado(p.vendedor_id)
    and public.produto_eh_operacional_fase1(p.categoria_id, p.subcategoria_id, p.provincia, p.vendedor_id)
    and (p_produto_id is null or p.id = p_produto_id)
    and (p_produto_ids is null or cardinality(p_produto_ids) = 0 or p.id = any(p_produto_ids))
    and (p_vendedor_id is null or p.vendedor_id = p_vendedor_id)
    and (p_categoria_id is null or p.categoria_id = p_categoria_id)
    and (p_categoria_ids is null or cardinality(p_categoria_ids) = 0 or p.categoria_id = any(p_categoria_ids))
    and (p_excluir_produto_id is null or p.id <> p_excluir_produto_id)
    and (p_pesquisa is null or btrim(p_pesquisa) = '' or p.nome_produto ilike '%' || btrim(p_pesquisa) || '%')
    and (p_provincia is null or (case when p_localizacao_ou and p_municipio is not null then p.provincia ilike '%' || btrim(p_provincia) || '%' or p.municipio ilike '%' || btrim(p_municipio) || '%' else p.provincia ilike '%' || btrim(p_provincia) || '%' end))
    and (p_municipio is null or p_localizacao_ou or p.municipio ilike '%' || btrim(p_municipio) || '%')
  order by
    case when p_ordenar_por_destaque then d.id is not null else false end desc,
    case when p_ordenar_por_destaque then d.posicao end asc nulls last,
    p.criado_em desc nulls last
  limit least(greatest(coalesce(p_limite, 100), 1), 100);
$$;

-- Bloqueia o auto-destaque de produto no browser; serviços não são tocados.
revoke all on function public.destacar_produto_gratis(uuid), public.remover_destaque_produto(uuid) from public, anon, authenticated;
revoke all on function public.criar_destaque_produto_editorial_admin(uuid), public.revogar_destaque_produto_editorial_admin(uuid, text) from public, anon;
grant execute on function public.criar_destaque_produto_editorial_admin(uuid), public.revogar_destaque_produto_editorial_admin(uuid, text) to authenticated;
revoke all on function public.listar_destaques_produtos_editoriais_admin() from public, anon;
grant execute on function public.listar_destaques_produtos_editoriais_admin() to authenticated;
revoke all on function public.listar_eventos_destaque_produto_editorial_admin(uuid) from public, anon;
grant execute on function public.listar_eventos_destaque_produto_editorial_admin(uuid) to authenticated;
revoke all on function public.listar_destaques_produtos_editoriais_publicos(integer) from public;
grant execute on function public.listar_destaques_produtos_editoriais_publicos(integer), public.listar_produtos_publicos_fase1(uuid, uuid[], uuid, uuid, uuid[], text, text, boolean, text, uuid, boolean, integer) to anon, authenticated;
revoke all on function public.proteger_flags_legados_destaque_produto() from public, anon, authenticated;

commit;
