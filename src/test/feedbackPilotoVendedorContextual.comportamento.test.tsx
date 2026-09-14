import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import VendedorEncomendaDetalhe from '@/paginas/dashboard/vendedor/VendedorEncomendaDetalhe';
import type { DetalheEncomenda } from '@/services/encomendas';

const mocks = vi.hoisted(() => ({ detalhe: vi.fn(), disputa: vi.fn(), resumo: vi.fn(), toast: vi.fn() }));
vi.mock('@/services/encomendas', () => ({
  fetchDetalheEncomenda: mocks.detalhe, fetchDisputaEncomenda: mocks.disputa,
  confirmarRecolhaEncomendaVendedor: vi.fn(), transicionarEncomendaLevantamento: vi.fn(),
  registarPagamentoNoLevantamentoVendedor: vi.fn(), validarCodigoLevantamento: vi.fn(),
}));
vi.mock('@/services/pagamentos', () => ({ obterResumoFinanceiroEncomendaVendedor: mocks.resumo }));
vi.mock('@/contextos/AuthContexto', () => ({ useAuth: () => ({ utilizador: { papel: 'vendedor' } }) }));
vi.mock('@/hooks/useEncomendasTempoReal', () => ({ useEncomendasTempoReal: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/componentes/encomendas/EncomendaDetalheConteudo', () => ({ EncomendaDetalheConteudo: () => null }));
vi.mock('@/componentes/encomendas/MensagensOperacionaisEntrega', () => ({ MensagensOperacionaisEntrega: () => null }));
vi.mock('@/componentes/encomendas/ResumoFinanceiroVendedorEncomenda', () => ({ ResumoFinanceiroVendedorEncomenda: () => null }));
vi.mock('@/componentes/FeedbackPilotoDialog', () => ({
  FeedbackPilotoDialog: ({ aberto, contexto, encomendaId, atribuicaoEntregaId }: { aberto: boolean; contexto: string; encomendaId?: string; atribuicaoEntregaId?: string | null }) => aberto ? <div data-testid="feedback-dialog" data-contexto={contexto} data-encomenda={encomendaId ?? ''} data-atribuicao={atribuicaoEntregaId ?? ''} /> : null,
}));
vi.mock('@/componentes/FeedbackPilotoConvite', () => ({
  FeedbackPilotoConvite: ({ contexto, encomendaId, atribuicaoEntregaId, concluida }: { contexto: string; encomendaId?: string; atribuicaoEntregaId?: string | null; concluida: boolean }) => concluida ? <div data-testid="feedback-convite" data-contexto={contexto} data-encomenda={encomendaId ?? ''} data-atribuicao={atribuicaoEntregaId ?? ''} /> : null,
}));

afterEach(() => { cleanup(); vi.resetAllMocks(); });
function encomenda(estado: string, modalidade: 'entrega' | 'levantamento' = 'entrega'): DetalheEncomenda {
  return { id: 'encomenda-vendedor', estado, modalidade_recebimento: modalidade, entrega_participante: modalidade === 'entrega' ? { atribuicao_id: 'atribuicao-vendedor', estado: 'concluida' } : null } as unknown as DetalheEncomenda;
}
function renderizar(valor: DetalheEncomenda) {
  mocks.detalhe.mockResolvedValue(valor); mocks.disputa.mockResolvedValue(null); mocks.resumo.mockResolvedValue(null);
  return render(<MemoryRouter initialEntries={['/dashboard/encomendas/encomenda-vendedor']}><Routes><Route path="/dashboard/encomendas/:id" element={<VendedorEncomendaDetalhe />} /></Routes></MemoryRouter>);
}
describe('feedback contextual do vendedor', () => {
  it('prepara convite automático contextual para a encomenda concluída', async () => {
    renderizar(encomenda('concluida'));
    const convite = await screen.findByTestId('feedback-convite');
    expect(convite).toHaveAttribute('data-contexto', 'vendedor');
    expect(convite).toHaveAttribute('data-encomenda', 'encomenda-vendedor');
    expect(convite).toHaveAttribute('data-atribuicao', 'atribuicao-vendedor');
  });

  it('abre feedback concluído com os IDs da entrega', async () => {
    renderizar(encomenda('concluida'));
    fireEvent.click(await screen.findByRole('button', { name: 'Dar feedback' }));
    expect(screen.getByTestId('feedback-dialog')).toHaveAttribute('data-contexto', 'vendedor');
    expect(screen.getByTestId('feedback-dialog')).toHaveAttribute('data-encomenda', 'encomenda-vendedor');
    expect(screen.getByTestId('feedback-dialog')).toHaveAttribute('data-atribuicao', 'atribuicao-vendedor');
  });
  it('não mostra feedback para estado não concluído', async () => {
    renderizar(encomenda('pronta_para_levantamento'));
    await screen.findByText('Recolha pelo entregador');
    expect(screen.queryByRole('button', { name: 'Dar feedback' })).not.toBeInTheDocument();
  });
  it('passa atribuição nula para levantamento concluído', async () => {
    renderizar(encomenda('concluida', 'levantamento'));
    fireEvent.click(await screen.findByRole('button', { name: 'Dar feedback' }));
    expect(screen.getByTestId('feedback-dialog')).toHaveAttribute('data-atribuicao', '');
  });
});
