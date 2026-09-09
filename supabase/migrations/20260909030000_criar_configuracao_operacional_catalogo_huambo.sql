begin;

-- Configuração territorial separada da taxonomia canónica de produtos.
alter table public.subcategorias_produto
  add constraint subcategorias_produto_id_categoria_unico unique (id, categoria_id);

create table public.configuracao_operacional_catalogo_produto (
  id uuid primary key default gen_random_uuid(),
  provincia_id uuid not null references public.provincias_angola(id),
  categoria_id uuid not null references public.categorias(id),
  subcategoria_id uuid null,
  estado text not null,
  requer_revisao_admin boolean not null default false,
  aviso_visual text null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint configuracao_operacional_catalogo_estado_check
    check (estado in ('ativa', 'experimental', 'dormente')),
  constraint configuracao_operacional_catalogo_subcategoria_categoria_fkey
    foreign key (subcategoria_id, categoria_id)
    references public.subcategorias_produto(id, categoria_id)
);

create unique index configuracao_operacional_catalogo_categoria_pai_unica_idx
  on public.configuracao_operacional_catalogo_produto (provincia_id, categoria_id)
  where subcategoria_id is null;

create unique index configuracao_operacional_catalogo_subcategoria_unica_idx
  on public.configuracao_operacional_catalogo_produto (provincia_id, categoria_id, subcategoria_id)
  where subcategoria_id is not null;

create index configuracao_operacional_catalogo_consulta_idx
  on public.configuracao_operacional_catalogo_produto (provincia_id, categoria_id, subcategoria_id);

create or replace function public.proteger_configuracao_operacional_catalogo_produto()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.categorias c
    where c.id = new.categoria_id
      and lower(btrim(c.nome)) = 'serviços'
  ) then
    raise exception 'A categoria legada de serviços não pertence ao catálogo de produtos.';
  end if;

  new.atualizado_em := now();
  return new;
end;
$$;

create trigger proteger_configuracao_operacional_catalogo_produto
before insert or update on public.configuracao_operacional_catalogo_produto
for each row execute function public.proteger_configuracao_operacional_catalogo_produto();

with novas_categorias(nome) as (
  values ('Insumos Agrícolas'), ('Máquinas e Equipamentos Agrícolas')
)
insert into public.categorias (nome)
select n.nome
from novas_categorias n
where not exists (
  select 1 from public.categorias c
  where lower(btrim(c.nome)) = lower(btrim(n.nome))
);

do $$
declare
  v_total integer;
begin
  select count(*) into v_total
  from public.categorias c
  where lower(btrim(c.nome)) in (
    'insumos agrícolas',
    'máquinas e equipamentos agrícolas'
  );
  if v_total <> 2 then
    raise exception 'As duas novas categorias canónicas de produto devem existir uma única vez.';
  end if;
end;
$$;

with sementes(categoria_nome, nome, slug, ordem_exibicao) as (
  values
    ('Insumos Agrícolas', 'Sementes', 'sementes', 10),
    ('Insumos Agrícolas', 'Fertilizantes', 'fertilizantes', 20),
    ('Insumos Agrícolas', 'Corretivos de solo', 'corretivos-de-solo', 30),
    ('Insumos Agrícolas', 'Outros insumos agrícolas simples', 'outros-insumos-agricolas-simples', 40),
    ('Máquinas e Equipamentos Agrícolas', 'Ferramentas manuais', 'ferramentas-manuais', 10),
    ('Máquinas e Equipamentos Agrícolas', 'Equipamentos de irrigação', 'equipamentos-de-irrigacao', 20),
    ('Máquinas e Equipamentos Agrícolas', 'Equipamentos de preparação do solo', 'equipamentos-de-preparacao-do-solo', 30),
    ('Máquinas e Equipamentos Agrícolas', 'Equipamentos de colheita', 'equipamentos-de-colheita', 40),
    ('Máquinas e Equipamentos Agrícolas', 'Motocultivadores', 'motocultivadores', 50),
    ('Máquinas e Equipamentos Agrícolas', 'Tratores', 'tratores', 60),
    ('Máquinas e Equipamentos Agrícolas', 'Peças e acessórios', 'pecas-e-acessorios', 70)
)
insert into public.subcategorias_produto (categoria_id, nome, slug, ordem_exibicao)
select c.id, s.nome, s.slug, s.ordem_exibicao
from sementes s
join public.categorias c on lower(btrim(c.nome)) = lower(btrim(s.categoria_nome))
on conflict (categoria_id, slug) do nothing;

do $$
declare
  v_total integer;
begin
  select count(*) into v_total
  from public.subcategorias_produto s
  join public.categorias c on c.id = s.categoria_id
  where lower(btrim(c.nome)) in ('insumos agrícolas', 'máquinas e equipamentos agrícolas');
  if v_total <> 11 then
    raise exception 'O seed das novas categorias deve conter exatamente 11 subcategorias.';
  end if;
end;
$$;

with sementes(categoria_nome, subcategoria_nome, estado) as (
  values
    ('Grãos e Cereais', null::text, 'ativa'),
    ('Alimentos', null::text, 'ativa'),
    ('Insumos Agrícolas', null::text, 'ativa'),
    ('Máquinas e Equipamentos Agrícolas', null::text, 'ativa'),
    ('Produtos Frescos', null::text, 'experimental'),
    ('Pecuária', null::text, 'dormente'),
    ('Bebidas', null::text, 'dormente'),
    ('Grãos e Cereais', 'Milho', 'ativa'),
    ('Grãos e Cereais', 'Feijão', 'ativa'),
    ('Grãos e Cereais', 'Soja', 'ativa'),
    ('Grãos e Cereais', 'Amendoim', 'ativa'),
    ('Grãos e Cereais', 'Sorgo', 'ativa'),
    ('Grãos e Cereais', 'Trigo', 'experimental'),
    ('Grãos e Cereais', 'Arroz', 'experimental'),
    ('Alimentos', 'Óleos', 'ativa'),
    ('Alimentos', 'Conservas', 'ativa'),
    ('Alimentos', 'Farinha', 'ativa'),
    ('Alimentos', 'Açúcar', 'ativa'),
    ('Alimentos', 'Sal', 'ativa'),
    ('Alimentos', 'Condimentos', 'ativa'),
    ('Alimentos', 'Massas', 'ativa'),
    ('Insumos Agrícolas', 'Sementes', 'ativa'),
    ('Insumos Agrícolas', 'Fertilizantes', 'ativa'),
    ('Insumos Agrícolas', 'Corretivos de solo', 'ativa'),
    ('Insumos Agrícolas', 'Outros insumos agrícolas simples', 'experimental'),
    ('Máquinas e Equipamentos Agrícolas', 'Ferramentas manuais', 'ativa'),
    ('Máquinas e Equipamentos Agrícolas', 'Equipamentos de irrigação', 'ativa'),
    ('Máquinas e Equipamentos Agrícolas', 'Equipamentos de preparação do solo', 'ativa'),
    ('Máquinas e Equipamentos Agrícolas', 'Equipamentos de colheita', 'experimental'),
    ('Máquinas e Equipamentos Agrícolas', 'Motocultivadores', 'experimental'),
    ('Máquinas e Equipamentos Agrícolas', 'Tratores', 'experimental'),
    ('Máquinas e Equipamentos Agrícolas', 'Peças e acessórios', 'experimental'),
    ('Produtos Frescos', 'Raízes e Tubérculos', 'experimental'),
    ('Produtos Frescos', 'Hortaliças', 'dormente'),
    ('Produtos Frescos', 'Frutas', 'dormente'),
    ('Produtos Frescos', 'Temperos', 'dormente'),
    ('Produtos Frescos', 'Folhas Verdes', 'dormente'),
    ('Produtos Frescos', 'Cogumelos', 'dormente')
), huambo as (
  select id from public.provincias_angola where codigo_oficial = 'HBO'
), resolvidas as (
  select h.id as provincia_id, c.id as categoria_id, s.id as subcategoria_id,
    sementes.estado
  from sementes
  cross join huambo h
  join public.categorias c on lower(btrim(c.nome)) = lower(btrim(sementes.categoria_nome))
  left join public.subcategorias_produto s
    on s.categoria_id = c.id
    and sementes.subcategoria_nome is not null
    and lower(btrim(s.nome)) = lower(btrim(sementes.subcategoria_nome))
)
insert into public.configuracao_operacional_catalogo_produto (provincia_id, categoria_id, subcategoria_id, estado)
select provincia_id, categoria_id, subcategoria_id, estado
from resolvidas
where subcategoria_id is not null
on conflict do nothing;

-- A query acima preserva o caso NULL da configuração-pai sem depender de
-- ON CONFLICT com NULL. Reinsere explicitamente os pais para nomes normalizados.
insert into public.configuracao_operacional_catalogo_produto (provincia_id, categoria_id, subcategoria_id, estado)
select h.id, c.id, null, p.estado
from public.provincias_angola h
cross join (values
  ('Grãos e Cereais', 'ativa'), ('Alimentos', 'ativa'),
  ('Insumos Agrícolas', 'ativa'), ('Máquinas e Equipamentos Agrícolas', 'ativa'),
  ('Produtos Frescos', 'experimental'), ('Pecuária', 'dormente'), ('Bebidas', 'dormente')
) as p(nome, estado)
join public.categorias c on lower(btrim(c.nome)) = lower(btrim(p.nome))
where h.codigo_oficial = 'HBO'
on conflict do nothing;

do $$
declare
  v_huambo uuid;
  v_total integer;
begin
  select id into v_huambo from public.provincias_angola where codigo_oficial = 'HBO';
  if v_huambo is null then raise exception 'A província canónica Huambo (HBO) é obrigatória.'; end if;
  select count(*) into v_total from public.configuracao_operacional_catalogo_produto where provincia_id = v_huambo;
  if v_total <> 38 then raise exception 'O seed operacional de Huambo deve conter exatamente 38 configurações.'; end if;
end;
$$;

create or replace function public.obter_estado_operacional_catalogo_produto(
  p_provincia_id uuid,
  p_categoria_id uuid,
  p_subcategoria_id uuid default null
)
returns table(estado text, requer_revisao_admin boolean, aviso_visual text)
language sql
stable
security definer
set search_path = public
as $$
  with subcategoria_valida as (
    select p_subcategoria_id is null or exists (
      select 1 from public.subcategorias_produto s
      where s.id = p_subcategoria_id and s.categoria_id = p_categoria_id
    ) as valida
  ), categoria_pai as (
    select c.estado, c.requer_revisao_admin, c.aviso_visual
    from public.configuracao_operacional_catalogo_produto c
    where c.provincia_id = p_provincia_id
      and c.categoria_id = p_categoria_id
      and c.subcategoria_id is null
  ), subcategoria as (
    select c.estado, c.requer_revisao_admin, c.aviso_visual
    from public.configuracao_operacional_catalogo_produto c
    where c.provincia_id = p_provincia_id
      and c.categoria_id = p_categoria_id
      and c.subcategoria_id = p_subcategoria_id
  )
  select
    case when not v.valida then 'dormente' else coalesce(s.estado, p.estado, 'dormente') end,
    case when not v.valida then false else coalesce(s.requer_revisao_admin, p.requer_revisao_admin, false) end,
    case when not v.valida then null else coalesce(s.aviso_visual, p.aviso_visual) end
  from subcategoria_valida v
  left join categoria_pai p on true
  left join subcategoria s on true;
$$;

create or replace function public.listar_categorias_produto_operacionais(p_provincia_id uuid)
returns table(categoria_id uuid, nome text, estado text, requer_revisao_admin boolean, aviso_visual text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.nome, o.estado, o.requer_revisao_admin, o.aviso_visual
  from public.configuracao_operacional_catalogo_produto o
  join public.categorias c on c.id = o.categoria_id
  where o.provincia_id = p_provincia_id
    and o.subcategoria_id is null
    and o.estado in ('ativa', 'experimental')
    and lower(btrim(c.nome)) <> 'serviços'
  order by c.nome, c.id;
$$;

create or replace function public.listar_subcategorias_produto_operacionais(
  p_provincia_id uuid,
  p_categoria_id uuid
)
returns table(subcategoria_id uuid, categoria_id uuid, nome text, slug text, ordem_exibicao integer, estado text, requer_revisao_admin boolean, aviso_visual text)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.categoria_id, s.nome, s.slug, s.ordem_exibicao,
    e.estado, e.requer_revisao_admin, e.aviso_visual
  from public.subcategorias_produto s
  cross join lateral public.obter_estado_operacional_catalogo_produto(
    p_provincia_id, s.categoria_id, s.id
  ) e
  where s.categoria_id = p_categoria_id
    and e.estado in ('ativa', 'experimental')
  order by s.ordem_exibicao, s.nome, s.id;
$$;

alter table public.configuracao_operacional_catalogo_produto enable row level security;

create policy configuracao_operacional_catalogo_admin_gerir
on public.configuracao_operacional_catalogo_produto
for all to authenticated
using (public.eh_admin())
with check (public.eh_admin());

revoke all on table public.configuracao_operacional_catalogo_produto from public, anon, authenticated;
grant select, insert, update, delete on table public.configuracao_operacional_catalogo_produto to authenticated;

revoke all on function public.proteger_configuracao_operacional_catalogo_produto() from public, anon, authenticated;
revoke all on function public.obter_estado_operacional_catalogo_produto(uuid, uuid, uuid), public.listar_categorias_produto_operacionais(uuid), public.listar_subcategorias_produto_operacionais(uuid, uuid) from public, anon, authenticated;
grant execute on function public.obter_estado_operacional_catalogo_produto(uuid, uuid, uuid), public.listar_categorias_produto_operacionais(uuid), public.listar_subcategorias_produto_operacionais(uuid, uuid) to anon, authenticated;

commit;
