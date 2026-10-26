import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PaginaCheckoutPendente from '@/paginas/PaginaCheckoutPendente';
import type { ItemCarrinho } from '@/dominio/carrinho';

type Perfil = { id: string; nome: string; papel: 'cliente' | 'vendedor'; telefone: string | null };
const mocks = vi.hoisted(() => ({
  perfil: null as Perfil | null, pronto: true,
  atualizarItens: vi.fn(), removerItens: vi.fn(), toast: vi.fn(),
  criarLevantamento: vi.fn(), criarEntrega: vi.fn(), chave: vi.fn(), concluir: vi.fn(),
}));
vi.mock('@/contextos/AuthContexto', () => ({ useAuth: () => ({ utilizador: mocks.perfil, pronto: mocks.pronto }) }));
vi.mock('@/componentes/Cabecalho', () => ({ default: () => null }));
vi.mock('@/componentes/Rodape', () => ({ default: () => null }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/hooks/useFiltroTerritorialAngola', () => ({ useFiltroTerritorialAngola: () => ({
  provinciaId: 'hbo', municipioId: 'municipio', provincias: [], municipios: [],
  provinciaSelecionada: { nome: 'Huambo', codigoOficial: 'HBO' }, municipioSelecionado: { nome: 'Huambo' },
}) }));
const itens: ItemCarrinho[] = [{
  produto_id: 'produto-fixture', vendedor_id: 'vendedor-fixture', vendedor_nome: 'Vendedor', nome: 'Produto',
  imagem: null, unidade: 'kg', quantidade: 1, preco_retalho_centimos: 100, preco_grosso_centimos: null,
  tipo_venda: 'retalho', quantidade_minima: 1, quantidade_minima_grosso: null, disponivel: true, atualizado_em: '2026-10-26',
}];
vi.mock('@/hooks/useCarrinho', () => ({ useCarrinho: () => ({
  itens, atualizarItens: mocks.atualizarItens, removerItens: mocks.removerItens,
}) }));
vi.mock('@/services/carrinho', () => ({
  atualizarEstadoItensCarrinho: async () => itens, obterLocaisLevantamento: async () => new Map(),
}));
vi.mock('@/services/encomendas', () => ({
  criarEncomendaEntrega: mocks.criarEntrega, criarEncomendaLevantamento: mocks.criarLevantamento,
}));
vi.mock('@/services/idempotenciaCheckout', () => ({
  obterChaveIdempotenciaCheckout: mocks.chave, concluirChaveIdempotenciaCheckout: mocks.concluir,
  mensagemErroCheckout: () => 'Não foi possível confirmar.',
}));

function pagina() { return <MemoryRouter><PaginaCheckoutPendente /></MemoryRouter>; }
async function abrir(telefone: string | null = '+244923000001') {
  mocks.perfil = { id: 'cliente-fixture', nome: 'Comprador', papel: 'cliente', telefone };
  const vista = render(pagina());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar encomenda para levantamento' })).toBeEnabled());
  return vista;
}
const campo = () => screen.getByRole('textbox', { name: 'Telefone' });
function editar(valor: string) { fireEvent.change(campo(), { target: { value: valor } }); }
function mudarPerfil(vista: ReturnType<typeof render>, telefone: string | null) {
  mocks.perfil = { ...mocks.perfil!, telefone };
  vista.rerender(pagina());
}
async function confirmar(modalidade: 'levantamento' | 'entrega') {
  if (modalidade === 'entrega') {
    fireEvent.click(screen.getByRole('button', { name: /^Entrega/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Bairro' }), { target: { value: 'Bairro teste' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Endereço detalhado' }), { target: { value: 'Endereço teste' } });
  }
  const botao = screen.getByRole('button', { name: modalidade === 'entrega' ? 'Confirmar encomenda com entrega' : 'Confirmar encomenda para levantamento' });
  await waitFor(() => expect(botao).toBeEnabled());
  fireEvent.click(botao);
  const servico = modalidade === 'entrega' ? mocks.criarEntrega : mocks.criarLevantamento;
  await waitFor(() => expect(servico).toHaveBeenCalledOnce());
  return servico;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.pronto = true;
  mocks.perfil = null;
  mocks.criarEntrega.mockResolvedValue({ id: 'encomenda-fixture', codigo_publico: 'ENC-TESTE' });
  mocks.criarLevantamento.mockResolvedValue({ id: 'encomenda-fixture', codigo_publico: 'ENC-TESTE' });
  mocks.chave.mockReturnValue('chave-fixture');
});
afterEach(cleanup);

describe('telefone automático e manual no checkout do comprador', () => {
  it.each([null, '', '+244923000001'])('preenche inicialmente pelo contacto do perfil (%s)', async telefone => {
    await abrir(telefone);
    expect(campo()).toHaveValue(telefone ?? '');
  });
  it('recebe o perfil carregado assincronamente', async () => {
    mocks.pronto = false;
    const vista = render(pagina());
    expect(screen.queryByRole('textbox', { name: 'Telefone' })).not.toBeInTheDocument();
    mocks.pronto = true;
    mocks.perfil = { id: 'cliente-fixture', nome: 'Comprador', papel: 'cliente', telefone: '+244923000002' };
    vista.rerender(pagina());
    expect(await screen.findByRole('textbox', { name: 'Telefone' })).toHaveValue('+244923000002');
  });
  it('atualiza um campo ainda automático quando o perfil muda', async () => {
    const vista = await abrir();
    mudarPerfil(vista, '+244923000002');
    expect(campo()).toHaveValue('+244923000002');
  });
  it.each([null, ''])('limpa o campo automático quando o contacto é removido (%s)', async telefone => {
    const vista = await abrir();
    mudarPerfil(vista, telefone);
    expect(campo()).toHaveValue('');
  });
  it('preserva um telefone manual perante alterações do perfil', async () => {
    const vista = await abrir();
    editar('+244923000003');
    mudarPerfil(vista, '+244923000002');
    expect(campo()).toHaveValue('+244923000003');
    mudarPerfil(vista, null);
    expect(campo()).toHaveValue('+244923000003');
  });
  it('preserva uma remoção manual perante alterações do telefone do perfil', async () => {
    const vista = await abrir();
    editar('');
    mudarPerfil(vista, '+244923000002');
    expect(campo()).toHaveValue('');
  });
  it('não repõe um campo apagado em rerenders ou mudanças de nome', async () => {
    const vista = await abrir();
    editar('');
    vista.rerender(pagina());
    expect(campo()).toHaveValue('');
    mocks.perfil = { ...mocks.perfil!, nome: 'Nome atualizado' };
    vista.rerender(pagina());
    expect(campo()).toHaveValue('');
  });
  it('não reativa o modo automático quando o perfil coincide com o valor manual', async () => {
    const vista = await abrir();
    editar('+244923000003');
    mudarPerfil(vista, '+244923000003');
    mudarPerfil(vista, '+244923000004');
    expect(campo()).toHaveValue('+244923000003');
  });
  it.each(['levantamento', 'entrega'] as const)('envia o telefone manual apresentado na confirmação de %s', async modalidade => {
    const vista = await abrir();
    editar('+244923000003');
    mudarPerfil(vista, '+244923000002');
    expect(campo()).toHaveValue('+244923000003');
    const servico = await confirmar(modalidade);
    expect(servico).toHaveBeenCalledWith(expect.objectContaining({ telefoneDestinatario: '+244923000003' }));
    expect(mocks.chave).toHaveBeenCalledWith('cliente-fixture', expect.objectContaining({ telefoneDestinatario: '+244923000003' }));
  });
  it.each(['levantamento', 'entrega'] as const)('envia o telefone automático atualizado na confirmação de %s', async modalidade => {
    const vista = await abrir();
    mudarPerfil(vista, '+244923000002');
    expect(campo()).toHaveValue('+244923000002');
    const servico = await confirmar(modalidade);
    expect(servico).toHaveBeenCalledWith(expect.objectContaining({ telefoneDestinatario: '+244923000002' }));
  });
  it('mantém a validação de levantamento vazio após remoção manual', async () => {
    const vista = await abrir();
    editar('');
    mudarPerfil(vista, '+244923000002');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar encomenda para levantamento' }));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Indique nome e telefone para o levantamento.', variant: 'destructive' }));
    expect(mocks.criarLevantamento).not.toHaveBeenCalled();
    expect(mocks.criarEntrega).not.toHaveBeenCalled();
  });
  it('mantém a confirmação de entrega desativada sem telefone', async () => {
    await abrir(null);
    fireEvent.click(screen.getByRole('button', { name: /^Entrega/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Bairro' }), { target: { value: 'Bairro teste' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Endereço detalhado' }), { target: { value: 'Endereço teste' } });
    expect(screen.getByRole('button', { name: 'Confirmar encomenda com entrega' })).toBeDisabled();
    expect(mocks.criarEntrega).not.toHaveBeenCalled();
  });
  it('preserva o preenchimento anterior no percurso de vendedor como comprador', async () => {
    const vista = await abrir();
    mocks.perfil = { ...mocks.perfil!, papel: 'vendedor' };
    vista.rerender(pagina());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar encomenda para levantamento' })).toBeEnabled());
    mudarPerfil(vista, '+244923000002');
    expect(campo()).toHaveValue('+244923000001');
  });
});
