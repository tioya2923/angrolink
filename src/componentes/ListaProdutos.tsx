/**
 * ========================================
 * LISTA DE PRODUTOS
 * ========================================
 * Grelha responsiva de cards de produto.
 * Mostra mensagem se nenhum produto encontrado.
 */

import { Produto } from '@/tipos';
import CardProduto from './CardProduto';

interface ListaProdutosProps {
  produtos: Produto[];
  titulo?: string;
  onRemoverFavorito?: (
    produtoId: string
  ) => void;

  mostrarDataContacto?: boolean;
}

export default function ListaProdutos({
  produtos,
  titulo,
  onRemoverFavorito,
  mostrarDataContacto = false,
}: ListaProdutosProps) {
  const listaSegura = Array.isArray(produtos)
    ? produtos
    : [];

  return (
    <section>
      {titulo && (
        <h2
          className={`font-titulo text-xl md:text-2xl mb-4 ${
            titulo === 'Produtos em Destaque'
              ? 'text-white'
              : ''
          }`}
        >
          {titulo}
        </h2>
      )}

      {listaSegura.length === 0 ? (
        <p className="font-corpo text-sm text-muted-foreground py-8 text-center">
          Nenhum produto encontrado.
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {listaSegura.map(produto => (
            <CardProduto
              key={produto.id}
              produto={produto}
              onRemoverFavorito={
                onRemoverFavorito
              }

              mostrarDataContacto={
                mostrarDataContacto
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
