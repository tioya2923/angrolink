import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@/services/supabase', () => ({ supabase: { rpc: mocks.rpc } }));

import {
  abrirOuObterConversaPreCompra,
  enviarMensagemPreCompra,
  listarCaixaEntradaPreCompra,
  listarMensagensPreCompra,
  marcarConversaPreCompraComoLida,
  obterConversaPreCompra,
  obterTelefoneContraparteEncomenda,
} from '@/services/chatPreCompra';

const produtoId = '11111111-1111-4111-8111-111111111111';
const conversaId = '22222222-2222-4222-8222-222222222222';
const chave = '33333333-3333-4333-8333-333333333333';

describe('serviço tipado do chat pré-compra', () => {
  beforeEach(() => { mocks.rpc.mockReset(); });

  it('envia os parâmetros de abertura, cursores e mensagem idempotente corretos', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [{ id: conversaId }], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: '44444444-4444-4444-8444-444444444444', error: null })
      .mockResolvedValueOnce({ data: [{ id: conversaId }], error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: [{ telefone: '900000000' }], error: null });

    await abrirOuObterConversaPreCompra(produtoId);
    await listarCaixaEntradaPreCompra({ antesDe: '2026-09-16T00:00:00Z', antesId: conversaId, limite: 10 });
    await listarMensagensPreCompra(conversaId, { antesDe: '2026-09-15T00:00:00Z', antesId: chave, limite: 20 });
    await enviarMensagemPreCompra({ conversaId, corpo: ' Olá ', idempotencyKey: chave });
    await obterConversaPreCompra(conversaId);
    await marcarConversaPreCompraComoLida(conversaId);
    await expect(obterTelefoneContraparteEncomenda(produtoId)).resolves.toBe('900000000');

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'abrir_ou_obter_conversa_pre_compra', { p_produto_id: produtoId });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'listar_caixa_entrada_pre_compra', { p_antes_de: '2026-09-16T00:00:00Z', p_antes_id: conversaId, p_limite: 10 });
    expect(mocks.rpc).toHaveBeenNthCalledWith(3, 'listar_mensagens_pre_compra', { p_conversa_id: conversaId, p_antes_de: '2026-09-15T00:00:00Z', p_antes_id: chave, p_limite: 20 });
    expect(mocks.rpc).toHaveBeenNthCalledWith(4, 'enviar_mensagem_pre_compra', { p_conversa_id: conversaId, p_corpo: 'Olá', p_idempotency_key: chave });
    expect(mocks.rpc).toHaveBeenNthCalledWith(5, 'obter_conversa_pre_compra', { p_conversa_id: conversaId });
    expect(mocks.rpc).toHaveBeenNthCalledWith(6, 'marcar_conversa_pre_compra_como_lida', { p_conversa_id: conversaId });
    expect(mocks.rpc).toHaveBeenNthCalledWith(7, 'obter_telefone_contraparte_encomenda', { p_encomenda_id: produtoId });
  });

  it('normaliza erros de RPC e recusa UUID antes de chamar Supabase', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'detalhe interno' } });
    await expect(obterTelefoneContraparteEncomenda(produtoId)).rejects.toThrow('Não foi possível concluir esta operação');
    await expect(abrirOuObterConversaPreCompra('invalido')).rejects.toThrow('Produto inválido');
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });

  it('não expõe o helper interno de vínculo ao browser', async () => {
    const modulo = await import('@/services/chatPreCompra');
    expect('vincularConversaPreCompraEncomenda' in modulo).toBe(false);
  });
});
