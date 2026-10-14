import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const conversaId = '22222222-2222-4222-8222-222222222222';
const mocks = vi.hoisted(() => ({
  abrir: vi.fn(), obter: vi.fn(), listar: vi.fn(), marcar: vi.fn(), enviar: vi.fn(),
  removerCanal: vi.fn(), toast: vi.fn(),
  carregarProduto: vi.fn(),
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
vi.mock('@/services/api', () => ({ fetchProdutoPorId: mocks.carregarProduto }));
vi.mock('@/componentes/carrinho/AcoesCompraProduto', () => ({
  AcoesCompraProduto: ({ produto, conversaPreCompraId }: { produto: { id: string }; conversaPreCompraId?: string }) => <div>Comprar nesta conversa: {produto.id} / {conversaPreCompraId}</div>,
}));

import { ChatPreCompraProduto } from '@/componentes/ChatPreCompraProduto';

describe('ChatPreCompraProduto', () => {
  beforeEach(() => {
    mocks.abrir.mockReset(); mocks.obter.mockReset(); mocks.listar.mockReset(); mocks.marcar.mockReset(); mocks.enviar.mockReset(); mocks.removerCanal.mockReset(); mocks.carregarProduto.mockReset();
    mocks.obter.mockResolvedValue({ id: conversaId, produto_id: 'produto', vendedor_id: 'vendedor', estado: 'somente_leitura', encomenda_id: 'encomenda', criado_em: '2026-09-16T10:00:00Z', atualizado_em: '2026-09-16T10:00:00Z', encerrada_em: '2026-09-16T10:00:00Z' });
    mocks.listar.mockResolvedValue([]); mocks.marcar.mockResolvedValue(undefined);
    mocks.carregarProduto.mockResolvedValue({ id: 'produto', vendedor_id: 'vendedor', nome_produto: 'Produto' });
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
  it('reobtém o produto público ao abrir pela inbox e preserva a conversa no carrinho', async () => {
    mocks.obter.mockResolvedValue({ id: conversaId, produto_id: 'produto', vendedor_id: 'vendedor', estado: 'aberta', encomenda_id: null, criado_em: '2026-09-16T10:00:00Z', atualizado_em: '2026-09-16T10:00:00Z', encerrada_em: null });
    render(<MemoryRouter><ChatPreCompraProduto conversaIdInicial={conversaId} produtoNome="Produto" semBotao abrirAutomaticamente /></MemoryRouter>);
    expect(await screen.findByText(`Comprar nesta conversa: produto / ${conversaId}`)).toBeTruthy();
    expect(mocks.carregarProduto).toHaveBeenCalledWith('produto');
    expect(mocks.abrir).not.toHaveBeenCalled();
  });

  it('mantém as ações de compra após uma mensagem numa conversa aberta pelo produto', async () => {
    const produto = { id: 'produto', vendedor_id: 'vendedor', nome_produto: 'Produto', disponivel: true };
    mocks.abrir.mockResolvedValue({ id: conversaId, produto_id: 'produto', vendedor_id: 'vendedor', estado: 'aberta', encomenda_id: null, criado_em: '2026-09-16T10:00:00Z', atualizado_em: '2026-09-16T10:00:00Z', encerrada_em: null });
    mocks.enviar.mockResolvedValue('44444444-4444-4444-8444-444444444444');
    render(<MemoryRouter><ChatPreCompraProduto produto={produto} produtoId="produto" produtoNome="Produto" vendedorId="vendedor" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Conversar com o vendedor' }));
    expect(await screen.findByText(`Comprar nesta conversa: produto / ${conversaId}`)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Ainda está disponível?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(mocks.enviar).toHaveBeenCalledTimes(1));
    expect(screen.getByText(`Comprar nesta conversa: produto / ${conversaId}`)).toBeTruthy();
  });

  it('não aplica o produto atrasado de uma conversa anterior', async () => {
    let resolverProdutoAntigo: ((produto: { id: string; vendedor_id: string; nome_produto: string }) => void) | undefined;
    mocks.obter.mockImplementation((id: string) => Promise.resolve({ id, produto_id: id === conversaId ? 'produto-antigo' : 'produto-novo', vendedor_id: 'vendedor', estado: 'aberta', encomenda_id: null, criado_em: '2026-09-16T10:00:00Z', atualizado_em: '2026-09-16T10:00:00Z', encerrada_em: null }));
    mocks.carregarProduto.mockImplementation((id: string) => id === 'produto-antigo'
      ? new Promise(resolve => { resolverProdutoAntigo = resolve; })
      : Promise.resolve({ id: 'produto-novo', vendedor_id: 'vendedor', nome_produto: 'Novo' }));
    const proximaConversa = '33333333-3333-4333-8333-333333333333';
    const vista = render(<MemoryRouter><ChatPreCompraProduto conversaIdInicial={conversaId} produtoNome="Antigo" semBotao abrirAutomaticamente /></MemoryRouter>);
    vista.rerender(<MemoryRouter><ChatPreCompraProduto conversaIdInicial={proximaConversa} produtoNome="Novo" semBotao abrirAutomaticamente /></MemoryRouter>);
    expect(await screen.findByText(`Comprar nesta conversa: produto-novo / ${proximaConversa}`)).toBeTruthy();
    await act(async () => { resolverProdutoAntigo?.({ id: 'produto-antigo', vendedor_id: 'vendedor', nome_produto: 'Antigo' }); });
    expect(screen.queryByText(`Comprar nesta conversa: produto-antigo / ${conversaId}`)).toBeNull();
  });

  it('não disponibiliza compra quando o produto deixou de estar acessível', async () => {
    mocks.obter.mockResolvedValue({ id: conversaId, produto_id: 'produto', vendedor_id: 'vendedor', estado: 'aberta', encomenda_id: null, criado_em: '2026-09-16T10:00:00Z', atualizado_em: '2026-09-16T10:00:00Z', encerrada_em: null });
    mocks.carregarProduto.mockResolvedValue(null);
    render(<MemoryRouter><ChatPreCompraProduto conversaIdInicial={conversaId} produtoNome="Produto" semBotao abrirAutomaticamente /></MemoryRouter>);
    expect(await screen.findByText(/já não está disponível ou acessível/)).toBeTruthy();
    expect(screen.queryByText(/Comprar nesta conversa/)).toBeNull();
  });

  it('mostra retry sem compra quando a recuperação pública do produto falha', async () => {
    mocks.obter.mockResolvedValue({ id: conversaId, produto_id: 'produto', vendedor_id: 'vendedor', estado: 'aberta', encomenda_id: null, criado_em: '2026-09-16T10:00:00Z', atualizado_em: '2026-09-16T10:00:00Z', encerrada_em: null });
    mocks.carregarProduto.mockRejectedValueOnce(new Error('falha de rede')).mockResolvedValueOnce({ id: 'produto', vendedor_id: 'vendedor', nome_produto: 'Produto' });
    render(<MemoryRouter><ChatPreCompraProduto conversaIdInicial={conversaId} produtoNome="Produto" semBotao abrirAutomaticamente /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar a disponibilidade deste produto.');
    expect(screen.queryByText(/Comprar nesta conversa/)).toBeNull();
    screen.getByRole('button', { name: 'Tentar carregar produto' }).click();
    expect(await screen.findByText(`Comprar nesta conversa: produto / ${conversaId}`)).toBeTruthy();
  });
});
