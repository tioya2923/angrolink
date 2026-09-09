import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260909020000_criar_subcategorias_produto_canonicas.sql',
  'utf8',
);

const paginaCriarProduto = readFileSync(
  'src/paginas/PaginaCriarProduto.tsx',
  'utf8',
);

describe('fundação canónica de subcategorias de produto', () => {
  it('cria a tabela canónica exclusiva de produtos com identidade estável', () => {
    expect(migration).toContain('create table public.subcategorias_produto');
    expect(migration).toContain('categoria_id uuid not null references public.categorias(id)');
    expect(migration).toContain('constraint subcategorias_produto_categoria_slug_unico unique (categoria_id, slug)');
    expect(migration).toContain('subcategorias_produto_categoria_nome_normalizado_unico_idx');
  });

  it('adiciona a FK nullable sem remover a subcategoria textual legada', () => {
    expect(migration).toContain('add column subcategoria_id uuid null references public.subcategorias_produto(id)');
    expect(migration).not.toMatch(/drop column\s+subcategoria\b/i);
    expect(migration).not.toMatch(/alter column\s+subcategoria\s+set not null/i);
  });

  it('semeia as 33 subcategorias de produto, sem serviços ou categorias futuras', () => {
    const valores = migration.match(/^\s*\('(?:Produtos Frescos|Grãos e Cereais|Pecuária|Bebidas|Alimentos)',/gm) ?? [];
    expect(valores).toHaveLength(33);
    expect(migration).toContain("if v_total_subcategorias <> 33 then");
    expect(migration).not.toMatch(/\('Serviços'|servicos\)/i);
    expect(migration).not.toContain('Insumos Agrícolas');
    expect(migration).not.toContain('Máquinas e Equipamentos Agrícolas');
  });

  it('faz backfill conservador sem modificar o texto legado', () => {
    const backfill = migration.slice(
      migration.indexOf('update public.produtos p'),
      migration.indexOf('alter table public.subcategorias_produto enable row level security;'),
    );
    expect(backfill).toContain('p.subcategoria_id is null');
    expect(backfill).toContain('p.categoria_id = s.categoria_id');
    expect(backfill).toContain('lower(btrim(p.subcategoria)) = lower(btrim(s.nome))');
    expect(backfill).not.toMatch(/set\s+subcategoria\s*=/i);
  });

  it('mantém leitura necessária e restringe escrita à gestão administrativa', () => {
    expect(migration).toContain('alter table public.subcategorias_produto enable row level security;');
    expect(migration).toContain('create policy subcategorias_produto_leitura_publica');
    expect(migration).toContain('for select to anon, authenticated');
    expect(migration).toContain('create policy subcategorias_produto_admin_gerir');
    expect(migration).toContain('using (public.eh_admin())');
    expect(migration).toContain('with check (public.eh_admin());');
    expect(migration).toContain('revoke all on table public.subcategorias_produto from public, anon, authenticated;');
  });

  it('delega a exclusão de serviços ao contrato operacional no formulário genérico', () => {
    expect(paginaCriarProduto).toContain('fetchCategoriasProdutoOperacionais');
    expect(paginaCriarProduto).not.toContain('fetchCategorias()');
  });

  it('não altera checkout ou logística nesta fundação', () => {
    for (const dominio of ['criar_encomenda_', 'encomendas', 'pagamentos', 'parceiros_entrega', 'areas_cobertura_entrega']) {
      expect(migration).not.toContain(dominio);
    }
  });
});
