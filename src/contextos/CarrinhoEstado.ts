import { createContext } from 'react';
import type { ItemCarrinho } from '@/dominio/carrinho';

export type CarrinhoContextoTipo = {
  itens: ItemCarrinho[];
  quantidadeItens: number;
  subtotalEstimadoCentimos: number;
  adicionarItem: (item: ItemCarrinho) => void;
  atualizarQuantidade: (produtoId: string, quantidade: number) => void;
  removerItem: (produtoId: string) => void;
  removerItens: (produtoIds: string[]) => void;
  atualizarItens: (itens: ItemCarrinho[]) => void;
};

export const CarrinhoContexto = createContext<CarrinhoContextoTipo | null>(null);
