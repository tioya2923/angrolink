import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = process.cwd();
const app = readFileSync(resolve(raiz, 'src/App.tsx'), 'utf8');
const routerDashboard = readFileSync(
  resolve(raiz, 'src/paginas/dashboard/DashboardRouter.tsx'),
  'utf8',
);

describe('rota histórica de anúncio de serviço', () => {
  it('preserva a rota como entrada de compatibilidade, sem renderizar o formulário legado', () => {
    expect(app).toContain('path="/anunciar-servico"');
    expect(app).toContain('<Navigate to="/anunciar" replace />');
    expect(app).not.toContain('PaginaAnunciarServicoCompat');
    expect(existsSync(resolve(raiz, 'src/paginas/PaginaAnunciarServico.tsx'))).toBe(true);
  });

  it('mantém serviços dormentes no dashboard, sem disponibilizar formulários nesta fase', () => {
    expect(routerDashboard).toContain('path="servicos/novo"');
    expect(routerDashboard).toContain('path="servicos/editar/:id"');
    expect(routerDashboard).toContain('<Navigate to="/dashboard" replace />');
    expect(routerDashboard).not.toContain('<VendedorAdicionarServico />');
  });
});
