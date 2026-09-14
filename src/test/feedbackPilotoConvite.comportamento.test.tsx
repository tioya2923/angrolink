import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeedbackPilotoConvite } from '@/componentes/FeedbackPilotoConvite';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

function renderizar(props: Partial<React.ComponentProps<typeof FeedbackPilotoConvite>> = {}) {
  const aoDarFeedback = vi.fn();
  return {
    aoDarFeedback,
    ...render(
      <FeedbackPilotoConvite
        contexto="cliente"
        encomendaId="encomenda-1"
        atribuicaoEntregaId="atribuicao-1"
        concluida
        aoDarFeedback={aoDarFeedback}
        {...props}
      />,
    ),
  };
}

describe('FeedbackPilotoConvite', () => {
  it('mostra convite contextual apenas após a conclusão', () => {
    renderizar({ concluida: false });
    expect(screen.queryByText('Como correu a tua experiência?')).not.toBeInTheDocument();

    cleanup();
    renderizar();
    expect(screen.getByText('Como correu a tua experiência?')).toBeInTheDocument();
    expect(screen.getByText('Conta-nos como correu a tua compra.')).toBeInTheDocument();
  });

  it('persiste a dispensa por chave e não volta a abrir após remontagem', () => {
    const { unmount } = renderizar();
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }));
    unmount();

    renderizar();
    expect(screen.queryByText('Como correu a tua experiência?')).not.toBeInTheDocument();
  });

  it('fecha o convite antes de abrir o diálogo de feedback existente', () => {
    const { aoDarFeedback } = renderizar();
    fireEvent.click(screen.getByRole('button', { name: 'Dar feedback' }));

    expect(aoDarFeedback).toHaveBeenCalledOnce();
    expect(screen.queryByText('Como correu a tua experiência?')).not.toBeInTheDocument();
  });

  it('usa chaves independentes para novos contextos e atribuições', () => {
    const primeiro = renderizar();
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }));
    primeiro.unmount();

    renderizar({ contexto: 'vendedor' });
    expect(screen.getByText('Conta-nos como correu a tua venda.')).toBeInTheDocument();
  });

  it('não depende do localStorage para apresentar o convite nesta sessão', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });

    renderizar({ contexto: 'parceiro_entrega' });
    expect(screen.getByText('Conta-nos como correu esta entrega.')).toBeInTheDocument();
  });

  it('exige atribuição concreta para o convite do parceiro', () => {
    renderizar({ contexto: 'parceiro_entrega', atribuicaoEntregaId: null });
    expect(screen.queryByText('Como correu a tua experiência?')).not.toBeInTheDocument();
  });
});
