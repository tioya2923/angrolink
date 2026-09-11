import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MensagensEncomenda } from '@/componentes/encomendas/MensagensEncomenda';

const mocks = vi.hoisted(() => ({
  enviar: vi.fn(),
  carregar: vi.fn(),
  carregarAnteriores: vi.fn(),
  marcarComoLidas: vi.fn(),
  hook: {} as Record<string, unknown>,
}));

vi.mock('@/contextos/AuthContexto', () => ({ useAuth: () => ({ utilizador: { id: 'utilizador-atual' } }) }));
vi.mock('@/hooks/useMensagensEncomenda', () => ({ useMensagensEncomenda: () => mocks.hook }));

function preparar(overrides: Record<string, unknown> = {}) {
  mocks.hook = {
    mensagens: [], resumo: { naoLidas: 0 }, aCarregar: false, aCarregarAnteriores: false,
    aEnviar: false, erro: null, haAnteriores: false,
    enviar: mocks.enviar, carregar: mocks.carregar, carregarAnteriores: mocks.carregarAnteriores, marcarComoLidas: mocks.marcarComoLidas,
    ...overrides,
  };
}

describe('MensagensEncomenda', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); preparar(); });

  it('não marca no mount fora da viewport, marca apenas quando visível e limpa o observer', async () => {
    const observers: Array<{ callback: IntersectionObserverCallback; disconnect: ReturnType<typeof vi.fn> }> = [];
    const IntersectionObserverOriginal = globalThis.IntersectionObserver;
    class IntersectionObserverMock {
      callback: IntersectionObserverCallback;
      disconnect = vi.fn();
      constructor(callback: IntersectionObserverCallback) { this.callback = callback; observers.push(this); }
      observe = vi.fn();
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = '';
      thresholds = [0.25];
    }
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
    preparar({ resumo: { naoLidas: 2 } });
    const tela = render(<MensagensEncomenda encomendaId="enc-1" estadoEncomenda="aceite" />);
    expect(mocks.marcarComoLidas).not.toHaveBeenCalled();
    await act(async () => { observers[0].callback([{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry], {} as IntersectionObserver); });
    expect(mocks.marcarComoLidas).not.toHaveBeenCalled();
    await act(async () => { observers[0].callback([{ isIntersecting: true, intersectionRatio: 0.3 } as IntersectionObserverEntry], {} as IntersectionObserver); });
    expect(mocks.marcarComoLidas).toHaveBeenCalledOnce();
    tela.unmount();
    expect(observers[0].disconnect).toHaveBeenCalledOnce();
    vi.stubGlobal('IntersectionObserver', IntersectionObserverOriginal);
  });

  it('não chama marcação quando a secção está visível mas não existem não lidas', async () => {
    const observers: Array<{ callback: IntersectionObserverCallback }> = [];
    class IntersectionObserverMock {
      callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) { this.callback = callback; observers.push(this); }
      observe = vi.fn(); disconnect = vi.fn(); unobserve = vi.fn(); takeRecords = vi.fn(() => []);
      root = null; rootMargin = ''; thresholds = [0.25];
    }
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
    preparar({ resumo: { naoLidas: 0 } });
    render(<MensagensEncomenda encomendaId="enc-1" estadoEncomenda="aceite" />);
    await act(async () => { observers[0].callback([{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry], {} as IntersectionObserver); });
    expect(mocks.marcarComoLidas).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('mostra loading, vazio e erro com retry sem expor HTML como markup', () => {
    preparar({ aCarregar: true });
    const tela = render(<MensagensEncomenda encomendaId="enc-1" estadoEncomenda="aceite" />);
    expect(screen.getByRole('status')).toHaveTextContent('A carregar mensagens');
    preparar({ erro: 'Não foi possível carregar as mensagens.', mensagens: [{ id: 'm-1', encomendaId: 'enc-1', remetenteUserId: 'outro', corpo: '<b>texto</b>', criadoEm: '2026-09-11T10:00:00Z' }] });
    tela.rerender(<MensagensEncomenda encomendaId="enc-1" estadoEncomenda="aceite" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar as mensagens.');
    expect(screen.getByText('<b>texto</b>')).toBeInTheDocument();
    expect(document.querySelector('b')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(mocks.carregar).toHaveBeenCalledOnce();
  });

  it('envia texto e impede novo clique enquanto o envio está em curso', async () => {
    mocks.enviar.mockResolvedValue(true);
    preparar();
    render(<MensagensEncomenda encomendaId="enc-1" estadoEncomenda="aceite" />);
    const campo = screen.getByRole('textbox', { name: 'Nova mensagem' });
    fireEvent.change(campo, { target: { value: 'Mensagem segura' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Enviar' })); });
    expect(mocks.enviar).toHaveBeenCalledWith('Mensagem segura');

    preparar({ aEnviar: true });
    render(<MensagensEncomenda encomendaId="enc-2" estadoEncomenda="aceite" />);
    expect(screen.getAllByRole('button', { name: 'A enviar…' }).at(-1)).toBeDisabled();
  });

  it('carrega anteriores e preserva o histórico, mas remove composer em terminal', () => {
    preparar({
      haAnteriores: true,
      mensagens: [{ id: 'm-1', encomendaId: 'enc-1', remetenteUserId: 'outro', corpo: 'Histórico preservado', criadoEm: '2026-09-11T10:00:00Z' }],
    });
    const tela = render(<MensagensEncomenda encomendaId="enc-1" estadoEncomenda="aceite" />);
    fireEvent.click(screen.getByRole('button', { name: 'Carregar anteriores' }));
    expect(mocks.carregarAnteriores).toHaveBeenCalledOnce();
    tela.rerender(<MensagensEncomenda encomendaId="enc-1" estadoEncomenda="concluida" />);
    expect(screen.getByText('Histórico preservado')).toBeInTheDocument();
    expect(screen.getByText('Esta encomenda está encerrada. O histórico de mensagens continua disponível.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Nova mensagem' })).toBeNull();
  });
});
