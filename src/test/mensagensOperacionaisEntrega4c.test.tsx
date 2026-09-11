import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MensagensOperacionaisEntrega } from '@/componentes/encomendas/MensagensOperacionaisEntrega';

const mensagens = vi.fn();
vi.mock('@/componentes/encomendas/MensagensEncomenda', () => ({
  MensagensEncomenda: (props: { canal: string; atribuicaoEntregaId?: string | null; bloquearEnvio?: boolean }) => {
    mensagens(props);
    return <div data-testid="conversa-ativa">{`${props.canal}:${props.atribuicaoEntregaId ?? 'sem-atribuicao'}:${props.bloquearEnvio ? 'bloqueada' : 'aberta'}`}</div>;
  },
}));

describe('MensagensOperacionaisEntrega', () => {
  it('mantém uma única conversa ativa e troca o contexto completo da atribuição', () => {
    render(<MensagensOperacionaisEntrega encomendaId="enc-1" estadoEncomenda="recolhida" abas={[
      { id: 'vendedor_entregador', titulo: 'Vendedor', atribuicaoEntregaId: 'atr-1' },
      { id: 'comprador_entregador', titulo: 'Comprador', atribuicaoEntregaId: 'atr-1' },
    ]} />);

    expect(screen.getByTestId('conversa-ativa')).toHaveTextContent('vendedor_entregador:atr-1:aberta');
    fireEvent.click(screen.getByRole('tab', { name: 'Comprador' }));
    expect(screen.getByTestId('conversa-ativa')).toHaveTextContent('comprador_entregador:atr-1:aberta');
    expect(screen.getAllByRole('tab', { selected: true })).toHaveLength(1);
  });

  it('preserva histórico mas bloqueia o composer quando a atribuição terminou', () => {
    render(<MensagensOperacionaisEntrega encomendaId="enc-1" estadoEncomenda="aguardando_confirmacao" abas={[
      { id: 'vendedor_entregador', titulo: 'Vendedor', atribuicaoEntregaId: 'atr-cancelada', bloquearEnvio: true },
    ]} />);
    expect(screen.getByTestId('conversa-ativa')).toHaveTextContent('vendedor_entregador:atr-cancelada:bloqueada');
  });
});
