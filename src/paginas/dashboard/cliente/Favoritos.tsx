import { useEffect, useState } from 'react';
import { Heart, Package, Wrench } from 'lucide-react';

import ListaProdutos from '@/componentes/ListaProdutos';
import ListaServicos from '@/componentes/ListaServicos';

import { Produto, Servico } from '@/tipos';

import { useAuth } from '@/contextos/AuthContexto';

import {
  listarFavoritosProdutos,
  listarFavoritosServicos,
} from '@/services/api';

export default function ClienteFavoritos() {
  const { utilizador } = useAuth();

  const [produtos, setProdutos] =
    useState<Produto[]>([]);

  const [servicos, setServicos] =
    useState<Servico[]>([]);

  const [loading, setLoading] = useState(true);

  const [abaAtiva, setAbaAtiva] =
    useState<'produtos' | 'servicos'>('produtos');

  const removerProduto = (
    produtoId: string
  ) => {
    setProdutos(prev =>
      prev.filter(
        produto => produto.id !== produtoId
      )
    );
  };

  const removerServico = (
    servicoId: string
  ) => {
    setServicos(prev =>
      prev.filter(
        servico => servico.id !== servicoId
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

        const favServicos =
          await listarFavoritosServicos(
            utilizador.id
          );

        setProdutos(
          favProdutos
            .map((f: any) => f.produtos)
            .filter(Boolean)
        );

        setServicos(
          favServicos
            .map((f: any) => f.servicos)
            .filter(Boolean)
        );
      } finally {
        setLoading(false);
      }
    }

    carregar();
  }, [utilizador?.id]);

  const semFavoritos = produtos.length === 0 && servicos.length === 0;

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
        {!loading && <span className="relative z-10 ml-auto rounded-full bg-secondary px-3 py-1 font-corpo text-xs font-semibold text-secondary-foreground">{produtos.length + servicos.length} guardados</span>}
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
          <p className="mt-1 font-corpo text-sm text-muted-foreground">Quando encontrares um produto ou serviço interessante, usa o coração para o guardar aqui.</p>
        </div>
      ) : (
        <>

      {/* ABAS */}
      <div className="rounded-xl border-2 border-border bg-card p-2">
        <div className="flex gap-2">

          <button
            onClick={() => setAbaAtiva('produtos')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 font-corpo text-sm font-semibold transition ${
              abaAtiva === 'produtos'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Package className="size-4" />
            Produtos ({produtos.length})
          </button>

          <button
            onClick={() => setAbaAtiva('servicos')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 font-corpo text-sm font-semibold transition ${
              abaAtiva === 'servicos'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Wrench className="size-4" />
            Serviços ({servicos.length})
          </button>

        </div>
      </div>

      {/* PRODUTOS */}
      {abaAtiva === 'produtos' && (
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

      {/* SERVIÇOS */}
      {abaAtiva === 'servicos' && (
        servicos.length === 0 ? (
          <div className="painel-dashboard-form border-dashed text-center py-10">
            <p className="text-muted-foreground">
              Ainda não tens serviços favoritos.
            </p>
          </div>
        ) : (
          <ListaServicos
            servicos={servicos}
            onRemoverFavorito={removerServico}
          />
        )
      )}
        </>
      )}

    </div>
  );
}
