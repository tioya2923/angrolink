begin;

-- Fundação canónica exclusiva do marketplace de produtos. A coluna textual
-- legada public.produtos.subcategoria permanece preservada durante a migração.
create table public.subcategorias_produto (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias(id),
  nome text not null,
  slug text not null,
  ordem_exibicao integer not null,
  criado_em timestamptz not null default now(),
  constraint subcategorias_produto_categoria_slug_unico unique (categoria_id, slug),
  constraint subcategorias_produto_slug_formato_check
    check (slug = lower(btrim(slug)) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint subcategorias_produto_ordem_exibicao_check
    check (ordem_exibicao > 0)
);

-- A identidade por slug é estável; este índice evita também dois nomes que só
-- diferem por capitalização ou espaços dentro da mesma categoria.
create unique index subcategorias_produto_categoria_nome_normalizado_unico_idx
  on public.subcategorias_produto (categoria_id, lower(btrim(nome)));

alter table public.produtos
  add column subcategoria_id uuid null references public.subcategorias_produto(id);

create index produtos_subcategoria_id_idx
  on public.produtos (subcategoria_id);

do $$
declare
  v_total_categorias integer;
begin
  select count(*)
  into v_total_categorias
  from public.categorias c
  where lower(btrim(c.nome)) in (
    'produtos frescos',
    'grãos e cereais',
    'pecuária',
    'bebidas',
    'alimentos'
  );

  if v_total_categorias <> 5 then
    raise exception 'As cinco categorias legadas de produtos são necessárias para criar as subcategorias canónicas.';
  end if;
end;
$$;

with sementes (categoria_nome, nome, slug, ordem_exibicao) as (
  values
    ('Produtos Frescos', 'Hortaliças', 'hortalicas', 10),
    ('Produtos Frescos', 'Frutas', 'frutas', 20),
    ('Produtos Frescos', 'Temperos', 'temperos', 30),
    ('Produtos Frescos', 'Raízes e Tubérculos', 'raizes-e-tuberculos', 40),
    ('Produtos Frescos', 'Folhas Verdes', 'folhas-verdes', 50),
    ('Produtos Frescos', 'Cogumelos', 'cogumelos', 60),
    ('Grãos e Cereais', 'Milho', 'milho', 10),
    ('Grãos e Cereais', 'Feijão', 'feijao', 20),
    ('Grãos e Cereais', 'Arroz', 'arroz', 30),
    ('Grãos e Cereais', 'Soja', 'soja', 40),
    ('Grãos e Cereais', 'Amendoim', 'amendoim', 50),
    ('Grãos e Cereais', 'Sorgo', 'sorgo', 60),
    ('Grãos e Cereais', 'Trigo', 'trigo', 70),
    ('Pecuária', 'Aves', 'aves', 10),
    ('Pecuária', 'Gado Bovino', 'gado-bovino', 20),
    ('Pecuária', 'Gado Caprino', 'gado-caprino', 30),
    ('Pecuária', 'Gado Suíno', 'gado-suino', 40),
    ('Pecuária', 'Ovos', 'ovos', 50),
    ('Pecuária', 'Peixe', 'peixe', 60),
    ('Pecuária', 'Mariscos', 'mariscos', 70),
    ('Bebidas', 'Sumos', 'sumos', 10),
    ('Bebidas', 'Cerveja', 'cerveja', 20),
    ('Bebidas', 'Refrigerantes', 'refrigerantes', 30),
    ('Bebidas', 'Água', 'agua', 40),
    ('Bebidas', 'Bebidas Energéticas', 'bebidas-energeticas', 50),
    ('Bebidas', 'Vinhos', 'vinhos', 60),
    ('Alimentos', 'Óleos', 'oleos', 10),
    ('Alimentos', 'Conservas', 'conservas', 20),
    ('Alimentos', 'Farinha', 'farinha', 30),
    ('Alimentos', 'Açúcar', 'acucar', 40),
    ('Alimentos', 'Sal', 'sal', 50),
    ('Alimentos', 'Condimentos', 'condimentos', 60),
    ('Alimentos', 'Massas', 'massas', 70)
)
insert into public.subcategorias_produto (categoria_id, nome, slug, ordem_exibicao)
select c.id, s.nome, s.slug, s.ordem_exibicao
from sementes s
join public.categorias c
  on lower(btrim(c.nome)) = lower(btrim(s.categoria_nome))
on conflict (categoria_id, slug) do nothing;

do $$
declare
  v_total_subcategorias integer;
begin
  select count(*)
  into v_total_subcategorias
  from public.subcategorias_produto s
  join public.categorias c on c.id = s.categoria_id
  where lower(btrim(c.nome)) in (
    'produtos frescos',
    'grãos e cereais',
    'pecuária',
    'bebidas',
    'alimentos'
  );

  if v_total_subcategorias <> 33 then
    raise exception 'O seed canónico de subcategorias de produto deve conter exatamente 33 linhas.';
  end if;
end;
$$;

-- O backfill só associa um produto quando a sua categoria e o texto legado
-- coincidem inequivocamente com uma subcategoria canónica. O texto legado não
-- é alterado e qualquer valor irregular continua sem subcategoria_id.
update public.produtos p
set subcategoria_id = s.id
from public.subcategorias_produto s
where p.subcategoria_id is null
  and p.categoria_id = s.categoria_id
  and p.subcategoria is not null
  and lower(btrim(p.subcategoria)) = lower(btrim(s.nome));

alter table public.subcategorias_produto enable row level security;

create policy subcategorias_produto_leitura_publica
on public.subcategorias_produto
for select to anon, authenticated
using (true);

create policy subcategorias_produto_admin_gerir
on public.subcategorias_produto
for all to authenticated
using (public.eh_admin())
with check (public.eh_admin());

revoke all on table public.subcategorias_produto from public, anon, authenticated;
grant select on table public.subcategorias_produto to anon;
grant select, insert, update, delete on table public.subcategorias_produto to authenticated;

commit;
