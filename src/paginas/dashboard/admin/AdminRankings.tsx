import { useEffect, useState } from 'react';
import {
  BarChart3,
  Eye,
  MessageCircle,
  Package,
  Store,
  Tags,
} from 'lucide-react';

import {
  fetchRankingProdutosMaisClicados,
  fetchRankingVendedoresMaisAtivos,
  fetchRankingCategoriasMaisProcuradas,
} from '@/services/api';

export default function AdminRankings() {
  const [produtos, setProdutos] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarRankings() {
      setLoading(true);

      const [
        produtosData,
        vendedoresData,
        categoriasData,
      ] = await Promise.all([
        fetchRankingProdutosMaisClicados(10),
        fetchRankingVendedoresMaisAtivos(10),
        fetchRankingCategoriasMaisProcuradas(10),
      ]);

      setProdutos(produtosData);
      setVendedores(vendedoresData);
      setCategorias(categoriasData);

      setLoading(false);
    }

    carregarRankings();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          A carregar rankings...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="painel-dashboard-cabecalho">
        <div className="flex items-center gap-2">
          <BarChart3 className="relative z-10 h-6 w-6 text-primary-foreground" />
          <h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">Rankings da Angrolink</h1>
        </div>

        <p className="relative z-10 mt-1 font-corpo text-sm text-primary-foreground/80">
          Veja quais produtos, vendedores e categorias estão a gerar mais procura.
        </p>
      </header>

      {/* PRODUTOS MAIS CLICADOS */}
      <section className="painel-dashboard-form">
        <div className="mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-green-700" />
          <h2 className="text-lg font-semibold">Produtos mais clicados</h2>
        </div>

        <div className="space-y-3">
          {produtos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não há dados suficientes.
            </p>
          ) : (
            produtos.map((produto, index) => (
              <div
                key={produto.id}
                className="flex items-center justify-between rounded-xl border-2 border-border p-3 hover:border-green-700/40 hover:bg-green-50 transition-colors focus:outline-none focus:ring-0"
              >
                <div>
                  <p className="font-semibold">
                    #{index + 1} — {produto.nome_produto}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {produto.vendedor?.nome_comercial || 'Sem vendedor'} ·{' '}
                    {produto.municipio || 'Sem município'}
                  </p>
                </div>

                <div className="text-right text-sm">
                  <p className="flex items-center justify-end gap-1 font-semibold">
                    <MessageCircle className="h-4 w-4" />
                    {produto.cliques_whatsapp || 0}
                  </p>

                  <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                    <Eye className="h-3 w-3" />
                    {produto.visualizacoes || 0} visualizações
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* VENDEDORES MAIS ATIVOS */}
      <section className="painel-dashboard-form">
        <div className="mb-4 flex items-center gap-2">
          <Store className="h-5 w-5 text-green-700" />
          <h2 className="text-lg font-semibold">Vendedores mais ativos</h2>
        </div>

        <div className="space-y-3">
          {vendedores.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não há vendedores suficientes.
            </p>
          ) : (
            vendedores.map((vendedor, index) => (
              <div
                key={vendedor.id}
                className="flex items-center justify-between rounded-xl border-2 border-border p-3 hover:border-green-700/40 hover:bg-green-50 transition-colors"
              >
                <div>
                  <p className="font-semibold">
                    #{index + 1} — {vendedor.nome_comercial}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {vendedor.tipo_vendedor || 'Tipo não definido'} ·{' '}
                    {vendedor.municipio || 'Sem município'}
                  </p>
                </div>

                <div className="text-right text-sm">
                  <p className="font-semibold">
                    {vendedor.totalCliques} contactos
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {vendedor.totalPublicacoes} publicações ·{' '}
                    {vendedor.totalVisualizacoes} visualizações
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* CATEGORIAS MAIS PROCURADAS */}
      <section className="painel-dashboard-form">
        <div className="mb-4 flex items-center gap-2">
          <Tags className="h-5 w-5 text-green-700" />
          <h2 className="text-lg font-semibold">Categorias mais procuradas</h2>
        </div>

        <div className="space-y-3">
          {categorias.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não há pesquisas suficientes.
            </p>
          ) : (
            categorias.map((categoria, index) => (
              <div
                key={categoria.categoria_id}
                className="flex items-center justify-between rounded-xl border-2 border-border p-3 hover:border-green-700/40 hover:bg-green-50 transition-colors"
              >
                <p className="font-semibold">
                  #{index + 1} — {categoria.nome}
                </p>

                <p className="text-sm font-semibold">
                  {categoria.total_pesquisas} pesquisas
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
