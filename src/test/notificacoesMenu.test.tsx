import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notificacao } from '@/services/notificacoes';

const mocks = vi.hoisted(() => ({ useNotificacoesSessao: vi.fn() }));
vi.mock('@/contextos/NotificacoesContexto', () => mocks);

import NotificacoesMenu from '@/componentes/NotificacoesMenu';

const notificacao: Notificacao = {
  id: 'n-1', utilizador_id: 'u-1', contexto: 'entrega', tipo: 'nova_tarefa',
  titulo: 'Nova entrega atribuída', mensagem: 'Tens uma nova tarefa.',
  entidade_tipo: 'atribuicao_entrega', entidade_id: 'a-1', url_destino: '/dashboard/tarefas/a-1',
  lida: false, lida_em: null, metadata: {}, criado_em: new Date().toISOString(),
};

function estado(parcial: Record<string, unknown> = {}) {
  return {
    notificacoes: [notificacao], naoLidas: 1, loading: false, erro: null, ativo: true,
    realtimeConectado: true, ultimaRealtime: null,
    atualizar: vi.fn().mockResolvedValue(undefined),
    marcarLida: vi.fn().mockResolvedValue(true),
    marcarTodas: vi.fn().mockResolvedValue(true),
    ...parcial,
  };
}

describe('menu de notificações', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mostra sino, badge e painel com contexto', () => {
    mocks.useNotificacoesSessao.mockReturnValue(estado());
    render(<MemoryRouter><NotificacoesMenu /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Notificações: 1 não lidas' }));
    expect(screen.getByRole('heading', { name: 'Notificações' })).toBeInTheDocument();
    expect(screen.getByText('Entrega')).toBeInTheDocument();
    expect(screen.getByText('Nova entrega atribuída')).toBeInTheDocument();
  });

  it('oculta o badge quando não há notificações não lidas e mostra estado vazio', () => {
    mocks.useNotificacoesSessao.mockReturnValue(estado({ notificacoes: [], naoLidas: 0 }));
    render(<MemoryRouter><NotificacoesMenu /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));
    expect(screen.getByText('Ainda não tens notificações.')).toBeInTheDocument();
  });

  it('limita o badge a 99+', () => {
    mocks.useNotificacoesSessao.mockReturnValue(estado({ naoLidas: 120 }));
    render(<MemoryRouter><NotificacoesMenu /></MemoryRouter>);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('não apresenta sino quando a sessão não está elegível', () => {
    mocks.useNotificacoesSessao.mockReturnValue(estado({ ativo: false }));
    render(<MemoryRouter><NotificacoesMenu /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /Notificações/ })).not.toBeInTheDocument();
  });
});
