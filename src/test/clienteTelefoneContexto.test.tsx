import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/contextos/AuthContexto';
import ClienteDefinicoes from '@/paginas/dashboard/cliente/ClienteDefinicoes';
import PaginaCheckoutPendente from '@/paginas/PaginaCheckoutPendente';
import type { ItemCarrinho } from '@/dominio/carrinho';

type ClienteFixture = { id: string; nome: string; telefone: string | null; email: string; conta_ativa: boolean };
type AuthFixture = { id: string; email: string; user_metadata: { telefone: string; papel: string } };
const mocks = vi.hoisted(() => ({
  user: { id: 'cliente-fixture', email: '244923456789@telefone.angrolink', user_metadata: { telefone: '+244923456789', papel: 'cliente' } },
  cliente: null as ClienteFixture | null,
  sessao: true,
  callback: null as null | ((evento: string, sessao: { user: AuthFixture } | null) => void),
  upsert: vi.fn(), insert: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), updateUser: vi.fn(), toast: vi.fn(),
  atualizarItens: vi.fn(), removerItens: vi.fn(), leitura: vi.fn(),
}));

vi.mock('@/services/api', () => ({ fetchMeuVendedor: async () => null }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/services/supabase', () => ({ supabase: {
  rpc: async (nome: string) => {
    expect(nome).toBe('eh_admin');
    return { data: false, error: null };
  },
  from: (table: string) => {
    expect(['clientes', 'parceiros_entrega']).toContain(table);
    const resultado = async () => {
      mocks.leitura(table);
      return { data: table === 'clientes' && mocks.cliente ? { ...mocks.cliente } : null, error: null };
    };
    return {
      select: () => ({ eq: (_campo: string, id: string) => {
        expect(id).toBe(mocks.user.id);
        return { single: resultado, maybeSingle: resultado };
      } }),
      upsert: mocks.upsert,
      insert: (payload: ClienteFixture) => {
        mocks.insert(payload);
        mocks.cliente = { ...payload, conta_ativa: true };
        return { select: () => ({ single: resultado }) };
      },
    };
  },
  auth: {
    getSession: async () => ({ data: { session: mocks.sessao ? { user: mocks.user } : null }, error: null }),
    getUser: async () => ({ data: { user: mocks.sessao ? mocks.user : null }, error: null }),
    onAuthStateChange: (callback: typeof mocks.callback) => {
      mocks.callback = callback;
      return { data: { subscription: { unsubscribe: () => { mocks.callback = null; } } } };
    },
    signInWithPassword: mocks.signIn, signOut: mocks.signOut, updateUser: mocks.updateUser,
  },
} }));
vi.mock('@/services/territorioAngola', () => ({
  listarProvinciasAngola: async () => [], listarMunicipiosAngola: async () => [],
  resolverSelecaoTerritorialExistente: async () => ({ estado: 'INCOMPLETO' }),
}));
vi.mock('@/componentes/SeletorTelefone', () => ({
  default: ({ valor, onValorChange }: { valor: string; onValorChange: (valor: string) => void }) =>
    <input aria-label="Contacto do perfil" value={valor} onChange={e => onValorChange(e.target.value)} />,
}));
vi.mock('@/componentes/Cabecalho', () => ({ default: () => null }));
vi.mock('@/componentes/Rodape', () => ({ default: () => null }));
vi.mock('@/hooks/useFiltroTerritorialAngola', () => ({
  useFiltroTerritorialAngola: () => ({ provinciaId: '', municipioId: '', provincias: [], municipios: [] }),
}));

const itens: ItemCarrinho[] = [{
  produto_id: 'produto-fixture', vendedor_id: 'vendedor-fixture', vendedor_nome: 'Vendedor', nome: 'Produto',
  imagem: null, unidade: 'kg', quantidade: 1, preco_retalho_centimos: 100, preco_grosso_centimos: null,
  tipo_venda: 'retalho', quantidade_minima: 1, quantidade_minima_grosso: null, disponivel: true, atualizado_em: '2026-10-25',
}];
vi.mock('@/hooks/useCarrinho', () => ({
  useCarrinho: () => ({ itens, atualizarItens: mocks.atualizarItens, removerItens: mocks.removerItens }),
}));
vi.mock('@/services/carrinho', () => ({
  atualizarEstadoItensCarrinho: async () => itens,
  obterLocaisLevantamento: async () => new Map(),
}));

function Consumidor() {
  const { utilizador, pronto, recarregarPerfil, login } = useAuth();
  const [pagina, setPagina] = useState('perfil');
  return <>
    <output data-testid="pronto">{String(pronto)}</output>
    <output data-testid="telefone-contexto">{utilizador?.telefone}</output>
    <output data-testid="uuid">{utilizador?.id}</output>
    <button onClick={() => void recarregarPerfil()}>Recarregar perfil</button>
    <button onClick={() => void login('923456789', 'senha-sintetica-de-teste')}>Login legado</button>
    <button onClick={() => setPagina('checkout')}>Abrir checkout</button>
    {pronto && utilizador && (pagina === 'perfil' ? <ClienteDefinicoes /> : <PaginaCheckoutPendente />)}
  </>;
}

async function abrir() {
  const vista = render(<MemoryRouter><AuthProvider><Consumidor /></AuthProvider></MemoryRouter>);
  await waitFor(() => expect(screen.getByTestId('pronto')).toHaveTextContent('true'));
  return vista;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.sessao = true;
  mocks.cliente = { id: mocks.user.id, nome: 'Cliente', telefone: null, email: 'contacto@example.test', conta_ativa: true };
  mocks.upsert.mockImplementation(async (payload: Partial<ClienteFixture>) => {
    mocks.cliente = { ...mocks.cliente!, ...payload };
    return { error: null };
  });
  mocks.signIn.mockImplementation(async () => {
    mocks.sessao = true;
    return { data: { user: mocks.user }, error: null };
  });
});
afterEach(() => {
  expect(mocks.updateUser).not.toHaveBeenCalled();
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('contacto do comprador com AuthProvider real', () => {
  it.each([null, '', '+244923000001'])('usa o contacto persistido (%s), nunca o fallback Auth', async telefone => {
    mocks.cliente!.telefone = telefone;
    await abrir();
    await screen.findByRole('textbox', { name: 'Contacto do perfil' });
    expect(screen.getByTestId('telefone-contexto').textContent).toBe(telefone ?? '');
    expect(JSON.parse(localStorage.getItem('angrolink_auth_user')!).telefone).toBe(telefone ?? '');
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('remove, recarrega e abre o checkout sem recuperar metadados; preserva contacto manual', async () => {
    mocks.cliente!.telefone = mocks.user.user_metadata.telefone;
    const authAntes = JSON.stringify(mocks.user);
    await abrir();
    fireEvent.change(await screen.findByRole('textbox', { name: 'Contacto do perfil' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Perfil' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Definições guardadas!' })));
    expect(mocks.cliente!.telefone).toBeNull();
    expect(screen.getByTestId('telefone-contexto').textContent).toBe('');
    expect(screen.getByTestId('uuid')).toHaveTextContent(mocks.user.id);
    expect(JSON.stringify(mocks.user)).toBe(authAntes);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir checkout' }));
    const telefoneCheckout = await screen.findByRole('textbox', { name: 'Telefone' });
    expect(telefoneCheckout).toHaveValue('');
    fireEvent.change(telefoneCheckout, { target: { value: '+244923000002' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recarregar perfil' }));
    await act(async () => { await Promise.resolve(); });
    expect(telefoneCheckout).toHaveValue('+244923000002');
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('não restaura o contacto ao remontar a aplicação com a mesma sessão', async () => {
    const vista = await abrir();
    await screen.findByRole('textbox', { name: 'Contacto do perfil' });
    vista.unmount();
    await abrir();
    await screen.findByRole('textbox', { name: 'Contacto do perfil' });
    expect(screen.getByTestId('telefone-contexto').textContent).toBe('');
    expect(mocks.cliente!.telefone).toBeNull();
  });

  it('preserva o login sintético sem converter o identificador em contacto numa nova sessão', async () => {
    mocks.sessao = false;
    const authAntes = JSON.stringify(mocks.user);
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Login legado' }));
    await screen.findByRole('textbox', { name: 'Contacto do perfil' });
    expect(mocks.signIn).toHaveBeenCalledExactlyOnceWith({ email: mocks.user.email, password: 'senha-sintetica-de-teste' });
    expect(screen.getByTestId('telefone-contexto').textContent).toBe('');
    expect(screen.getByTestId('uuid')).toHaveTextContent(mocks.user.id);
    expect(JSON.stringify(mocks.user)).toBe(authAntes);
  });

  it('mantém o contacto vazio após um novo evento SIGNED_IN', async () => {
    await abrir();
    await screen.findByRole('textbox', { name: 'Contacto do perfil' });
    const leiturasAntes = mocks.leitura.mock.calls.length;
    act(() => mocks.callback?.('SIGNED_IN', { user: mocks.user }));
    await waitFor(() => expect(mocks.leitura.mock.calls.length).toBeGreaterThan(leiturasAntes));
    await waitFor(() => expect(screen.getByTestId('telefone-contexto').textContent).toBe(''));
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('continua a provisionar um perfil inexistente a partir dos metadados', async () => {
    mocks.cliente = null;
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await abrir();
    await screen.findByRole('textbox', { name: 'Contacto do perfil' });
    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(mocks.insert.mock.calls[0][0].telefone).toBe(mocks.user.user_metadata.telefone);
    expect(screen.getByTestId('telefone-contexto')).toHaveTextContent(mocks.user.user_metadata.telefone);
    vi.restoreAllMocks();
  });
});
