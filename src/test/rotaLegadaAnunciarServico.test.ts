import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { obterDestinoAnunciarServico } from '@/dominio/rotaAnunciarServico';

const raiz = process.cwd();
const app = readFileSync(resolve(raiz, 'src/App.tsx'), 'utf8');
const routerDashboard = readFileSync(
  resolve(raiz, 'src/paginas/dashboard/DashboardRouter.tsx'),
  'utf8',
);

describe('rota histórica de anúncio de serviço', () => {
  it('preserva a rota como entrada de compatibilidade, sem renderizar o formulário legado', () => {
    expect(app).toContain('path="/anunciar-servico"');
    expect(app).toContain('<PaginaAnunciarServicoCompat />');
    expect(app).not.toContain('PaginaAnunciarServico from');
    expect(existsSync(resolve(raiz, 'src/paginas/PaginaAnunciarServico.tsx'))).toBe(false);
  });

  it('aguarda a resolução da autenticação antes de decidir o redirecionamento', () => {
    const compatibilidade = readFileSync(
      resolve(raiz, 'src/paginas/PaginaAnunciarServicoCompat.tsx'),
      'utf8',
    );

    expect(compatibilidade).toContain('if (!pronto)');
    expect(compatibilidade).toContain('A carregar sessão...');
    expect(compatibilidade).toContain('replace');
  });

  it('encaminha visitante e cliente sem perfil vendedor para o cadastro profissional', () => {
    expect(obterDestinoAnunciarServico(null)).toBe('/anunciar');
    expect(
      obterDestinoAnunciarServico({
        papel: 'cliente',
        vendedor_id: undefined,
        status_aprovacao: undefined,
        conta_ativa: true,
      }),
    ).toBe('/anunciar');
  });

  it('encaminha apenas vendedor aprovado e ativo para a criação canónica', () => {
    expect(
      obterDestinoAnunciarServico({
        papel: 'vendedor',
        vendedor_id: 'vendedor-teste',
        status_aprovacao: 'aprovado',
        conta_ativa: true,
      }),
    ).toBe('/dashboard/servicos/novo');
  });

  it('mantém vendedores pendentes ou suspensos no perfil permitido', () => {
    for (const utilizador of [
      { status_aprovacao: 'pendente' as const, conta_ativa: true },
      { status_aprovacao: 'suspenso' as const, conta_ativa: true },
    ]) {
      expect(
        obterDestinoAnunciarServico({
          papel: 'vendedor',
          vendedor_id: 'vendedor-teste',
          ...utilizador,
        }),
      ).toBe('/dashboard/perfil');
    }
  });

  it('não envia conta inativa para o dashboard, porque o AuthContexto encerra a sessão', () => {
    expect(
      obterDestinoAnunciarServico({
        papel: 'vendedor',
        vendedor_id: 'vendedor-teste',
        status_aprovacao: 'aprovado',
        conta_ativa: false,
      }),
    ).toBe('/anunciar');
  });

  it('mantém o formulário canónico de criação e edição no dashboard', () => {
    expect(routerDashboard).toContain('path="servicos/novo"');
    expect(routerDashboard).toContain('path="servicos/editar/:id"');
    expect(routerDashboard).toContain('<VendedorAdicionarServico />');
  });
});
