import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (ficheiro: string) => readFileSync(ficheiro, 'utf8');
const sidebar = ler('src/componentes/CategoriaSidebar.tsx');
const pesquisa = ler('src/paginas/PaginaPesquisa.tsx');
const criarProduto = ler('src/paginas/PaginaCriarProduto.tsx');
const vendedorAdicionarProduto = ler('src/paginas/dashboard/vendedor/VendedorAdicionarProduto.tsx');
const servico = ler('src/services/catalogoOperacionalProduto.ts');

describe('leitura operacional da taxonomia de produtos', () => {
  it('usa as RPCs operacionais com o identificador canónico de Huambo', () => {
    expect(servico).toContain("codigoOficial === 'HBO'");
    expect(servico).toContain("'listar_categorias_produto_operacionais'");
    expect(servico).toContain("'listar_subcategorias_produto_operacionais'");
  });

  it.each([sidebar, pesquisa, criarProduto])('migra o consumidor público/operacional para categorias operacionais', fonte => {
    expect(fonte).toContain('fetchCategoriasProdutoOperacionais');
    expect(fonte).not.toContain('fetchCategorias()');
  });

  it('faz o formulário do vendedor persistir categoria e subcategoria canónicas sem apagar texto legado', () => {
    expect(vendedorAdicionarProduto).toContain('fetchCategoriasProdutoOperacionais');
    expect(vendedorAdicionarProduto).toContain('fetchSubcategoriasProdutoOperacionais');
    expect(vendedorAdicionarProduto).toContain('subcategoria_id: subcategoriaSelecionada?.id');
    expect(vendedorAdicionarProduto).toContain('subcategoriaLegada');
    expect(vendedorAdicionarProduto).not.toContain("from '@/dados/subcategorias'");
  });
});
