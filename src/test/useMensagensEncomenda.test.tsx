import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMensagensEncomenda } from '@/hooks/useMensagensEncomenda';

const mocks = vi.hoisted(() => {
  const callbacks: Array<(payload: { new: { canal?: string; atribuicao_entrega_id?: string | null } }) => void> = [];
  const canal = {
    on: vi.fn((_tipo: string, _filtro: unknown, callback: () => void) => { callbacks.push(callback); return canal; }),
    subscribe: vi.fn(),
  };
  return {
    callbacks,
    canal,
    listar: vi.fn(),
    resumo: vi.fn(),
    marcar: vi.fn(),
    enviar: vi.fn(),
    removerCanal: vi.fn(),
  };
});

vi.mock('@/services/mensagensEncomenda', () => ({
  listarMensagensEncomenda: mocks.listar,
  obterResumoMensagensEncomenda: mocks.resumo,
  marcarMensagensEncomendaComoLidas: mocks.marcar,
  enviarMensagemEncomenda: mocks.enviar,
}));

vi.mock('@/services/supabase', () => ({
  supabase: {
    channel: () => mocks.canal,
    removeChannel: mocks.removerCanal,
  },
}));

function preparar() {
  mocks.listar.mockResolvedValue({ mensagens: [], haAnteriores: false, cursorAnterior: null });
  mocks.resumo.mockResolvedValue({ totalMensagens: 1, naoLidas: 1, ultimaLeituraEm: null });
  mocks.marcar.mockResolvedValue(undefined);
  mocks.enviar.mockResolvedValue('mensagem-1');
}

describe('useMensagensEncomenda — leitura explícita', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.callbacks.splice(0); preparar(); });
  afterEach(() => { vi.useRealTimers(); });

  it('carrega mensagens e resumo sem marcar automaticamente como lidas', async () => {
    renderHook(() => useMensagensEncomenda({ encomendaId: 'enc-1', ativo: true }));
    await waitFor(() => expect(mocks.listar).toHaveBeenCalledOnce());
    expect(mocks.resumo).toHaveBeenCalledOnce();
    expect(mocks.marcar).not.toHaveBeenCalled();
  });

  it('marca explicitamente uma única vez e atualiza o resumo sem refetch das mensagens', async () => {
    const { result } = renderHook(() => useMensagensEncomenda({ encomendaId: 'enc-1', ativo: true }));
    await waitFor(() => expect(result.current.resumo?.naoLidas).toBe(1));
    await act(async () => { await result.current.marcarComoLidas(); });
    expect(mocks.marcar).toHaveBeenCalledWith('enc-1', { canal: 'comprador_vendedor', atribuicaoEntregaId: null });
    expect(mocks.listar).toHaveBeenCalledOnce();
    expect(mocks.resumo).toHaveBeenCalledTimes(2);
  });

  it('refaz a leitura autoritativa em Realtime sem marcar por si só', async () => {
    renderHook(() => useMensagensEncomenda({ encomendaId: 'enc-1', ativo: true }));
    await waitFor(() => expect(mocks.listar).toHaveBeenCalledOnce());
    expect(mocks.callbacks).toHaveLength(1);
    vi.useFakeTimers();
    await act(async () => { mocks.callbacks[0]({ new: { canal: 'comprador_vendedor', atribuicao_entrega_id: null } }); await vi.advanceTimersByTimeAsync(150); });
    expect(mocks.listar).toHaveBeenCalledTimes(2);
    expect(mocks.marcar).not.toHaveBeenCalled();
  });

  it('reinicia o contexto ao mudar canal ou atribuicao', async () => {
    const { rerender } = renderHook(
      ({ canal, atribuicaoEntregaId }) => useMensagensEncomenda({ encomendaId: 'enc-1', ativo: true, canal, atribuicaoEntregaId }),
      { initialProps: { canal: 'vendedor_entregador' as import('@/services/mensagensEncomenda').CanalMensagemEncomenda, atribuicaoEntregaId: 'atr-1' } },
    );
    await waitFor(() => expect(mocks.listar).toHaveBeenCalledWith('enc-1', null, 40, { canal: 'vendedor_entregador', atribuicaoEntregaId: 'atr-1' }));
    rerender({ canal: 'comprador_entregador', atribuicaoEntregaId: 'atr-2' });
    await waitFor(() => expect(mocks.listar).toHaveBeenLastCalledWith('enc-1', null, 40, { canal: 'comprador_entregador', atribuicaoEntregaId: 'atr-2' }));
    expect(mocks.removerCanal).toHaveBeenCalled();
  });
});
