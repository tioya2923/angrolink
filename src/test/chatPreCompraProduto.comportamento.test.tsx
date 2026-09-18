import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const conversaId = '22222222-2222-4222-8222-222222222222';
const mocks = vi.hoisted(() => ({
  abrir: vi.fn(), obter: vi.fn(), listar: vi.fn(), marcar: vi.fn(), enviar: vi.fn(),
  removerCanal: vi.fn(), toast: vi.fn(),
  utilizador: { id: '11111111-1111-4111-8111-111111111111', papel: 'cliente' },
}));

vi.mock('@/contextos/AuthContexto', () => ({ useAuth: () => ({ utilizador: mocks.utilizador }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/services/supabase', () => ({ supabase: {
  channel: () => ({ on: () => ({ subscribe: () => ({}) }) }), removeChannel: mocks.removerCanal,
} }));
vi.mock('@/services/chatPreCompra', () => ({
  abrirOuObterConversaPreCompra: mocks.abrir,
  obterConversaPreCompra: mocks.obter,
  listarMensagensPreCompra: mocks.listar,
  marcarConversaPreCompraComoLida: mocks.marcar,
  enviarMensagemPreCompra: mocks.enviar,
}));
vi.mock('@/componentes/carrinho/AcoesCompraProduto', () => ({ AcoesCompraProduto: () => <div>Comprar nesta conversa</div> }));

import { ChatPreCompraProduto } from '@/componentes/ChatPreCompraProduto';

describe('ChatPreCompraProduto', () => {
  beforeEach(() => {
    mocks.abrir.mockReset(); mocks.obter.mockReset(); mocks.listar.mockReset(); mocks.marcar.mockReset(); mocks.enviar.mockReset(); mocks.removerCanal.mockReset();
    mocks.obter.mockResolvedValue({ id: conversaId, produto_id: 'produto', vendedor_id: 'vendedor', estado: 'somente_leitura', encomenda_id: 'encomenda', criado_em: '2026-09-16T10:00:00Z', atualizado_em: '2026-09-16T10:00:00Z', encerrada_em: '2026-09-16T10:00:00Z' });
    mocks.listar.mockResolvedValue([]); mocks.marcar.mockResolvedValue(undefined);
  });

  it('abre uma conversa existente sem criar outra e respeita somente leitura', async () => {
    render(<MemoryRouter><ChatPreCompraProduto conversaIdInicial={conversaId} produtoNome="Produto" semBotao abrirAutomaticamente /></MemoryRouter>);
    await waitFor(() => expect(mocks.obter).toHaveBeenCalledWith(conversaId));
    expect(mocks.abrir).not.toHaveBeenCalled();
    expect(await screen.findByText(/ligada a uma encomenda/)).toBeTruthy();
    expect(screen.getByLabelText('Mensagem')).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Ver encomenda' })).toHaveAttribute('href', '/dashboard/encomendas/encomenda');
  });

  it('mostra erro acessível e permite retry sem criar conversa no modo existente', async () => {
    mocks.obter.mockRejectedValueOnce(new Error('falha')).mockResolvedValueOnce({ id: conversaId, produto_id: 'produto', vendedor_id: 'vendedor', estado: 'aberta', encomenda_id: null, criado_em: '2026-09-16T10:00:00Z', atualizado_em: '2026-09-16T10:00:00Z', encerrada_em: null });
    render(<MemoryRouter><ChatPreCompraProduto conversaIdInicial={conversaId} produtoNome="Produto" semBotao abrirAutomaticamente /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível abrir a conversa.');
    screen.getByRole('button', { name: 'Tentar novamente' }).click();
    await waitFor(() => expect(mocks.obter).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Ainda não existem mensagens. Inicie a conversa.')).toBeTruthy();
    expect(mocks.abrir).not.toHaveBeenCalled();
  });
});
