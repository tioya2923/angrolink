import { useEffect, useState } from 'react';

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

  if (loading) {
    return (
      <div className="max-w-xl rounded-xl border-2 border-border bg-card p-5">
        <h1 className="font-titulo text-3xl mb-2">
          Meus Favoritos
        </h1>

        <p className="text-muted-foreground">
          A carregar favoritos...
        </p>
      </div>
    );
  }

  if (
    produtos.length === 0 &&
    servicos.length === 0
  ) {
    return (
      <div className="max-w-xl rounded-xl border-2 border-dashed border-border bg-card p-5">
        <h1 className="font-titulo text-3xl mb-2">
          Meus Favoritos
        </h1>

        <p className="text-muted-foreground">
          Ainda não guardaste nenhum produto ou serviço.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* CABEÇALHO */}
      <div className="painel-dashboard-cabecalho">
        <h1 className="relative z-10 font-titulo text-3xl text-primary-foreground">
          Meus Favoritos
        </h1>

        <p className="relative z-10 text-primary-foreground/80 mt-1">
          {produtos.length} produtos • {servicos.length} serviços
        </p>
      </div>

      {/* ABAS */}
      <div className="border-b border-border">
        <div className="flex gap-2">

          <button
            onClick={() => setAbaAtiva('produtos')}
            className={`px-4 py-2 text-sm font-medium transition ${
              abaAtiva === 'produtos'
                ? 'border-b-2 border-green-700 text-green-700'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Produtos ({produtos.length})
          </button>

          <button
            onClick={() => setAbaAtiva('servicos')}
            className={`px-4 py-2 text-sm font-medium transition ${
              abaAtiva === 'servicos'
                ? 'border-b-2 border-green-700 text-green-700'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Serviços ({servicos.length})
          </button>

        </div>
      </div>

      {/* PRODUTOS */}
      {abaAtiva === 'produtos' && (
        produtos.length === 0 ? (
          <div className="text-center py-12">
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
          <div className="text-center py-12">
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

    </div>
  );
}
