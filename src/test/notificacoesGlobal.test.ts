import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificacoesProvider, useNotificacoesSessao } from '@/contextos/NotificacoesContexto';
import type { ContextoNotificacao, Notificacao } from '@/services/notificacoes';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useNotificacoes: vi.fn(),
}));

vi.mock('@/contextos/AuthContexto', () => ({ useAuth: mocks.useAuth }));
vi.mock('@/hooks/useNotificacoes', () => ({ useNotificacoes: mocks.useNotificacoes }));

const ler = (caminho: string) => readFileSync(resolve(process.cwd(), caminho), 'utf8');
const app = ler('src/App.tsx');
const cabecalho = ler('src/componentes/Cabecalho.tsx');
const dashboard = ler('src/paginas/dashboard/DashboardLayout.tsx');
const provider = ler('src/contextos/NotificacoesContexto.tsx');

function estado(notificacoes: Notificacao[]) {
  return {
    notificacoes,
    naoLidas: notificacoes.filter(notificacao => !notificacao.lida).length,
    loading: false,
    erro: null,
    realtimeConectado: true,
    ultimaRealtime: null,
    atualizar: vi.fn().mockResolvedValue(undefined),
    consumirUltimaRealtime: vi.fn(),
    marcarLida: vi.fn().mockResolvedValue(true),
    marcarTodas: vi.fn().mockResolvedValue(true),
  };
}

function notificacao(contexto: ContextoNotificacao): Notificacao {
  return {
    id: `notificacao-${contexto}`,
    utilizador_id: `utilizador-${contexto}`,
    contexto,
    tipo: 'atualizacao',
    titulo: 'Atualização',
    mensagem: 'Existe uma atualização disponível.',
    entidade_tipo: 'perfil',
    entidade_id: '11111111-1111-4111-8111-111111111111',
    url_destino: null,
    lida: false,
    lida_em: null,
    metadata: {},
    criado_em: '2026-09-29T10:00:00.000Z',
  };
}

function ResumoContexto() {
  const { ativo, notificacoes } = useNotificacoesSessao();
  return createElement('output', { 'data-testid': 'contexto-notificacoes' }, `${ativo}:${notificacoes.map(item => item.contexto).join(',')}`);
}

function renderizarContexto(
  papel: 'admin' | 'cliente' | 'vendedor' | 'parceiro_entrega',
  contexto: ContextoNotificacao,
) {
  mocks.useAuth.mockReturnValue({ utilizador: { id: `utilizador-${contexto}`, papel } });
  mocks.useNotificacoes.mockReturnValue(estado([notificacao(contexto)]));
  render(
    createElement(
      MemoryRouter,
      { initialEntries: ['/dashboard'] },
      createElement(NotificacoesProvider, null, createElement(ResumoContexto)),
    ),
  );
}

describe('notificações globais', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('mantém o sino acessível em mobile e exclui apenas rotas de onboarding', () => {
    expect(cabecalho).toMatch(/md:hidden[\s\S]*<NotificacoesMenu \/>/);
    expect(provider).toContain("utilizador?.papel === 'parceiro_entrega'");
    expect(provider).toContain("'/parceiro-entregas/cadastro'");
  });

  it('entrega o contexto administrativo privado ao Admin autenticado', () => {
    renderizarContexto('admin', 'admin');

    expect(screen.getByTestId('contexto-notificacoes')).toHaveTextContent('true:admin');
    expect(mocks.useNotificacoes).toHaveBeenCalledWith('utilizador-admin', true);
  });

  it.each([
    ['cliente', 'compra'],
    ['vendedor', 'venda'],
    ['parceiro_entrega', 'entrega'],
  ] as const)('preserva o contexto privado de %s sem introduzir alertas Admin', (papel, contexto) => {
    renderizarContexto(papel, contexto);

    expect(screen.getByTestId('contexto-notificacoes')).toHaveTextContent(`true:${contexto}`);
    expect(screen.getByTestId('contexto-notificacoes')).not.toHaveTextContent('admin');
    expect(mocks.useNotificacoes).toHaveBeenCalledWith(`utilizador-${contexto}`, true);
  });
});
