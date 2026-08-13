import { describe, expect, it } from 'vitest';
import { agruparItensPorVendedor, assinaturaRevalidacaoCarrinho, itensCarrinhoEquivalentes, normalizarQuantidadeCarrinho, precoUnitarioEstimadoCentimos, produtoPodeUsarCtaTransacional, restaurarCarrinho, subtotalCarrinhoCentimos, subtotalEstimadoCentimos, VERSAO_CARRINHO, type ItemCarrinho } from '@/dominio/carrinho';

const criarItem = (parcial: Partial<ItemCarrinho> = {}): ItemCarrinho => ({
  produto_id: 'produto-a', vendedor_id: 'vendedor-a', vendedor_nome: 'Vendedor A', nome: 'Produto A', imagem: null, unidade: 'kg', quantidade: 1, preco_retalho_centimos: 10000, preco_grosso_centimos: null, tipo_venda: 'retalho', quantidade_minima: 1, quantidade_minima_grosso: null, disponivel: true, atualizado_em: '2026-08-13T00:00:00.000Z', ...parcial,
});

describe('domínio do carrinho', () => {
  it('respeita quantidade mínima ao diminuir ou escrever um valor inferior', () => {
    expect(normalizarQuantidadeCarrinho(0, 2)).toBe(2);
    expect(normalizarQuantidadeCarrinho(2.34567, 1)).toBe(2.346);
  });

  it('calcula subtotal apenas como estimativa em centavos', () => {
    const item = criarItem({ quantidade: 2.5, preco_retalho_centimos: 12345 });
    expect(subtotalEstimadoCentimos(item)).toBe(30863);
    expect(subtotalCarrinhoCentimos([item])).toBe(30863);
  });

  it('aplica visualmente preço de grosso apenas no mínimo conhecido', () => {
    const item = criarItem({ tipo_venda: 'ambos', preco_grosso_centimos: 8000, quantidade_minima_grosso: 10, quantidade: 9 });
    expect(precoUnitarioEstimadoCentimos(item)).toBe(10000);
    expect(precoUnitarioEstimadoCentimos({ ...item, quantidade: 10 })).toBe(8000);
  });

  it('agrupa itens por vendedor sem misturar futuras encomendas', () => {
    const grupos = agruparItensPorVendedor([criarItem(), criarItem({ produto_id: 'produto-b' }), criarItem({ produto_id: 'produto-c', vendedor_id: 'vendedor-b', vendedor_nome: 'Vendedor B' })]);
    expect(grupos).toHaveLength(2);
    expect(grupos[0].itens).toHaveLength(2);
    expect(grupos[1].vendedor_id).toBe('vendedor-b');
  });

  it('restaura somente a versão conhecida e ignora dados corrompidos', () => {
    const guardado = JSON.stringify({ versao: VERSAO_CARRINHO, itens: [criarItem()] });
    expect(restaurarCarrinho(guardado)).toHaveLength(1);
    expect(restaurarCarrinho('{inválido')).toEqual([]);
    expect(restaurarCarrinho(JSON.stringify({ versao: 999, itens: [criarItem()] }))).toEqual([]);
  });

  it('mantém item indisponível para a UI bloquear o avanço', () => {
    expect(criarItem({ disponivel: false }).disponivel).toBe(false);
  });

  it('só permite CTA para produto disponível, publicado, elegível e que não seja do próprio vendedor', () => {
    const produto = { id: 'produto-a', vendedor_id: 'vendedor-a', disponivel: true, publicado: true };
    expect(produtoPodeUsarCtaTransacional(produto, true, false)).toBe(true);
    expect(produtoPodeUsarCtaTransacional({ ...produto, disponivel: false }, true, false)).toBe(false);
    expect(produtoPodeUsarCtaTransacional(produto, false, false)).toBe(false);
    expect(produtoPodeUsarCtaTransacional(produto, true, true)).toBe(false);
  });

  it('não considera atualizado_em como motivo para nova revalidação', () => {
    const atual = criarItem();
    const mesmoEstado = { ...atual, atualizado_em: '2026-08-13T01:00:00.000Z' };
    expect(itensCarrinhoEquivalentes([atual], [mesmoEstado])).toBe(true);
    expect(assinaturaRevalidacaoCarrinho([atual])).toBe(assinaturaRevalidacaoCarrinho([mesmoEstado]));
  });

  it('revalida quando quantidade, adição ou remoção realmente mudam', () => {
    const atual = criarItem();
    expect(assinaturaRevalidacaoCarrinho([atual])).not.toBe(assinaturaRevalidacaoCarrinho([{ ...atual, quantidade: 2 }]));
    expect(assinaturaRevalidacaoCarrinho([atual])).not.toBe(assinaturaRevalidacaoCarrinho([]));
  });

  it('detecta produto inelegível ou indisponível como mudança comercial sem depender de metadados', () => {
    const atual = criarItem();
    expect(itensCarrinhoEquivalentes([atual], [{ ...atual, disponivel: false }])).toBe(false);
  });
});
