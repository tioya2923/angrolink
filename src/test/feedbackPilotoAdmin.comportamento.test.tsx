import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminFeedbackPiloto from '@/paginas/dashboard/admin/AdminFeedbackPiloto';

const mocks = vi.hoisted(() => ({ listar: vi.fn(), atualizar: vi.fn() }));
vi.mock('@/services/feedbackPiloto', async () => ({ listarFeedbackPilotoAdmin: mocks.listar, atualizarEstadoFeedbackPilotoAdmin: mocks.atualizar }));
const vazio = { itens: [], paginacao: { totalResultados: 0, limite: 20, offset: 0 } };
const item = { id: 'fb-1', papel: 'cliente', categoria: 'entrega', nota: 4, comentario: 'Bom acompanhamento', contactarUtilizador: true, estado: 'novo', encomendaId: 'enc-1', atribuicaoEntregaId: 'atr-1', criadoEm: '2026-09-01T10:00:00Z', atualizadoEm: '2026-09-01T10:00:00Z', resolvidoEm: null };
describe('AdminFeedbackPiloto', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it('mostra vazio e limites de paginação', async () => { mocks.listar.mockResolvedValue(vazio); render(<AdminFeedbackPiloto />); expect(await screen.findByText('Nenhum feedback encontrado.')).toBeTruthy(); expect(screen.getByRole('button',{name:'Anterior'})).toBeDisabled(); expect(screen.getByRole('button',{name:'Próxima'})).toBeDisabled(); });
  it('mostra erro e permite retry', async () => { mocks.listar.mockRejectedValueOnce(Error()).mockResolvedValueOnce(vazio); render(<AdminFeedbackPiloto />); fireEvent.click(await screen.findByRole('button',{name:'Tentar novamente'})); await waitFor(()=>expect(mocks.listar).toHaveBeenCalledTimes(2)); });
  it('renderiza dados operacionais e atualiza estado com reload', async () => { mocks.listar.mockResolvedValue({ itens:[item], paginacao:{ totalResultados:1,limite:20,offset:0 } }); mocks.atualizar.mockResolvedValue(undefined); render(<AdminFeedbackPiloto />); await screen.findByText('Bom acompanhamento'); expect(screen.getByText('Nota: 4/5')).toBeTruthy(); expect(screen.getByText(/Autorizou contacto/)).toBeTruthy(); expect(screen.getByText(/Encomenda: enc-1/)).toBeTruthy(); fireEvent.click(screen.getByRole('button',{name:'Em análise'})); await waitFor(()=>expect(mocks.atualizar).toHaveBeenCalledWith('fb-1','em_analise')); expect(mocks.listar.mock.calls.length).toBeGreaterThan(1); });
});
