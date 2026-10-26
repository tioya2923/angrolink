import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  existente: false, contaExistente: false, duplicados: vi.fn(), telefone: vi.fn(), toast: vi.fn(),
  signUp: vi.fn(), signIn: vi.fn(), getSession: vi.fn(), rpc: vi.fn(), upload: vi.fn(),
}));
vi.mock('@/contextos/AuthContexto', () => ({ useAuth: () => ({
  utilizador: mocks.existente || mocks.contaExistente
    ? { id: 'fixture-local', papel: mocks.existente ? 'parceiro_entrega' : 'cliente' } : null,
  pronto: true, recarregarPerfil: vi.fn(),
}) }));
vi.mock('@/componentes/Cabecalho', () => ({ default: () => null }));
vi.mock('@/componentes/Rodape', () => ({ default: () => null }));
vi.mock('@/services/territorioAngola', () => ({
  listarProvinciasAngola: async () => [], listarMunicipiosAngola: async () => [],
}));
vi.mock('@/lib/validacoesConta', () => ({
  validarTelefone: mocks.telefone, validarDuplicados: mocks.duplicados,
  validarSenha: () => null,
}));
vi.mock('sonner', () => ({ toast: { error: mocks.toast, success: vi.fn() } }));
vi.mock('@/services/supabase', () => ({ supabase: {
  auth: { signUp: mocks.signUp, signInWithPassword: mocks.signIn, getSession: mocks.getSession },
  rpc: mocks.rpc, storage: { from: () => ({ upload: mocks.upload }) },
} }));
import PaginaCadastroParceiroEntrega from '@/paginas/PaginaCadastroParceiroEntrega';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.existente = false;
  mocks.contaExistente = false;
  mocks.telefone.mockReturnValue(null);
  // Para após a validação de email, sem operações Auth ou uploads.
  mocks.duplicados.mockResolvedValue('Fim da verificação local');
});
afterEach(() => {
  expect(mocks.signUp).not.toHaveBeenCalled();
  expect(mocks.signIn).not.toHaveBeenCalled();
  expect(mocks.getSession).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
  cleanup();
});
async function abrir() {
  render(<MemoryRouter initialEntries={['/?corrigir=1']}><PaginaCadastroParceiroEntrega /></MemoryRouter>);
  await waitFor(() => expect(screen.queryByText('A carregar províncias...')).not.toBeInTheDocument());
  return screen.getByLabelText(mocks.existente ? 'Email (opcional)' : 'Email *');
}
function submeter(campo: HTMLElement) {
  // Exercita o handler mesmo quando a validação HTML seria contornada.
  fireEvent.submit(campo.closest('form')!);
}
describe('email de novas candidaturas de parceiros', () => {
  it.each(['', '   ', 'invalido', 'sem@dominio', '244923456789@TELEFONE.ANGROLINK'])(
    'recusa %j antes de disponibilidade, Auth e upload', async email => {
      const campo = await abrir();
      expect(campo).toBeRequired();
      fireEvent.change(campo, { target: { value: email } });
      submeter(campo);
      expect(mocks.toast).toHaveBeenCalled();
      expect(mocks.duplicados).not.toHaveBeenCalled();
      expect(mocks.telefone).not.toHaveBeenCalled();
    },
  );
  it('aceita e normaliza email válido antes da verificação de disponibilidade', async () => {
    const campo = await abrir();
    fireEvent.change(campo, { target: { value: '  CONTA@EXAMPLE.TEST  ' } });
    submeter(campo);
    await waitFor(() => expect(mocks.duplicados).toHaveBeenCalledWith('', '244', 'conta@example.test'));
  });
  it.each(['', '   ', 'historico@example.test'])('não obriga parceiro existente a adicionar email (%j)', async email => {
    mocks.existente = true;
    const campo = await abrir();
    expect(campo).not.toBeRequired();
    fireEvent.change(campo, { target: { value: email } });
    submeter(campo);
    await waitFor(() => expect(mocks.duplicados).toHaveBeenCalledWith('', '244', email.trim() || null));
  });
  it('exige email numa candidatura nova mesmo quando a conta Auth já existe noutro papel', async () => {
    mocks.contaExistente = true;
    const campo = await abrir();
    submeter(campo);
    expect(mocks.toast).toHaveBeenCalledWith('Indique um email para a nova candidatura de parceiro.');
    expect(mocks.duplicados).not.toHaveBeenCalled();
  });
});
