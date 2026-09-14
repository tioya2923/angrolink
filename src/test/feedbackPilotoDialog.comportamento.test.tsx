import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { FeedbackPilotoDialog } from '@/componentes/FeedbackPilotoDialog';

const mocks = vi.hoisted(() => ({ criar: vi.fn(), toast: vi.fn() }));
vi.mock('@/services/feedbackPiloto', async () => ({
  criarFeedbackPiloto: mocks.criar,
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

function abrir(aoFechar = vi.fn()) {
  render(<FeedbackPilotoDialog aberto aoFechar={aoFechar} contexto="cliente" encomendaId="enc-1" atribuicaoEntregaId="atr-1" />);
  return aoFechar;
}

describe('FeedbackPilotoDialog', () => {
  beforeAll(() => { HTMLElement.prototype.scrollIntoView = vi.fn(); });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it('bloqueia formulário vazio', () => {
    abrir(); fireEvent.click(screen.getByRole('button', { name: 'Enviar feedback' }));
    expect(mocks.criar).not.toHaveBeenCalled(); expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });
  it('envia apenas nota e contexto completo', async () => {
    const fechar = abrir(); mocks.criar.mockResolvedValue('ok');
    fireEvent.change(screen.getByLabelText('Nota'), { target: { value: '4' } }); fireEvent.click(screen.getByRole('button', { name: 'Enviar feedback' }));
    await waitFor(() => expect(mocks.criar).toHaveBeenCalledWith(expect.objectContaining({ contexto: 'cliente', nota: 4, encomendaId: 'enc-1', atribuicaoEntregaId: 'atr-1' })));
    expect(fechar).toHaveBeenCalled();
  });
  it('envia comentário, categoria e consentimento', async () => {
    abrir(); mocks.criar.mockResolvedValue('ok');
    fireEvent.change(screen.getByPlaceholderText('Conta-nos o que correu bem ou pode melhorar.'), { target: { value: 'Boa experiência' } });
    fireEvent.click(screen.getByText('Categoria')); fireEvent.click(await screen.findByText('Entrega'));
    fireEvent.click(screen.getByText('Podem contactar-me sobre este feedback.')); fireEvent.click(screen.getByRole('button', { name: 'Enviar feedback' }));
    await waitFor(() => expect(mocks.criar).toHaveBeenCalledWith(expect.objectContaining({ categoria: 'entrega', comentario: 'Boa experiência', contactarUtilizador: true, nota: null })));
  });
  it('limpa a nova intenção e mostra sucesso após envio', async () => {
    const fechar = abrir(); mocks.criar.mockResolvedValue('ok');
    fireEvent.change(screen.getByLabelText('Nota'), { target: { value: '3' } }); fireEvent.click(screen.getByRole('button', { name: 'Enviar feedback' }));
    await waitFor(() => expect(fechar).toHaveBeenCalled()); expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Obrigado pelo seu feedback.' }));
  });
  it('preserva comentário e nota após erro seguro', async () => {
    abrir(); mocks.criar.mockRejectedValue(new Error('técnico'));
    fireEvent.change(screen.getByLabelText('Nota'), { target: { value: '5' } }); fireEvent.change(screen.getByPlaceholderText('Conta-nos o que correu bem ou pode melhorar.'), { target: { value: 'texto útil' } }); fireEvent.click(screen.getByRole('button', { name: 'Enviar feedback' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
    expect(screen.getByDisplayValue('texto útil')).toBeTruthy(); expect((screen.getByLabelText('Nota') as HTMLSelectElement).value).toBe('5');
  });
  it('limita comentário a mil caracteres e bloqueia duplo envio', async () => {
    abrir(); let resolver!: () => void; mocks.criar.mockReturnValue(new Promise<void>(resolve => { resolver = resolve; }));
    const campo = screen.getByPlaceholderText('Conta-nos o que correu bem ou pode melhorar.') as HTMLTextAreaElement; expect(campo.maxLength).toBe(1000); fireEvent.change(campo, { target: { value: 'x'.repeat(20) } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar feedback' })); fireEvent.click(screen.getByRole('button', { name: /A enviar/ })); expect(mocks.criar).toHaveBeenCalledTimes(1); resolver(); await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
  });
  it('limita as categorias ao tipo de intenção', async () => {
    const { rerender } = render(<FeedbackPilotoDialog aberto aoFechar={vi.fn()} contexto="cliente" />);
    fireEvent.click(screen.getByText('Categoria')); expect((await screen.findAllByText('Aplicação')).length).toBeGreaterThan(0); expect(screen.getByText('Outro')).toBeTruthy(); expect(screen.queryByText('Entrega')).toBeNull();
    rerender(<FeedbackPilotoDialog aberto aoFechar={vi.fn()} contexto="cliente" encomendaId="enc-1" />);
    fireEvent.click(screen.getByText('Categoria')); expect(screen.getByText('Compra')).toBeTruthy(); expect(screen.queryByText('Entrega')).toBeNull();
    rerender(<FeedbackPilotoDialog aberto aoFechar={vi.fn()} contexto="cliente" encomendaId="enc-1" atribuicaoEntregaId="atr-1" />);
    fireEvent.click(screen.getByText('Categoria')); expect(screen.getByText('Entrega')).toBeTruthy();
  });
  it('limpa uma intenção aberta quando os IDs contextuais mudam', async () => {
    const { rerender } = render(<FeedbackPilotoDialog aberto aoFechar={vi.fn()} contexto="cliente" encomendaId="enc-1" atribuicaoEntregaId="atr-1" />);
    fireEvent.change(screen.getByLabelText('Nota'), { target: { value: '4' } }); fireEvent.change(screen.getByPlaceholderText('Conta-nos o que correu bem ou pode melhorar.'), { target: { value: 'anterior' } }); fireEvent.click(screen.getByText('Podem contactar-me sobre este feedback.'));
    rerender(<FeedbackPilotoDialog aberto aoFechar={vi.fn()} contexto="vendedor" encomendaId="enc-2" />);
    expect((screen.getByLabelText('Nota') as HTMLSelectElement).value).toBe(''); expect(screen.queryByDisplayValue('anterior')).toBeNull(); expect(screen.getByText('Aplicação')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Conta-nos o que correu bem ou pode melhorar.'), { target: { value: 'nova' } }); mocks.criar.mockResolvedValue('ok'); fireEvent.click(screen.getByRole('button', { name: 'Enviar feedback' }));
    await waitFor(()=>expect(mocks.criar).toHaveBeenCalledWith(expect.objectContaining({ contexto:'vendedor',encomendaId:'enc-2',atribuicaoEntregaId:undefined,contactarUtilizador:false,categoria:'aplicacao' })));
  });
});
