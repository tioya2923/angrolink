import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260909030000_criar_configuracao_operacional_catalogo_huambo.sql',
  'utf8',
);

describe('configuração operacional do catálogo de produto no Huambo', () => {
  it('separa a configuração por província da taxonomia e protege a relação categoria/subcategoria', () => {
    expect(migration).toContain('create table public.configuracao_operacional_catalogo_produto');
    expect(migration).toContain('provincia_id uuid not null references public.provincias_angola(id)');
    expect(migration).toContain('categoria_id uuid not null references public.categorias(id)');
    expect(migration).toContain('foreign key (subcategoria_id, categoria_id)');
    expect(migration).toContain('references public.subcategorias_produto(id, categoria_id)');
    expect(migration).toContain("check (estado in ('ativa', 'experimental', 'dormente'))");
    expect(migration).toContain('configuracao_operacional_catalogo_categoria_pai_unica_idx');
    expect(migration).toContain('configuracao_operacional_catalogo_subcategoria_unica_idx');
  });

  it('resolve o estado com precedência de subcategoria e falha fechada', () => {
    expect(migration).toContain('obter_estado_operacional_catalogo_produto');
    expect(migration).toContain("coalesce(s.estado, p.estado, 'dormente')");
    expect(migration).toContain("case when not v.valida then 'dormente'");
  });

  it('semeia Huambo por código, as duas categorias novas e as onze subcategorias', () => {
    expect(migration).toContain("codigo_oficial = 'HBO'");
    expect(migration).toContain("('Insumos Agrícolas')");
    expect(migration).toContain("('Máquinas e Equipamentos Agrícolas')");
    expect(migration).toContain("if v_total <> 11 then");
    for (const subcategoria of ['Sementes', 'Fertilizantes', 'Corretivos de solo', 'Outros insumos agrícolas simples', 'Ferramentas manuais', 'Equipamentos de irrigação', 'Equipamentos de preparação do solo', 'Equipamentos de colheita', 'Motocultivadores', 'Tratores', 'Peças e acessórios']) {
      expect(migration).toContain(subcategoria);
    }
    expect(migration).toContain("if v_total <> 38 then");
  });

  it('mantém serviços fora da configuração e expõe apenas projeções operacionais', () => {
    expect(migration).toContain('proteger_configuracao_operacional_catalogo_produto');
    expect(migration).toContain('listar_categorias_produto_operacionais');
    expect(migration).toContain('listar_subcategorias_produto_operacionais');
    expect(migration).toContain("and o.estado in ('ativa', 'experimental')");
    expect(migration).toContain("lower(btrim(c.nome)) <> 'serviços'");
    expect(migration).toContain('using (public.eh_admin())');
    expect(migration).toContain('revoke all on table public.configuracao_operacional_catalogo_produto from public, anon, authenticated;');
  });

  it('não altera checkout, logística ou a policy do catálogo nesta fase', () => {
    for (const dominio of ['criar_encomenda_', 'areas_cobertura_entrega', 'catalogo_publico', 'pagamentos', 'chat', 'avaliacoes']) {
      expect(migration).not.toContain(dominio);
    }
  });
});
