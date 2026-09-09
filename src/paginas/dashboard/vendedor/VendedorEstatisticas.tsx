/**
 * Vendedor — Estatísticas reais
 * Painel de desempenho dos produtos.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  MessageSquare,
  TrendingUp,
  Package,
} from 'lucide-react';

import { useAuth } from '@/contextos/AuthContexto';
import { Produto } from '@/tipos';
import { fetchProdutosPorVendedor } from '@/services/api';

type ItemDesempenho = {
  id: string;
  nome: string;
  visualizacoes: number;
  cliques_whatsapp: number;
};

export default function VendedorEstatisticas() {
  const { utilizador } = useAuth();

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarDados() {
      if (!utilizador?.vendedor_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const produtosData = await fetchProdutosPorVendedor(
          utilizador.vendedor_id,
        );

        setProdutos(Array.isArray(produtosData) ? produtosData : []);
      } catch (error) {
        console.error('Erro ao carregar estatísticas dos produtos:', error);
        setProdutos([]);
      } finally {
        setLoading(false);
      }
    }

    carregarDados();
  }, [utilizador?.vendedor_id]);

  const itens: ItemDesempenho[] = useMemo(
    () =>
      produtos.map((produto: any) => ({
        id: produto.id,
        nome: produto.nome_produto,
        visualizacoes: Number(produto.visualizacoes || 0),
        cliques_whatsapp: Number(produto.cliques_whatsapp || 0),
      })),
    [produtos],
  );

  const resumo = useMemo(() => {
    const visualizacoesTotais = itens.reduce(
      (total, item) => total + item.visualizacoes,
      0,
    );

    const cliquesTotais = itens.reduce(
      (total, item) => total + item.cliques_whatsapp,
      0,
    );

    const taxaConversao =
      visualizacoesTotais > 0
        ? ((cliquesTotais / visualizacoesTotais) * 100).toFixed(1)
        : '0.0';

    const produtosAtivos = produtos.filter(
      produto => produto.disponivel !== false,
    ).length;

    return {
      visualizacoesTotais,
      cliquesTotais,
      taxaConversao,
      produtosAtivos,
    };
  }, [itens, produtos]);

  const maisVistos = useMemo(
    () =>
      [...itens]
        .sort((a, b) => b.visualizacoes - a.visualizacoes)
        .slice(0, 6),
    [itens],
  );

  const maisContactados = useMemo(
    () =>
      [...itens]
        .sort((a, b) => b.cliques_whatsapp - a.cliques_whatsapp)
        .slice(0, 6),
    [itens],
  );

  const melhorConversao = useMemo(
    () =>
      [...itens]
        .filter(item => item.visualizacoes > 0)
        .sort((a, b) => {
          const convA = a.cliques_whatsapp / a.visualizacoes;
          const convB = b.cliques_whatsapp / b.visualizacoes;
          return convB - convA;
        })
        .slice(0, 6),
    [itens],
  );

  const renderBarra = (
    valor: number,
    maximo: number,
    classe = 'bg-green-700',
  ) => {
    const percentagem = maximo > 0 ? (valor / maximo) * 100 : 0;

    return (
      <div className="h-2 bg-muted">
        <div
          className={`h-full transition-all ${classe}`}
          style={{ width: `${percentagem}%` }}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <p className="font-corpo text-sm text-muted-foreground">
        A carregar estatísticas...
      </p>
    );
  }

  if (!utilizador?.vendedor_id) {
    return (
      <p className="font-corpo text-sm text-muted-foreground">
        Esta conta ainda não está ligada a um vendedor.
      </p>
    );
  }

  const maxViews = maisVistos[0]?.visualizacoes || 1;
  const maxClicks = maisContactados[0]?.cliques_whatsapp || 1;

  return (
    <div className="space-y-6">
      <div className="painel-dashboard-cabecalho">
        <h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">
          Estatísticas
        </h1>

        <p className="relative z-10 mt-1 font-corpo text-sm text-primary-foreground/80">
          Acompanha o desempenho dos teus produtos no marketplace.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="painel-dashboard-metrica">
          <Eye size={20} className="mb-2 text-green-700" />
          <p className="font-titulo text-2xl">
            {resumo.visualizacoesTotais}
          </p>
          <p className="font-corpo text-xs text-muted-foreground">
            Visualizações
          </p>
        </div>

        <div className="painel-dashboard-metrica">
          <MessageSquare size={20} className="mb-2 text-green-700" />
          <p className="font-titulo text-2xl">
            {resumo.cliquesTotais}
          </p>
          <p className="font-corpo text-xs text-muted-foreground">
            Cliques WhatsApp
          </p>
        </div>

        <div className="painel-dashboard-metrica">
          <TrendingUp size={20} className="mb-2 text-green-700" />
          <p className="font-titulo text-2xl">
            {resumo.taxaConversao}%
          </p>
          <p className="font-corpo text-xs text-muted-foreground">
            Conversão
          </p>
        </div>

        <div className="painel-dashboard-metrica">
          <Package size={20} className="mb-2 text-green-700" />
          <p className="font-titulo text-2xl">
            {resumo.produtosAtivos}
          </p>
          <p className="font-corpo text-xs text-muted-foreground">
            Produtos ativos
          </p>
        </div>
      </div>

      {itens.length === 0 ? (
        <div className="border-2 border-border p-6 text-center">
          <p className="font-corpo text-sm text-muted-foreground">
            Ainda não tens produtos publicados.
          </p>
        </div>
      ) : (
        <>
          <div className="border-2 border-border p-4">
            <h3 className="mb-4 font-titulo text-sm">
              Mais vistos
            </h3>

            <div className="space-y-3">
              {maisVistos.map(item => (
                <div key={item.id} className="space-y-1">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-corpo text-xs truncate">
                        {item.nome}
                      </span>
                    </div>

                    <span className="shrink-0 font-corpo text-xs text-muted-foreground">
                      {item.visualizacoes} visualizações
                    </span>
                  </div>

                  {renderBarra(item.visualizacoes, maxViews, 'bg-green-700')}
                </div>
              ))}
            </div>
          </div>

          <div className="border-2 border-border p-4">
            <h3 className="mb-4 font-titulo text-sm">
              Mais contactados
            </h3>

            <div className="space-y-3">
              {maisContactados.map(item => (
                <div key={item.id} className="space-y-1">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-corpo text-xs truncate">
                        {item.nome}
                      </span>
                    </div>

                    <span className="shrink-0 font-corpo text-xs text-muted-foreground">
                      {item.cliques_whatsapp} cliques
                    </span>
                  </div>

                  {renderBarra(
                    item.cliques_whatsapp,
                    maxClicks,
                    'bg-secondary',
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="border-2 border-border p-4">
            <h3 className="mb-4 font-titulo text-sm">
              Melhor conversão
            </h3>

            {melhorConversao.length === 0 ? (
              <p className="font-corpo text-sm text-muted-foreground">
                Ainda não existem visualizações suficientes para calcular conversão.
              </p>
            ) : (
              <div className="space-y-3">
                {melhorConversao.map(item => {
                  const conversao =
                    item.visualizacoes > 0
                      ? (
                          (item.cliques_whatsapp / item.visualizacoes) *
                          100
                        ).toFixed(1)
                      : '0.0';

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="min-w-0 truncate font-corpo text-xs">
                        {item.nome}
                      </span>

                      <span className="shrink-0 font-corpo text-xs text-muted-foreground">
                        {conversao}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-2 border-border bg-muted/30 p-4">
            <div className="mb-2 flex items-center gap-2">
              <TrendingUp size={18} />
              <h3 className="font-titulo text-sm">
                Insight
              </h3>
            </div>

            <p className="font-corpo text-xs leading-relaxed text-muted-foreground">
              Visualizações mostram interesse. Cliques no WhatsApp mostram intenção de contacto.
              Produtos com muitas visualizações e poucos cliques podem precisar de melhor preço,
              descrição, imagem ou oferta.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
