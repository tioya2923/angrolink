import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AtualizacoesTempoReal from '@/componentes/AtualizacoesTempoReal';
import { EVENTO_SINCRONIZAR_PERFIL_PARCEIRO } from '@/hooks/useSincronizacaoPerfilParceiro';

const mocks = vi.hoisted(() => {
  let callback: ((payload: {
    table: string;
    eventType: 'UPDATE';
    new: Record<string, unknown>;
    old: Record<string, unknown>;
  }) => void) | undefined;
  const canal = {
    on: vi.fn((_tipo: string, _filtro: unknown, proximoCallback: typeof callback) => {
      callback = proximoCallback;
      return canal;
    }),
    subscribe: vi.fn(() => canal),
  };

  return {
    canal,
    channel: vi.fn(() => canal),
    removerCanal: vi.fn(),
    obterCallback: () => callback,
    useAuth: vi.fn(),
  };
});

vi.mock('@/services/supabase', () => ({
  supabase: {
    channel: mocks.channel,
    removeChannel: mocks.removerCanal,
  },
}));

vi.mock('@/contextos/AuthContexto', () => ({ useAuth: mocks.useAuth }));

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AtualizacoesTempoReal><div>sessao montada</div></AtualizacoesTempoReal>
    </QueryClientProvider>,
  );
}

describe('AtualizacoesTempoReal para parceiro de entrega', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({
      utilizador: { id: 'parceiro-1', papel: 'parceiro_entrega' },
      recarregarPerfil: vi.fn().mockResolvedValue(true),
    });
  });

  it('encaminha a aprovacao do proprio parceiro ao unico coordenador de recarga', async () => {
    const recarregarPerfil = vi.fn().mockResolvedValue(true);
    mocks.useAuth.mockReturnValue({
      utilizador: { id: 'parceiro-1', papel: 'parceiro_entrega' },
      recarregarPerfil,
    });
    const receber = vi.fn();
    window.addEventListener(EVENTO_SINCRONIZAR_PERFIL_PARCEIRO, receber);
    renderizar();

    act(() => mocks.obterCallback()?.({
      table: 'parceiros_entrega',
      eventType: 'UPDATE',
      new: { user_id: 'parceiro-1', estado: 'aprovado' },
      old: { user_id: 'parceiro-1', estado: 'suspenso' },
    }));

    await waitFor(() => expect(receber).toHaveBeenCalledOnce());
    expect(recarregarPerfil).not.toHaveBeenCalled();
    window.removeEventListener(EVENTO_SINCRONIZAR_PERFIL_PARCEIRO, receber);
  });

  it('nao reconsulta a sessao do parceiro para atualizacao de outra conta', async () => {
    const recarregarPerfil = vi.fn().mockResolvedValue(true);
    mocks.useAuth.mockReturnValue({
      utilizador: { id: 'parceiro-1', papel: 'parceiro_entrega' },
      recarregarPerfil,
    });
    renderizar();

    act(() => mocks.obterCallback()?.({
      table: 'parceiros_entrega',
      eventType: 'UPDATE',
      new: { user_id: 'outro-parceiro', estado: 'aprovado' },
      old: { user_id: 'outro-parceiro', estado: 'suspenso' },
    }));

    await Promise.resolve();
    expect(recarregarPerfil).not.toHaveBeenCalled();
  });
});
