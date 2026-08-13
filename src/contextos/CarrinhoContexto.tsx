import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CHAVE_CARRINHO, type ItemCarrinho, itensCarrinhoEquivalentes, quantidadeMinimaItem, restaurarCarrinho, subtotalCarrinhoCentimos, VERSAO_CARRINHO, normalizarQuantidadeCarrinho } from '@/dominio/carrinho';
import { CarrinhoContexto, type CarrinhoContextoTipo } from '@/contextos/CarrinhoEstado';

export function CarrinhoProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>(() => restaurarCarrinho(
    typeof window === 'undefined' ? null : window.localStorage.getItem(CHAVE_CARRINHO),
  ));

  useEffect(() => {
    window.localStorage.setItem(CHAVE_CARRINHO, JSON.stringify({ versao: VERSAO_CARRINHO, itens }));
  }, [itens]);

  const adicionarItem = useCallback((novoItem: ItemCarrinho) => setItens((atuais) => {
    const existente = atuais.find((item) => item.produto_id === novoItem.produto_id);
    if (!existente) return [...atuais, novoItem];
    const minimo = quantidadeMinimaItem(existente);
    return atuais.map((item) => item.produto_id === novoItem.produto_id ? {
      ...item, ...novoItem, quantidade: normalizarQuantidadeCarrinho(item.quantidade + novoItem.quantidade, minimo),
    } : item);
  }), []);
  const atualizarQuantidade = useCallback((produtoId: string, quantidade: number) => setItens((atuais) => atuais.map((item) => {
    if (item.produto_id !== produtoId) return item;
    const proximaQuantidade = normalizarQuantidadeCarrinho(quantidade, quantidadeMinimaItem(item));
    return proximaQuantidade === item.quantidade ? item : { ...item, quantidade: proximaQuantidade };
  })), []);
  const removerItem = useCallback((produtoId: string) => setItens((atuais) => atuais.filter((item) => item.produto_id !== produtoId)), []);
  const removerItens = useCallback((produtoIds: string[]) => setItens((atuais) => atuais.filter((item) => !produtoIds.includes(item.produto_id))), []);
  const atualizarItens = useCallback((proximos: ItemCarrinho[]) => setItens((atuais) => itensCarrinhoEquivalentes(atuais, proximos) ? atuais : proximos), []);

  const valor = useMemo<CarrinhoContextoTipo>(() => ({
    itens,
    quantidadeItens: itens.length,
    subtotalEstimadoCentimos: subtotalCarrinhoCentimos(itens),
    adicionarItem, atualizarQuantidade, removerItem, removerItens, atualizarItens,
  }), [adicionarItem, atualizarItens, atualizarQuantidade, itens, removerItem, removerItens]);

  return <CarrinhoContexto.Provider value={valor}>{children}</CarrinhoContexto.Provider>;
}
