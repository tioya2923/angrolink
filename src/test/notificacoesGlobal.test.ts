import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (caminho: string) => readFileSync(resolve(process.cwd(), caminho), 'utf8');
const app = ler('src/App.tsx');
const cabecalho = ler('src/componentes/Cabecalho.tsx');
const dashboard = ler('src/paginas/dashboard/DashboardLayout.tsx');
const provider = ler('src/contextos/NotificacoesContexto.tsx');

describe('notificações globais', () => {
  it('mantém uma única fonte de estado acima das rotas', () => {
    expect(app).toContain('<NotificacoesProvider>');
    expect(app).toContain('<BrowserRouter>');
    expect(provider).toContain('useNotificacoes(utilizador?.id, ativo)');
    expect(provider).toContain("'/login'");
  });

  it('reutiliza o mesmo sino no cabeçalho público e no dashboard sem montar o hook', () => {
    expect(cabecalho).toContain('<NotificacoesMenu />');
    expect(dashboard).toContain('<NotificacoesMenu />');
    expect(cabecalho).not.toContain('useNotificacoes(');
    expect(dashboard).not.toContain('useNotificacoes(');
  });

  it('mantém o sino acessível em mobile e não habilita notificações para admin/onboarding', () => {
    expect(cabecalho).toMatch(/md:hidden[\s\S]*<NotificacoesMenu \/>/);
    expect(provider).toContain("utilizador?.papel === 'parceiro_entrega'");
    expect(provider).not.toContain("utilizador?.papel === 'admin'");
    expect(provider).toContain("'/parceiro-entregas/cadastro'");
  });
});
