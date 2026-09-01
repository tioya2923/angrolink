import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notificacao } from '@/services/notificacoes';

const mocks = vi.hoisted(() => ({
  listarNotificacoes: vi.fn(),
  contarNotificacoesNaoLidas: vi.fn(),
  marcarNotificacaoComoLida: vi.fn(),
  marcarTodasNotificacoesComoLidas: vi.fn(),
  subscreverNotificacoes: vi.fn(),
}));

vi.mock('@/services/notificacoes', () => ({
  ...mocks,
}));

import { useNotificacoes } from '@/hooks/useNotificacoes';

const notificacao: Notificacao = {
  id: 'n-1', utilizador_id: 'u-1', contexto: 'entrega', tipo: 'nova_tarefa',
  titulo: 'Nova entrega atribuída', mensagem: 'Tens uma nova tarefa.',
  entidade_tipo: 'atribuicao_entrega', entidade_id: 'a-1', url_destino: '/dashboard/tarefas/a-1',
  lida: false, lida_em: null, metadata: {}, criado_em: '2026-08-23T10:00:00.000Z',
};

describe('useNotificacoes', () => {
  let receber: ((valor: Notificacao) => void) | undefined;
  let unsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    receber = undefined;
    unsubscribe = vi.fn();
    mocks.listarNotificacoes.mockResolvedValue([notificacao]);
    mocks.contarNotificacoesNaoLidas.mockResolvedValue(1);
    mocks.marcarNotificacaoComoLida.mockResolvedValue(undefined);
    mocks.marcarTodasNotificacoesComoLidas.mockResolvedValue(undefined);
    mocks.subscreverNotificacoes.mockImplementation((_id: string, callback: unknown) => {
      receber = callback as (valor: Notificacao) => void;
      return unsubscribe;
    });
  });

  it('hidrata, recebe uma notificação sem duplicar e atualiza o contador', async () => {
    const { result } = renderHook(() => useNotificacoes('u-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notificacoes).toHaveLength(1);
    expect(result.current.naoLidas).toBe(1);

    act(() => receber?.({ ...notificacao, id: 'n-2', criado_em: '2026-08-23T11:00:00.000Z' }));
    expect(result.current.notificacoes).toHaveLength(2);
    expect(result.current.naoLidas).toBe(2);

    act(() => receber?.({ ...notificacao, id: 'n-2', criado_em: '2026-08-23T11:00:00.000Z' }));
    expect(result.current.notificacoes).toHaveLength(2);
    expect(result.current.naoLidas).toBe(2);
  });

  it('marca uma ou todas como lidas sem contador negativo e limpa a subscrição', async () => {
    const { result, unmount } = renderHook(() => useNotificacoes('u-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.marcarLida('n-1'); });
    expect(mocks.marcarNotificacaoComoLida).toHaveBeenCalledWith('n-1');
    expect(result.current.naoLidas).toBe(0);

    await act(async () => { await result.current.marcarTodas(); });
    expect(mocks.marcarTodasNotificacoesComoLidas).toHaveBeenCalledTimes(1);
    expect(result.current.naoLidas).toBe(0);

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
