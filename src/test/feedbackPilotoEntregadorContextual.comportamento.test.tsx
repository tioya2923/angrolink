import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ParceiroTarefaDetalhe from '@/paginas/dashboard/parceiro/ParceiroTarefaDetalhe';
import type { TarefaEntregaDetalhe } from '@/services/tarefasEntregador';

const mocks = vi.hoisted(() => ({ obter: vi.fn(), toast: vi.fn(), notificacoes: { ultimaRealtime: null } }));
vi.mock('@/services/tarefasEntregador', async () => {
  const atual = await vi.importActual<typeof import('@/services/tarefasEntregador')>('@/services/tarefasEntregador');
  return { ...atual, obterTarefaEntregador: mocks.obter, aceitarTarefaEntrega: vi.fn(), recusarTarefaEntrega: vi.fn(), confirmarChegadaOrigemEntregador: vi.fn(), confirmarChegadaDestinoEntregador: vi.fn(), registarPagamentoNaEntregaEntregador: vi.fn(), validarCodigoEntregaEntregador: vi.fn() };
});
vi.mock('@/contextos/NotificacoesContexto', () => ({ useNotificacoesSessao: () => mocks.notificacoes }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/componentes/encomendas/MensagensOperacionaisEntrega', () => ({ MensagensOperacionaisEntrega: () => null }));
vi.mock('@/componentes/FeedbackPilotoDialog', () => ({
  FeedbackPilotoDialog: ({ aberto, contexto, encomendaId, atribuicaoEntregaId }: { aberto: boolean; contexto: string; encomendaId?: string; atribuicaoEntregaId?: string | null }) => aberto ? <div data-testid="feedback-dialog" data-contexto={contexto} data-encomenda={encomendaId ?? ''} data-atribuicao={atribuicaoEntregaId ?? ''} /> : null,
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); mocks.notificacoes.ultimaRealtime = null; });
function tarefa(estado: TarefaEntregaDetalhe['tarefa']['estado']): TarefaEntregaDetalhe {
  return { tarefa: { id: 'atribuicao-entregador', estado, atribuido_em: '2026-09-14T10:00:00.000Z', aceite_em: '2026-09-14T10:01:00.000Z', chegou_origem_em: '2026-09-14T10:02:00.000Z', recolhida_em: '2026-09-14T10:03:00.000Z', recusado_em: null, motivo_recusa: null }, encomenda: { id: 'encomenda-entregador', codigo_publico: 'ENC-FEEDBACK', estado: 'concluida', modalidade: 'entrega' }, veiculo: { tipo: 'Mota', matricula: 'LD-00-00-AA' }, origem: { nome_vendedor: 'Vendedor', telefone: '900', endereco: 'Rua A', referencia: null, bairro: null, municipio: 'Huambo', provincia: 'Huambo' }, destino: { nome: 'Cliente', telefone: '901', endereco: 'Rua B', referencia: null, bairro: null, municipio: 'Huambo', provincia: 'Huambo' }, itens: [], requisitos_logisticos: {} } as unknown as TarefaEntregaDetalhe;
}
function renderizar(estado: TarefaEntregaDetalhe['tarefa']['estado']) {
  mocks.obter.mockResolvedValue(tarefa(estado));
  return render(<MemoryRouter initialEntries={['/dashboard/tarefas/atribuicao-entregador']}><Routes><Route path="/dashboard/tarefas/:id" element={<ParceiroTarefaDetalhe />} /></Routes></MemoryRouter>);
}
describe('feedback contextual do entregador', () => {
  it('abre feedback apenas para tarefa concluída com a atribuição concreta', async () => {
    renderizar('concluida');
    fireEvent.click(await screen.findByRole('button', { name: 'Dar feedback sobre esta entrega' }));
    expect(screen.getByTestId('feedback-dialog')).toHaveAttribute('data-contexto', 'parceiro_entrega');
    expect(screen.getByTestId('feedback-dialog')).toHaveAttribute('data-encomenda', 'encomenda-entregador');
    expect(screen.getByTestId('feedback-dialog')).toHaveAttribute('data-atribuicao', 'atribuicao-entregador');
  });
  it.each(['recusada', 'cancelada', 'aceite'] as const)('não mostra feedback em %s', async (estado) => {
    renderizar(estado);
    await screen.findByRole('heading', { name: 'ENC-FEEDBACK' });
    expect(screen.queryByRole('button', { name: 'Dar feedback sobre esta entrega' })).not.toBeInTheDocument();
  });
});
