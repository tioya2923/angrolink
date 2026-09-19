import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificacoesMenu from '@/componentes/NotificacoesMenu';
import { NotificacoesProvider, useNotificacoesSessao } from '@/contextos/NotificacoesContexto';
import type { Notificacao } from '@/services/notificacoes';

const mocks = vi.hoisted(() => ({
  consumirUltimaRealtime: vi.fn(),
  dismiss: vi.fn(),
  marcarLida: vi.fn(),
  toast: vi.fn(),
  useAuth: vi.fn(),
  useNotificacoes: vi.fn(),
}));

vi.mock('@/contextos/AuthContexto', () => ({ useAuth: mocks.useAuth }));
vi.mock('@/hooks/useNotificacoes', () => ({ useNotificacoes: mocks.useNotificacoes }));
vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }));

const id = '11111111-1111-4111-8111-111111111111';

function criarNotificacao(urlDestino: string | null, idNotificacao = 'notificacao-1'): Notificacao {
  return {
    id: idNotificacao,
    utilizador_id: 'utilizador-1',
    contexto: 'compra',
    tipo: 'mensagem_pre_compra',
    titulo: 'Nova mensagem',
    mensagem: 'Recebeste uma nova mensagem.',
    entidade_tipo: 'conversa_pre_compra',
    entidade_id: id,
    url_destino: urlDestino,
    lida: false,
    lida_em: null,
    metadata: {},
    criado_em: '2026-09-18T10:00:00.000Z',
  };
}

function estado(ultimaRealtime: Notificacao | null) {
  return {
    notificacoes: ultimaRealtime ? [ultimaRealtime] : [],
    naoLidas: ultimaRealtime ? 1 : 0,
    loading: false,
    erro: null,
    realtimeConectado: true,
    ultimaRealtime,
    atualizar: vi.fn().mockResolvedValue(undefined),
    consumirUltimaRealtime: mocks.consumirUltimaRealtime,
    marcarLida: mocks.marcarLida,
    marcarTodas: vi.fn().mockResolvedValue(true),
  };
}

function Localizacao() {
  const localizacao = useLocation();
  return <output data-testid="localizacao">{localizacao.pathname}</output>;
}

function AbrirPorContexto({ notificacao }: { notificacao: Notificacao }) {
  const { abrirNotificacao } = useNotificacoesSessao();
  return <button type="button" onClick={() => void abrirNotificacao(notificacao)}>Abrir notificação</button>;
}

function renderizar(notificacao: Notificacao | null) {
  mocks.useNotificacoes.mockReturnValue(estado(notificacao));
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <NotificacoesProvider>
        <NotificacoesMenu />
        <NotificacoesMenu />
        <NotificacoesMenu />
        {notificacao && <AbrirPorContexto notificacao={notificacao} />}
        <Localizacao />
      </NotificacoesProvider>
    </MemoryRouter>,
  );
}

describe('provider de notificações', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dismiss.mockReset();
    mocks.toast.mockReturnValue({ dismiss: mocks.dismiss });
    mocks.marcarLida.mockResolvedValue(true);
    mocks.useAuth.mockReturnValue({ utilizador: { id: 'utilizador-1', papel: 'cliente' } });
  });

  it('emite um único toast e consome o evento mesmo com três menus visuais', async () => {
    const notificacao = criarNotificacao(`/dashboard/conversas-produtos/${id}`);
    const { rerender } = renderizar(notificacao);

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    expect(mocks.consumirUltimaRealtime).toHaveBeenCalledWith(notificacao.id);
    mocks.useNotificacoes.mockReturnValue(estado({ ...notificacao }));
    rerender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NotificacoesProvider><NotificacoesMenu /><NotificacoesMenu /><NotificacoesMenu /><Localizacao /></NotificacoesProvider>
      </MemoryRouter>,
    );

    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it('emite um toast para cada ID distinto', async () => {
    const primeira = criarNotificacao(`/dashboard/conversas-produtos/${id}`, 'notificacao-1');
    const segunda = criarNotificacao(`/dashboard/conversas-produtos/${id}`, 'notificacao-2');
    const { rerender } = renderizar(primeira);

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    mocks.useNotificacoes.mockReturnValue(estado(segunda));
    rerender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NotificacoesProvider><NotificacoesMenu /><Localizacao /></NotificacoesProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(2));
  });

  it.each([
    `/dashboard/conversas-produtos/${id}`,
    `/dashboard/mensagens/pre-compra/${id}`,
    `/dashboard/compras/${id}`,
    `/dashboard/encomendas/${id}`,
    `/dashboard/tarefas/${id}`,
  ])('abre explicitamente o destino interno permitido: %s', async urlDestino => {
    const notificacao = criarNotificacao(urlDestino);
    renderizar(notificacao);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir notificação' }));

    await waitFor(() => expect(screen.getByTestId('localizacao')).toHaveTextContent(urlDestino));
    expect(mocks.marcarLida).toHaveBeenCalledWith(notificacao.id);
    expect(mocks.dismiss).toHaveBeenCalled();
  });

  it('não navega quando o toast é fechado e não navega automaticamente ao renderizar', async () => {
    const notificacao = criarNotificacao(`/dashboard/conversas-produtos/${id}`);
    renderizar(notificacao);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    const parametros = mocks.toast.mock.calls[0]?.[0] as { onClick: (evento: { target: EventTarget | null }) => void };
    const fechar = document.createElement('button');
    fechar.setAttribute('toast-close', '');

    act(() => parametros.onClick({ target: fechar }));

    expect(screen.getByTestId('localizacao')).toHaveTextContent('/dashboard');
    expect(mocks.marcarLida).not.toHaveBeenCalled();
  });

  it('não recria o toast fechado quando o mesmo evento é entregue depois do remount', async () => {
    const notificacao = criarNotificacao(`/dashboard/conversas-produtos/${id}`);
    const { rerender } = renderizar(notificacao);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    const parametros = mocks.toast.mock.calls[0]?.[0] as { onClick: (evento: { target: EventTarget | null }) => void };
    const fechar = document.createElement('button');
    fechar.setAttribute('toast-close', '');
    act(() => parametros.onClick({ target: fechar }));

    mocks.useNotificacoes.mockReturnValue(estado({ ...notificacao }));
    rerender(
      <MemoryRouter initialEntries={['/dashboard/outra-aba']}>
        <NotificacoesProvider><NotificacoesMenu /><Localizacao /></NotificacoesProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('localizacao')).toHaveTextContent('/dashboard');
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.marcarLida).not.toHaveBeenCalled();
  });

  it('navega uma única vez por clique no toast', async () => {
    const notificacao = criarNotificacao(`/dashboard/encomendas/${id}`);
    renderizar(notificacao);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    const parametros = mocks.toast.mock.calls[0]?.[0] as { onClick: (evento: { target: EventTarget | null }) => void };
    const alvo = document.createElement('div');

    act(() => {
      parametros.onClick({ target: alvo });
      parametros.onClick({ target: alvo });
    });

    await waitFor(() => expect(screen.getByTestId('localizacao')).toHaveTextContent(`/dashboard/encomendas/${id}`));
    expect(mocks.marcarLida).toHaveBeenCalledTimes(1);
  });

  it('navega uma única vez por Enter no toast', async () => {
    const notificacao = criarNotificacao(`/dashboard/compras/${id}`);
    renderizar(notificacao);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    const parametros = mocks.toast.mock.calls[0]?.[0] as { onKeyDown: (evento: { key: string; preventDefault: () => void }) => void };

    act(() => parametros.onKeyDown({ key: 'Enter', preventDefault: vi.fn() }));

    await waitFor(() => expect(screen.getByTestId('localizacao')).toHaveTextContent(`/dashboard/compras/${id}`));
    expect(mocks.marcarLida).toHaveBeenCalledTimes(1);
  });

  it('navega uma única vez por Espaço no toast', async () => {
    const notificacao = criarNotificacao(`/dashboard/tarefas/${id}`);
    renderizar(notificacao);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    const parametros = mocks.toast.mock.calls[0]?.[0] as { onKeyDown: (evento: { key: string; preventDefault: () => void }) => void };

    act(() => parametros.onKeyDown({ key: ' ', preventDefault: vi.fn() }));

    await waitFor(() => expect(screen.getByTestId('localizacao')).toHaveTextContent(`/dashboard/tarefas/${id}`));
    expect(mocks.marcarLida).toHaveBeenCalledTimes(1);
  });

  it('usa fallback seguro somente após abertura explícita de destino inválido', async () => {
    const notificacao = criarNotificacao('https://externo.test');
    renderizar(notificacao);

    expect(screen.getByTestId('localizacao')).toHaveTextContent('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir notificação' }));

    await waitFor(() => expect(mocks.marcarLida).toHaveBeenCalledWith(notificacao.id));
    expect(screen.getByTestId('localizacao')).toHaveTextContent('/dashboard');
  });

  it('faz o cartão da central usar o mesmo fallback seguro para destino inválido', async () => {
    const notificacao = criarNotificacao(`/dashboard/desconhecido/${id}`);
    renderizar(notificacao);

    fireEvent.click(screen.getAllByRole('button', { name: 'Notificações: 1 não lidas' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: /Nova mensagem/ }));

    await waitFor(() => expect(mocks.marcarLida).toHaveBeenCalledWith(notificacao.id));
    expect(screen.getByTestId('localizacao')).toHaveTextContent('/dashboard');
  });

  it('não navega sem destino, só usa fallback na ação explícita e não entra em ciclo', async () => {
    const notificacao = criarNotificacao(null);
    const { rerender } = renderizar(notificacao);

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('localizacao')).toHaveTextContent('/dashboard');
    mocks.useNotificacoes.mockReturnValue(estado({ ...notificacao }));
    rerender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NotificacoesProvider><NotificacoesMenu /><AbrirPorContexto notificacao={notificacao} /><Localizacao /></NotificacoesProvider>
      </MemoryRouter>,
    );
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir notificação' }));

    await waitFor(() => expect(mocks.marcarLida).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('localizacao')).toHaveTextContent('/dashboard');
  });
});
