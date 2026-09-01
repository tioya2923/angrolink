import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = process.cwd();
const app = readFileSync(resolve(raiz, 'src/App.tsx'), 'utf8');
const routerDashboard = readFileSync(
  resolve(raiz, 'src/paginas/dashboard/DashboardRouter.tsx'),
  'utf8',
);
const produtosVendedor = readFileSync(
  resolve(raiz, 'src/paginas/dashboard/vendedor/VendedorProdutos.tsx'),
  'utf8',
);

describe('descontinuação do formulário legado de produto', () => {
  it('remove o ficheiro órfão sem rota ou import público associado', () => {
    expect(existsSync(resolve(raiz, 'src/paginas/PaginaCriarProduto.tsx'))).toBe(false);
    expect(app).not.toContain('PaginaCriarProduto');
    expect(routerDashboard).not.toContain('PaginaCriarProduto');
  });

  it('mantém criação e edição no formulário canónico do dashboard', () => {
    expect(routerDashboard).toContain('path="produtos/novo"');
    expect(routerDashboard).toContain('path="produtos/editar/:id"');
    expect(routerDashboard).toContain('<VendedorAdicionarProduto />');
    expect(produtosVendedor).toContain("navigate('/dashboard/adicionar')");
    expect(produtosVendedor).toContain('navigate(`/dashboard/produtos/editar/${produto.id}`)');
  });
});
