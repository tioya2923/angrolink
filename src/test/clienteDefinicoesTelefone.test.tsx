import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClienteDefinicoes from '@/paginas/dashboard/cliente/ClienteDefinicoes';

const mocks = vi.hoisted(() => ({
  single: vi.fn(), upsert: vi.fn(), toast: vi.fn(), recarregarPerfil: vi.fn(),
  auth: vi.fn(), alterarPassword: vi.fn(),
  utilizador: { id: 'cliente-fixture', nome: 'Cliente teste', email: 'contacto@example.test', telefone: '' },
}));

vi.mock('@/contextos/AuthContexto', () => ({
  useAuth: () => ({ utilizador: mocks.utilizador, logout: vi.fn(), recarregarPerfil: mocks.recarregarPerfil }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/services/auth', () => ({ alterarPasswordDaSessao: mocks.alterarPassword }));
vi.mock('@/services/supabase', () => ({
  supabase: {
    from: (table: string) => {
      expect(table).toBe('clientes');
      return {
        select: () => ({ eq: (column: string, id: string) => {
          expect([column, id]).toEqual(['id', mocks.utilizador.id]);
          return { single: mocks.single };
        } }),
        upsert: mocks.upsert,
      };
    },
    auth: new Proxy({}, { get: () => mocks.auth }),
  },
}));
vi.mock('@/services/territorioAngola', () => ({
  listarProvinciasAngola: async () => [],
  listarMunicipiosAngola: async () => [],
  resolverSelecaoTerritorialExistente: async () => ({ estado: 'INCOMPLETO' }),
}));
vi.mock('@/componentes/SeletorTelefone', () => ({
  default: ({ valor, onValorChange, indicativo, onIndicativoChange }: {
    valor: string; onValorChange: (valor: string) => void;
    indicativo: string; onIndicativoChange: (valor: string) => void;
  }) => <>
    <input aria-label="Número de telefone" value={valor} onChange={e => onValorChange(e.target.value)} />
    <select aria-label="Indicativo" value={indicativo} onChange={e => onIndicativoChange(e.target.value)}>
      <option value="244">244</option><option value="351">351</option>
    </select>
  </>,
}));

async function abrir(telefone: string | null) {
  mocks.single.mockResolvedValue({ data: {
    nome: 'Cliente teste', telefone, email: 'contacto@example.test',
    provincia: null, municipio: null, foto_perfil: null,
  }, error: null });
  render(<ClienteDefinicoes />);
  await screen.findByRole('textbox', { name: 'Número de telefone' });
}

function editar(numero: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Número de telefone' }), { target: { value: numero } });
}

async function guardar() {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar Perfil' }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.recarregarPerfil.mockResolvedValue(undefined);
});

afterEach(() => {
  // A edição é de domínio, nunca de credenciais ou de email_login.
  expect(mocks.auth).not.toHaveBeenCalled();
  expect(mocks.alterarPassword).not.toHaveBeenCalled();
  for (const [payload] of mocks.upsert.mock.calls) {
    expect(payload.id).toBe(mocks.utilizador.id);
    expect(payload.email).toBe('contacto@example.test');
    expect(payload).not.toHaveProperty('email_login');
    expect(payload).not.toHaveProperty('password');
  }
  cleanup();
  vi.restoreAllMocks();
});

describe('telefone opcional nas definições do comprador', () => {
  it.each([null, '', '+244923456789', '923456789'])('omite telefone intocado (%s), mesmo ao editar outro campo', async telefone => {
    await abrir(telefone);
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Nome editado' } });
    await guardar();
    expect(mocks.upsert.mock.calls[0][0]).not.toHaveProperty('telefone');
    expect(mocks.upsert.mock.calls[0][0].nome).toBe('Nome editado');
  });

  it('envia NULL ao remover intencionalmente um telefone existente', async () => {
    await abrir('+244923456789');
    editar('');
    await guardar();
    expect(mocks.upsert.mock.calls[0][0].telefone).toBeNull();
    expect(mocks.recarregarPerfil).toHaveBeenCalledOnce();
  });

  it('usa a normalização existente ao acrescentar um telefone válido', async () => {
    await abrir(null);
    editar('923456789');
    await guardar();
    expect(mocks.upsert.mock.calls[0][0].telefone).toBe('+244923456789');
  });

  it('respeita a alteração explícita do indicativo', async () => {
    await abrir('+244923456789');
    fireEvent.change(screen.getByRole('combobox', { name: 'Indicativo' }), { target: { value: '351' } });
    await guardar();
    expect(mocks.upsert.mock.calls[0][0].telefone).toBe('+351923456789');
  });

  it('não reescreve o telefone se a edição for desfeita antes de guardar', async () => {
    await abrir('923456789');
    const numeroInicial = (screen.getByRole('textbox', { name: 'Número de telefone' }) as HTMLInputElement).value;
    editar('');
    editar(numeroInicial);
    await guardar();
    expect(mocks.upsert.mock.calls[0][0]).not.toHaveProperty('telefone');
  });

  it('não repete a remoção numa gravação posterior sem nova edição', async () => {
    await abrir('+244923456789');
    editar('');
    await guardar();
    mocks.toast.mockClear();
    await guardar();
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.upsert.mock.calls[1][0]).not.toHaveProperty('telefone');
  });

  it('mantém o erro existente e permite reenviar a edição após falha', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.upsert.mockResolvedValue({ error: { code: '23505' } });
    await abrir(null);
    editar('923456789');
    await guardar();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao guardar', variant: 'destructive' }));
    expect(mocks.recarregarPerfil).not.toHaveBeenCalled();
    mocks.toast.mockClear();
    mocks.upsert.mockResolvedValue({ error: null });
    await guardar();
    expect(mocks.upsert.mock.calls[1][0].telefone).toBe('+244923456789');
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Definições guardadas!' }));
  });
});
