/**
 * Vendedor — Estatísticas reais
 * Painel geral de desempenho de produtos e serviços.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  MessageSquare,
  TrendingUp,
  Package,
  Wrench,
  BarChart3,
} from 'lucide-react';

import { useAuth } from '@/contextos/AuthContexto';
import { Produto, Servico } from '@/tipos';

import {
  fetchProdutosPorVendedor,
  fetchServicosPorVendedor,
} from '@/services/api';

type ItemDesempenho = {
  id: string;
  nome: string;
  tipo: 'produto' | 'servico';
  visualizacoes: number;
  cliques_whatsapp: number;
};

export default function VendedorEstatisticas() {
  const { utilizador } = useAuth();

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarDados() {
      if (!utilizador?.vendedor_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const [produtosData, servicosData] = await Promise.all([
          fetchProdutosPorVendedor(utilizador.vendedor_id),
          fetchServicosPorVendedor(utilizador.vendedor_id),
        ]);

        setProdutos(Array.isArray(produtosData) ? produtosData : []);
        setServicos(Array.isArray(servicosData) ? servicosData : []);
      } catch (err) {
        console.error('Erro ao carregar estatísticas:', err);
        setProdutos([]);
        setServicos([]);
      } finally {
        setLoading(false);
      }
    }

    carregarDados();
  }, [utilizador?.vendedor_id]);

  const itens: ItemDesempenho[] = useMemo(() => {
    const produtosFormatados: ItemDesempenho[] = produtos.map((p: any) => ({
      id: p.id,
      nome: p.nome_produto,
      tipo: 'produto',
      visualizacoes: Number(p.visualizacoes || 0),
      cliques_whatsapp: Number(p.cliques_whatsapp || 0),
    }));

    const servicosFormatados: ItemDesempenho[] = servicos.map((s: any) => ({
      id: s.id,
      nome: s.nome_servico,
      tipo: 'servico',
      visualizacoes: Number(s.visualizacoes || 0),
      cliques_whatsapp: Number(s.cliques_whatsapp || 0),
    }));

    return [...produtosFormatados, ...servicosFormatados];
  }, [produtos, servicos]);

  const resumo = useMemo(() => {
    const visualizacoesTotais = itens.reduce(
      (total, item) => total + item.visualizacoes,
      0
    );

    const cliquesTotais = itens.reduce(
      (total, item) => total + item.cliques_whatsapp,
      0
    );

    const taxaConversao =
      visualizacoesTotais > 0
        ? ((cliquesTotais / visualizacoesTotais) * 100).toFixed(1)
        : '0.0';

    const produtosAtivos = produtos.filter(p => p.disponivel !== false).length;
    const servicosAtivos = servicos.filter(s => s.disponivel !== false).length;

    return {
      visualizacoesTotais,
      cliquesTotais,
      taxaConversao,
      produtosAtivos,
      servicosAtivos,
      totalAnuncios: produtosAtivos + servicosAtivos,
    };
  }, [itens, produtos, servicos]);

  const maisVistos = useMemo(() => {
    return [...itens]
      .sort((a, b) => b.visualizacoes - a.visualizacoes)
      .slice(0, 6);
  }, [itens]);

  const maisContactados = useMemo(() => {
    return [...itens]
      .sort((a, b) => b.cliques_whatsapp - a.cliques_whatsapp)
      .slice(0, 6);
  }, [itens]);

  const melhorConversao = useMemo(() => {
    return [...itens]
      .filter(item => item.visualizacoes > 0)
      .sort((a, b) => {
        const convA = a.cliques_whatsapp / a.visualizacoes;
        const convB = b.cliques_whatsapp / b.visualizacoes;
        return convB - convA;
      })
      .slice(0, 6);
  }, [itens]);

  const renderBarra = (valor: number, maximo: number, classe = 'bg-green-700') => {
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

  const renderTipoBadge = (tipo: 'produto' | 'servico') => {
    return (
      <span className="text-[10px] px-2 py-0.5 border border-border text-muted-foreground">
        {tipo === 'produto' ? 'Produto' : 'Serviço'}
      </span>
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

        <p className="relative z-10 font-corpo text-sm text-primary-foreground/80 mt-1">
          Acompanha o desempenho dos teus produtos e serviços no marketplace.
        </p>
      </div>

      {/* RESUMO GERAL */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="painel-dashboard-metrica">
          <Eye size={20} className="text-green-700 mb-2" />
          <p className="font-titulo text-2xl">
            {resumo.visualizacoesTotais}
          </p>
          <p className="font-corpo text-xs text-muted-foreground">
            Visualizações
          </p>
        </div>

        <div className="painel-dashboard-metrica">
          <MessageSquare size={20} className="text-green-700 mb-2" />
          <p className="font-titulo text-2xl">
            {resumo.cliquesTotais}
          </p>
          <p className="font-corpo text-xs text-muted-foreground">
            Cliques WhatsApp
          </p>
        </div>

        <div className="painel-dashboard-metrica">
          <TrendingUp size={20} className="text-green-700 mb-2" />
          <p className="font-titulo text-2xl">
            {resumo.taxaConversao}%
          </p>
          <p className="font-corpo text-xs text-muted-foreground">
            Conversão
          </p>
        </div>

        <div className="painel-dashboard-metrica">
          <Package size={20} className="text-green-700 mb-2" />
          <p className="font-titulo text-2xl">
            {resumo.produtosAtivos}
          </p>
          <p className="font-corpo text-xs text-muted-foreground">
            Produtos ativos
          </p>
        </div>

        <div className="painel-dashboard-metrica">
          <Wrench size={20} className="text-green-700 mb-2" />
          <p className="font-titulo text-2xl">
            {resumo.servicosAtivos}
          </p>
          <p className="font-corpo text-xs text-muted-foreground">
            Serviços ativos
          </p>
        </div>

        <div className="painel-dashboard-metrica">
          <BarChart3 size={20} className="text-green-700 mb-2" />
          <p className="font-titulo text-2xl">
            {resumo.totalAnuncios}
          </p>
          <p className="font-corpo text-xs text-muted-foreground">
            Anúncios ativos
          </p>
        </div>
      </div>

      {itens.length === 0 ? (
        <div className="border-2 border-border p-6 text-center">
          <p className="font-corpo text-sm text-muted-foreground">
            Ainda não tens produtos ou serviços publicados.
          </p>
        </div>
      ) : (
        <>
          {/* MAIS VISTOS */}
          <div className="border-2 border-border p-4">
            <h3 className="font-titulo text-sm mb-4">
              Mais vistos
            </h3>

            <div className="space-y-3">
              {maisVistos.map(item => (
                <div key={`${item.tipo}-${item.id}`} className="space-y-1">
                  <div className="flex justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {renderTipoBadge(item.tipo)}
                      <span className="font-corpo text-xs truncate">
                        {item.nome}
                      </span>
                    </div>

                    <span className="font-corpo text-xs text-muted-foreground shrink-0">
                      {item.visualizacoes} visualizações
                    </span>
                  </div>

                  {renderBarra(item.visualizacoes, maxViews, 'bg-green-700')}
                </div>
              ))}
            </div>
          </div>

          {/* MAIS CONTACTADOS */}
          <div className="border-2 border-border p-4">
            <h3 className="font-titulo text-sm mb-4">
              Mais contactados
            </h3>

            <div className="space-y-3">
              {maisContactados.map(item => (
                <div key={`${item.tipo}-${item.id}`} className="space-y-1">
                  <div className="flex justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {renderTipoBadge(item.tipo)}
                      <span className="font-corpo text-xs truncate">
                        {item.nome}
                      </span>
                    </div>

                    <span className="font-corpo text-xs text-muted-foreground shrink-0">
                      {item.cliques_whatsapp} cliques
                    </span>
                  </div>

                  {renderBarra(item.cliques_whatsapp, maxClicks, 'bg-secondary')}
                </div>
              ))}
            </div>
          </div>

          {/* MELHOR CONVERSÃO */}
          <div className="border-2 border-border p-4">
            <h3 className="font-titulo text-sm mb-4">
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
                      ? ((item.cliques_whatsapp / item.visualizacoes) * 100).toFixed(1)
                      : '0.0';

                  return (
                    <div
                      key={`${item.tipo}-${item.id}`}
                      className="flex justify-between items-center gap-3"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {renderTipoBadge(item.tipo)}
                        <span className="font-corpo text-xs truncate">
                          {item.nome}
                        </span>
                      </div>

                      <span className="font-corpo text-xs text-muted-foreground shrink-0">
                        {conversao}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* INSIGHT */}
          <div className="border-2 border-border p-4 bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={18} />
              <h3 className="font-titulo text-sm">
                Insight
              </h3>
            </div>

            <p className="font-corpo text-xs text-muted-foreground leading-relaxed">
              Visualizações mostram interesse. Cliques no WhatsApp mostram intenção de contacto.
              Anúncios com muitas visualizações e poucos cliques podem precisar de melhor preço,
              descrição, imagem ou oferta.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
