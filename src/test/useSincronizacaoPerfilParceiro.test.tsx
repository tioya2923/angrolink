import { act, render, renderHook, waitFor } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EVENTO_SINCRONIZAR_PERFIL_PARCEIRO,
  useSincronizacaoPerfilParceiro,
} from '@/hooks/useSincronizacaoPerfilParceiro';
import { parceiroPodeAcederAreaOperacional } from '@/lib/acessoParceiroEntrega';

const mocks = vi.hoisted(() => {
  const callbacks: Array<(evento: { new: { atualizado_em?: string } }) => void> = [];
  let callbackEstado: ((estado: string) => void) | undefined;
  const canal = {
    on: vi.fn((_tipo: string, _filtro: unknown, callback: (evento: { new: { atualizado_em?: string } }) => void) => {
      callbacks.push(callback);
      return canal;
    }),
    subscribe: vi.fn((callback: (estado: string) => void) => {
      callbackEstado = callback;
      return canal;
    }),
  };

  return {
    callbacks,
    canal,
    obterCallbackEstado: () => callbackEstado,
    channel: vi.fn(() => canal),
    removerCanal: vi.fn(),
  };
});

vi.mock('@/services/supabase', () => ({
  supabase: {
    channel: mocks.channel,
    removeChannel: mocks.removerCanal,
  },
}));

const parceiro = (id = 'parceiro-1') => ({ id, papel: 'parceiro_entrega' as const });

function SessaoParceiroMontada() {
  const [estado, setEstado] = useState<'suspenso' | 'aprovado'>('suspenso');
  const recarregar = useCallback(async () => {
    setEstado('aprovado');
    return true;
  }, []);
  const sincronizando = useSincronizacaoPerfilParceiro(parceiro(), recarregar);
  const operacional = parceiroPodeAcederAreaOperacional(estado);

  return <output data-testid="acesso-parceiro">{`${sincronizando ? 'a-sincronizar' : estado}:${operacional ? 'menu-e-rota-operacionais' : 'menu-e-rota-restritos'}`}</output>;
}

describe('useSincronizacaoPerfilParceiro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.callbacks.splice(0);
  });

  it('assina apenas o parceiro autenticado e recarrega na subscricao', async () => {
    const recarregar = vi.fn().mockResolvedValue(true);
    renderHook(() => useSincronizacaoPerfilParceiro(parceiro(), recarregar));

    expect(mocks.channel).toHaveBeenCalledWith('perfil-parceiro-entrega-parceiro-1');
    expect(mocks.canal.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'parceiros_entrega', filter: 'user_id=eq.parceiro-1' }),
      expect.any(Function),
    );

    act(() => mocks.obterCallbackEstado()?.('SUBSCRIBED'));
    await waitFor(() => expect(recarregar).toHaveBeenCalledOnce());
  });

  it.each(['aprovado', 'rejeitado', 'suspenso', 'em_analise'])('recarrega uma vez para a transicao %s', async (_estado) => {
    const recarregar = vi.fn().mockResolvedValue(true);
    renderHook(() => useSincronizacaoPerfilParceiro(parceiro(), recarregar));

    act(() => mocks.callbacks[0]({ new: { atualizado_em: `${_estado}-1` } }));
    await waitFor(() => expect(recarregar).toHaveBeenCalledOnce());
  });

  it('deduplica o mesmo evento e nao cria um ciclo de refetch', async () => {
    const recarregar = vi.fn().mockResolvedValue(true);
    renderHook(() => useSincronizacaoPerfilParceiro(parceiro(), recarregar));

    act(() => {
      mocks.callbacks[0]({ new: { atualizado_em: '2026-09-25T10:00:00Z' } });
      mocks.callbacks[0]({ new: { atualizado_em: '2026-09-25T10:00:00Z' } });
    });
    await waitFor(() => expect(recarregar).toHaveBeenCalledOnce());
  });

  it('nao perde uma aprovacao recebida enquanto a recarga anterior ainda esta em curso', async () => {
    let concluirPrimeira: ((valor: boolean) => void) | undefined;
    let concluirSegunda: ((valor: boolean) => void) | undefined;
    const recarregar = vi
      .fn()
      .mockImplementationOnce(() => new Promise<boolean>(resolve => { concluirPrimeira = resolve; }))
      .mockImplementationOnce(() => new Promise<boolean>(resolve => { concluirSegunda = resolve; }));
    const { result } = renderHook(() => useSincronizacaoPerfilParceiro(parceiro(), recarregar));

    act(() => mocks.obterCallbackEstado()?.('SUBSCRIBED'));
    await waitFor(() => expect(recarregar).toHaveBeenCalledOnce());

    act(() => mocks.callbacks[0]({ new: { atualizado_em: 'aprovado-apos-leitura-antiga' } }));
    expect(recarregar).toHaveBeenCalledOnce();

    act(() => concluirPrimeira?.(true));
    await waitFor(() => expect(recarregar).toHaveBeenCalledTimes(2));
    act(() => concluirSegunda?.(true));
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('atualiza menu e rota operacionais apos aprovacao sem remontar a sessao', async () => {
    const { getByTestId } = render(<SessaoParceiroMontada />);

    expect(getByTestId('acesso-parceiro')).toHaveTextContent('suspenso:menu-e-rota-restritos');
    act(() => mocks.callbacks[0]({ new: { atualizado_em: 'aprovacao-sem-reinicio' } }));

    await waitFor(() => expect(getByTestId('acesso-parceiro')).toHaveTextContent('aprovado:menu-e-rota-operacionais'));
  });

  it('processa a aprovacao encaminhada pelo canal global sem foco, visibilidade ou remontagem', async () => {
    const { getByTestId } = render(<SessaoParceiroMontada />);

    expect(getByTestId('acesso-parceiro')).toHaveTextContent('suspenso:menu-e-rota-restritos');
    act(() => window.dispatchEvent(new Event(EVENTO_SINCRONIZAR_PERFIL_PARCEIRO)));

    await waitFor(() => expect(getByTestId('acesso-parceiro')).toHaveTextContent('aprovado:menu-e-rota-operacionais'));
  });

  it('reconsulta no regresso da aplicacao e quando a ligacao volta', async () => {
    const recarregar = vi.fn().mockResolvedValue(true);
    renderHook(() => useSincronizacaoPerfilParceiro(parceiro(), recarregar));

    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(recarregar).toHaveBeenCalledOnce());
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(recarregar).toHaveBeenCalledTimes(2));
    act(() => window.dispatchEvent(new Event('pageshow')));
    await waitFor(() => expect(recarregar).toHaveBeenCalledTimes(3));
  });

  it('limpa o canal antigo ao mudar de conta e ignora o parceiro nao autenticado', () => {
    const recarregar = vi.fn().mockResolvedValue(true);
    const { rerender } = renderHook(
      ({ perfil }) => useSincronizacaoPerfilParceiro(perfil, recarregar),
      { initialProps: { perfil: parceiro('parceiro-1') } },
    );

    rerender({ perfil: parceiro('parceiro-2') });
    expect(mocks.removerCanal).toHaveBeenCalledTimes(1);
    expect(mocks.channel).toHaveBeenLastCalledWith('perfil-parceiro-entrega-parceiro-2');

    rerender({ perfil: { id: 'cliente-1', papel: 'cliente' as const } });
    expect(mocks.removerCanal).toHaveBeenCalledTimes(2);
  });

  it('nao aplica a conclusao pendente do parceiro anterior depois da troca de conta', async () => {
    let concluir: ((valor: boolean) => void) | undefined;
    const recarregar = vi.fn().mockImplementation(() => new Promise<boolean>((resolve) => {
      concluir = resolve;
    }));
    const { result, rerender } = renderHook(
      ({ perfil }) => useSincronizacaoPerfilParceiro(perfil, recarregar),
      { initialProps: { perfil: parceiro('parceiro-1') } },
    );

    act(() => mocks.callbacks[0]({ new: { atualizado_em: 'primeiro' } }));
    expect(result.current).toBe(true);
    rerender({ perfil: parceiro('parceiro-2') });
    act(() => concluir?.(true));

    await waitFor(() => expect(result.current).toBe(false));
    expect(mocks.removerCanal).toHaveBeenCalled();
  });

  it('liberta o estado de sincronizacao depois de uma falha de refetch', async () => {
    const recarregar = vi.fn().mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useSincronizacaoPerfilParceiro(parceiro(), recarregar));

    act(() => mocks.obterCallbackEstado()?.('SUBSCRIBED'));
    await waitFor(() => expect(recarregar).toHaveBeenCalledOnce());
    await waitFor(() => expect(result.current).toBe(false));
  });
});
