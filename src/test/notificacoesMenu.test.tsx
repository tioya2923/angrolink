import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notificacao } from '@/services/notificacoes';

const mocks = vi.hoisted(() => ({
  abrirNotificacao: vi.fn(),
  useNotificacoesSessao: vi.fn(),
}));

vi.mock('@/contextos/NotificacoesContexto', () => ({
  useNotificacoesSessao: mocks.useNotificacoesSessao,
}));

import NotificacoesMenu from '@/componentes/NotificacoesMenu';

const agora = '2026-09-18T10:00:00.000Z';
const id = '11111111-1111-4111-8111-111111111111';

function criarNotificacao(urlDestino = `/dashboard/tarefas/${id}`): Notificacao {
  return {
    id: 'notificacao-1',
    utilizador_id: 'utilizador-1',
    contexto: 'entrega',
    tipo: 'nova_tarefa',
    titulo: 'Nova mensagem',
    mensagem: 'Recebeste uma nova mensagem.',
    entidade_tipo: 'encomenda',
    entidade_id: id,
    url_destino: urlDestino,
    lida: false,
    lida_em: null,
    metadata: {},
    criado_em: agora,
  };
}

function estado(parcial: Record<string, unknown> = {}) {
  return {
    notificacoes: [criarNotificacao()],
    naoLidas: 1,
    loading: false,
    erro: null,
    ativo: true,
    realtimeConectado: true,
    ultimaRealtime: null,
    atualizar: vi.fn().mockResolvedValue(undefined),
    marcarLida: vi.fn().mockResolvedValue(true),
    marcarTodas: vi.fn().mockResolvedValue(true),
    abrirNotificacao: mocks.abrirNotificacao,
    ...parcial,
  };
}

describe('menu de notificações', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.abrirNotificacao.mockResolvedValue(undefined);
  });

  it('mostra sino, badge e painel com contexto', () => {
    mocks.useNotificacoesSessao.mockReturnValue(estado());
    render(<NotificacoesMenu />);

    fireEvent.click(screen.getByRole('button', { name: 'Notificações: 1 não lidas' }));
    expect(screen.getByRole('heading', { name: 'Notificações' })).toBeInTheDocument();
    expect(screen.getByText('Entrega')).toBeInTheDocument();
    expect(screen.getByText('Nova mensagem')).toBeInTheDocument();
  });

  it('oculta o badge quando não há notificações não lidas e mostra estado vazio', () => {
    mocks.useNotificacoesSessao.mockReturnValue(estado({ notificacoes: [], naoLidas: 0 }));
    render(<NotificacoesMenu />);

    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));
    expect(screen.getByText('Ainda não tens notificações.')).toBeInTheDocument();
  });

  it('limita o badge a 99+', () => {
    mocks.useNotificacoesSessao.mockReturnValue(estado({ naoLidas: 120 }));
    render(<NotificacoesMenu />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('não apresenta sino quando a sessão não está elegível', () => {
    mocks.useNotificacoesSessao.mockReturnValue(estado({ ativo: false }));
    render(<NotificacoesMenu />);
    expect(screen.queryByRole('button', { name: /Notificações/ })).not.toBeInTheDocument();
  });

  it('encaminha o clique do cartão para o abridor central', async () => {
    const notificacao = criarNotificacao(`/dashboard/conversas-produtos/${id}`);
    mocks.useNotificacoesSessao.mockReturnValue(estado({ notificacoes: [notificacao] }));
    render(<NotificacoesMenu />);

    fireEvent.click(screen.getByRole('button', { name: 'Notificações: 1 não lidas' }));
    fireEvent.click(screen.getByRole('button', { name: /Nova mensagem/ }));

    await waitFor(() => expect(mocks.abrirNotificacao).toHaveBeenCalledWith(notificacao));
  });

  it('encaminha Enter e Espaço para o mesmo abridor central', async () => {
    const notificacao = criarNotificacao();
    mocks.useNotificacoesSessao.mockReturnValue(estado({ notificacoes: [notificacao] }));
    const primeiraRenderizacao = render(<NotificacoesMenu />);

    fireEvent.click(screen.getByRole('button', { name: 'Notificações: 1 não lidas' }));
    const cartao = screen.getByRole('button', { name: /Nova mensagem/ });
    fireEvent.keyDown(cartao, { key: 'Enter' });

    await waitFor(() => expect(mocks.abrirNotificacao).toHaveBeenCalledTimes(1));
    primeiraRenderizacao.unmount();

    render(<NotificacoesMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Notificações: 1 não lidas' }));
    fireEvent.keyDown(screen.getByRole('button', { name: /Nova mensagem/ }), { key: ' ' });

    await waitFor(() => expect(mocks.abrirNotificacao).toHaveBeenCalledTimes(2));
    expect(mocks.abrirNotificacao).toHaveBeenCalledWith(notificacao);
  });
});
