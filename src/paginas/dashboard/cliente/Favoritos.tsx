import { useEffect, useState } from 'react';
import { Heart, Package } from 'lucide-react';

import ListaProdutos from '@/componentes/ListaProdutos';

import { Produto } from '@/tipos';

import { useAuth } from '@/contextos/AuthContexto';
import { useAtualizacaoTempoReal } from '@/hooks/useAtualizacaoTempoReal';

import {
  listarFavoritosProdutos,
} from '@/services/api';

export default function ClienteFavoritos() {
  const { utilizador } = useAuth();

  const [produtos, setProdutos] =
    useState<Produto[]>([]);

  const [loading, setLoading] = useState(true);
  const [versaoTempoReal, setVersaoTempoReal] = useState(0);

  useAtualizacaoTempoReal(['favoritos', 'produtos'], () => setVersaoTempoReal(v => v + 1));

  const removerProduto = (
    produtoId: string
  ) => {
    setProdutos(prev =>
      prev.filter(
        produto => produto.id !== produtoId
      )
    );
  };

  useEffect(() => {
    async function carregar() {
      if (!utilizador?.id) {
        setLoading(false);
        return;
      }

      try {
        const favProdutos =
          await listarFavoritosProdutos(
            utilizador.id
          );

        setProdutos(
          favProdutos
            .map((f: any) => f.produtos)
            .filter(Boolean)
        );

      } finally {
        setLoading(false);
      }
    }

    carregar();
  }, [utilizador?.id, versaoTempoReal]);

  const semFavoritos = produtos.length === 0;

  return (
    <div className="space-y-6">

      {/* CABEÇALHO */}
      <header className="painel-dashboard-cabecalho flex items-center gap-3">
        <span className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15 text-primary-foreground">
          <Heart className="size-5 fill-current" />
        </span>
        <div>
          <h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">Meus Favoritos</h1>

          <p className="relative z-10 mt-1 font-corpo text-sm text-primary-foreground/80">
            Guarda os anúncios que queres voltar a consultar.
          </p>
        </div>
        {!loading && <span className="relative z-10 ml-auto rounded-full bg-secondary px-3 py-1 font-corpo text-xs font-semibold text-secondary-foreground">{produtos.length} guardados</span>}
      </header>

      {loading ? (
        <div className="painel-dashboard-form flex items-center gap-3">
          <Heart className="size-5 animate-pulse text-primary" />
          <p className="font-corpo text-sm text-muted-foreground">A carregar os teus favoritos...</p>
        </div>
      ) : semFavoritos ? (
        <div className="painel-dashboard-form border-dashed text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Heart className="size-6" /></span>
          <h2 className="mt-3 font-titulo text-lg font-bold">Ainda não tens favoritos</h2>
          <p className="mt-1 font-corpo text-sm text-muted-foreground">Quando encontrares um produto interessante, usa o coração para o guardar aqui.</p>
        </div>
      ) : (
        <>

      <div className="rounded-xl border-2 border-border bg-card p-2"><div className="flex gap-2"><span className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-corpo text-sm font-semibold text-primary-foreground"><Package className="size-4" />Produtos ({produtos.length})</span></div></div>
      {(
        produtos.length === 0 ? (
          <div className="painel-dashboard-form border-dashed text-center py-10">
            <p className="text-muted-foreground">
              Ainda não tens produtos favoritos.
            </p>
          </div>
        ) : (
          <ListaProdutos
            produtos={produtos}
            onRemoverFavorito={removerProduto}
          />
        )
      )}
        </>
      )}

    </div>
  );
}
