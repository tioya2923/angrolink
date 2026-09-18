import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ listar: vi.fn(), atualizarNotificacoes: vi.fn() }));

vi.mock('@/services/chatPreCompra', () => ({ listarCaixaEntradaPreCompra: mocks.listar }));
vi.mock('@/contextos/NotificacoesContexto', () => ({
  useNotificacoesSessao: () => ({ atualizar: mocks.atualizarNotificacoes }),
}));
vi.mock('@/componentes/ChatPreCompraProduto', () => ({
  ChatPreCompraProduto: ({ conversaIdInicial, produtoNome }: { conversaIdInicial?: string; produtoNome: string }) => <p>Janela: {produtoNome} {conversaIdInicial}</p>,
}));

import ConversasPreCompra from '@/paginas/dashboard/ConversasPreCompra';

const conversa = {
  id: '22222222-2222-4222-8222-222222222222', produto_id: 'produto', vendedor_id: 'vendedor', estado: 'aberta', encomenda_id: null,
  criado_em: '2026-09-16T10:00:00Z', atualizado_em: '2026-09-16T10:00:00Z', encerrada_em: null,
  produto_nome: 'Produto testado', contraparte_nome: 'Outra conta', mensagens_nao_lidas: 2, ultima_mensagem_em: '2026-09-16T10:00:00Z', ultima_mensagem_previa: 'Mensagem segura',
};

describe('inbox de conversas pré-compra', () => {
  beforeEach(() => { mocks.listar.mockReset(); });

  it('mostra prévia, não lidas e abre a conversa existente sem criar outra', async () => {
    mocks.listar.mockResolvedValue([conversa]);
    render(<ConversasPreCompra />);
    expect(await screen.findByText('Produto testado')).toBeTruthy();
    expect(screen.getByText('Mensagem segura')).toBeTruthy();
    expect(screen.getByText('2 não lida(s)')).toBeTruthy();
    expect(mocks.listar).toHaveBeenCalledWith({ limite: 20 });
    fireEvent.click(screen.getByRole('button', { name: /Produto testado/ }));
    expect(await screen.findByText(/Janela: Produto testado/)).toHaveTextContent(conversa.id);
  });

  it('apresenta erro acessível e permite retry', async () => {
    mocks.listar.mockRejectedValueOnce(new Error('falha')).mockResolvedValueOnce([]);
    render(<ConversasPreCompra />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as conversas.');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(mocks.listar).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Ainda não existem conversas sobre produtos.')).toBeTruthy();
  });
});
