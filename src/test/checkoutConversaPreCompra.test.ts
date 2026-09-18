import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@/services/supabase', () => ({ supabase: { rpc: mocks.rpc } }));

import { criarEncomendaEntrega, criarEncomendaLevantamento } from '@/services/encomendas';
import { mensagemErroCheckout, obterChaveIdempotenciaCheckout, type IntencaoCheckoutGrupo } from '@/services/idempotenciaCheckout';
import { itensCarrinhoEquivalentes, type ItemCarrinho } from '@/dominio/carrinho';

const conversaId = '11111111-1111-4111-8111-111111111111';
const chave = '22222222-2222-4222-8222-222222222222';
const encomenda = { id: '33333333-3333-4333-8333-333333333333', codigo_publico: 'ANG-1' };

describe('checkout com conversa pré-compra', () => {
  beforeEach(() => { mocks.rpc.mockReset(); sessionStorage.clear(); });

  it('mantém a RPC antiga sem conversa', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: encomenda, error: null });
    await criarEncomendaLevantamento({ itens: [{ produto_id: 'produto-1', quantidade: 1 }], idempotencyKey: chave });
    expect(mocks.rpc).toHaveBeenCalledWith('criar_encomenda_levantamento', expect.objectContaining({ p_idempotency_key: chave }));
  });

  it('usa somente as RPCs com conversa para levantamento e entrega', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: encomenda, error: null })
      .mockResolvedValueOnce({ data: { ...encomenda, total_centimos: 100, vendedor_id: 'v', pagamento_id: 'p', estado_pagamento: 'pendente' }, error: null });
    await criarEncomendaLevantamento({ itens: [{ produto_id: 'produto-1', quantidade: 1 }], idempotencyKey: chave, conversaPreCompraId: conversaId });
    await criarEncomendaEntrega({ itens: [{ produto_id: 'produto-1', quantidade: 1 }], idempotencyKey: chave, conversaPreCompraId: conversaId, nomeDestinatario: 'Ana', telefoneDestinatario: '900000000', provincia: 'Huambo', municipio: 'Huambo', bairro: 'Centro', enderecoDetalhado: 'Rua 1' });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'criar_encomenda_levantamento_com_conversa', expect.objectContaining({ p_conversa_pre_compra_id: conversaId, p_idempotency_key: chave }));
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'criar_encomenda_entrega_com_conversa', expect.objectContaining({ p_conversa_pre_compra_id: conversaId, p_idempotency_key: chave }));
  });

  it('não degrada para a RPC antiga quando a conversa falha', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'conversa incompatível' } });
    await expect(criarEncomendaLevantamento({ itens: [{ produto_id: 'produto-1', quantidade: 1 }], idempotencyKey: chave, conversaPreCompraId: conversaId })).rejects.toEqual({ message: 'conversa incompatível' });
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });

  it('recusa UUID inválido antes de chamar Supabase', async () => {
    await expect(criarEncomendaLevantamento({ itens: [{ produto_id: 'produto-1', quantidade: 1 }], idempotencyKey: chave, conversaPreCompraId: 'inválido' })).rejects.toThrow('conversa associada');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('mantém conversa e chave na mesma intenção em retry', () => {
    const intencao: IntencaoCheckoutGrupo = { modalidade: 'levantamento', vendedorId: 'vendedor-1', itens: [{ produto_id: 'produto-1', quantidade: 1 }], nomeDestinatario: 'Ana', telefoneDestinatario: '900000000', conversaPreCompraId: conversaId };
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(chave);
    expect(obterChaveIdempotenciaCheckout('utilizador-1', intencao)).toBe(chave);
    expect(obterChaveIdempotenciaCheckout('utilizador-1', { ...intencao })).toBe(chave);
  });

  it('traduz uma conversa incompatível sem degradar o checkout', () => {
    expect(mensagemErroCheckout({ message: 'Não foi possível associar a conversa.' })).toBe('A conversa não é compatível com esta encomenda. Volte ao produto e tente novamente.');
  });

  it('preserva a conversa no item do carrinho para a intenção do grupo correto', () => {
    const item: ItemCarrinho = {
      produto_id: 'produto-1', vendedor_id: 'vendedor-1', vendedor_nome: 'Vendedor', nome: 'Produto', imagem: null, unidade: 'unidade', quantidade: 1,
      preco_retalho_centimos: 100, preco_grosso_centimos: null, tipo_venda: 'retalho', quantidade_minima: 1, quantidade_minima_grosso: null, disponivel: true,
      atualizado_em: '2026-09-16T00:00:00Z', conversa_pre_compra_id: conversaId,
    };
    expect(itensCarrinhoEquivalentes([item], [{ ...item }])).toBe(true);
    expect(itensCarrinhoEquivalentes([item], [{ ...item, conversa_pre_compra_id: undefined }])).toBe(false);
  });
});
