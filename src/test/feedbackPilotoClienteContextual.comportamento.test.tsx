import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ClienteEncomendaDetalhe from '@/paginas/dashboard/cliente/ClienteEncomendaDetalhe';
import type { DetalheEncomenda } from '@/services/encomendas';

const mocks = vi.hoisted(() => ({
  detalhe: vi.fn(),
  disputa: vi.fn(),
  pagamento: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/services/encomendas', () => ({
  fetchDetalheEncomenda: mocks.detalhe,
  fetchDisputaEncomenda: mocks.disputa,
  TIPOS_PROBLEMA_ENCOMENDA: ['produto_danificado'],
  abrirDisputaEncomenda: vi.fn(),
  obterCodigoEntrega: vi.fn(),
  obterCodigoLevantamento: vi.fn(),
  transicionarEncomendaLevantamento: vi.fn(),
}));
vi.mock('@/services/pagamentos', () => ({ obterPagamentoEncomendaCliente: mocks.pagamento }));
vi.mock('@/contextos/AuthContexto', () => ({ useAuth: () => ({ utilizador: { papel: 'cliente' } }) }));
vi.mock('@/hooks/useEncomendasTempoReal', () => ({ useEncomendasTempoReal: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/componentes/encomendas/EncomendaDetalheConteudo', () => ({ EncomendaDetalheConteudo: () => null }));
vi.mock('@/componentes/encomendas/MensagensOperacionaisEntrega', () => ({ MensagensOperacionaisEntrega: () => null }));
vi.mock('@/componentes/encomendas/PagamentoClienteEncomenda', () => ({ PagamentoClienteEncomenda: () => null }));
vi.mock('@/componentes/FeedbackPilotoDialog', () => ({
  FeedbackPilotoDialog: ({ aberto, contexto, encomendaId, atribuicaoEntregaId }: { aberto: boolean; contexto: string; encomendaId?: string; atribuicaoEntregaId?: string | null }) => aberto ? <div data-testid="feedback-dialog" data-contexto={contexto} data-encomenda={encomendaId ?? ''} data-atribuicao={atribuicaoEntregaId ?? ''} /> : null,
}));

afterEach(() => { cleanup(); vi.resetAllMocks(); });

function encomenda(estado: string, modalidade: 'entrega' | 'levantamento' = 'entrega'): DetalheEncomenda {
  return {
    id: 'encomenda-cliente', estado, modalidade_recebimento: modalidade,
    concluido_em: '2026-09-14T10:00:00.000Z',
    entrega_participante: modalidade === 'entrega' ? { atribuicao_id: 'atribuicao-cliente', estado: 'concluida' } : null,
  } as unknown as DetalheEncomenda;
}

function renderizar(valor: DetalheEncomenda) {
  mocks.detalhe.mockResolvedValue(valor); mocks.disputa.mockResolvedValue(null); mocks.pagamento.mockResolvedValue(null);
  return render(<MemoryRouter initialEntries={['/dashboard/encomendas/encomenda-cliente']}><Routes><Route path="/dashboard/encomendas/:id" element={<ClienteEncomendaDetalhe />} /></Routes></MemoryRouter>);
}

describe('feedback contextual do comprador', () => {
  it('mostra o botão concluído e abre o diálogo com a atribuição da entrega', async () => {
    renderizar(encomenda('concluida'));
    fireEvent.click(await screen.findByRole('button', { name: 'Dar feedback' }));
    expect(screen.getByTestId('feedback-dialog')).toHaveAttribute('data-contexto', 'cliente');
    expect(screen.getByTestId('feedback-dialog')).toHaveAttribute('data-encomenda', 'encomenda-cliente');
    expect(screen.getByTestId('feedback-dialog')).toHaveAttribute('data-atribuicao', 'atribuicao-cliente');
  });

  it('não mostra feedback em encomenda não concluída', async () => {
    renderizar(encomenda('aguardando_confirmacao'));
    await screen.findByText('Encomenda não encontrada').catch(() => undefined);
    expect(screen.queryByRole('button', { name: 'Dar feedback' })).not.toBeInTheDocument();
  });

  it('passa atribuição nula para levantamento concluído', async () => {
    renderizar(encomenda('concluida', 'levantamento'));
    fireEvent.click(await screen.findByRole('button', { name: 'Dar feedback' }));
    expect(screen.getByTestId('feedback-dialog')).toHaveAttribute('data-atribuicao', '');
  });
});
