import { MessageSquare, Package, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuth } from '@/contextos/AuthContexto';
import { fetchProdutosPorVendedor } from '@/services/api';

export default function VendedorDesempenho() {
  const { utilizador } = useAuth();

  const [produtos, setProdutos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      if (!utilizador?.vendedor_id) {
        setLoading(false);
        return;
      }

      try {
        const prods = await fetchProdutosPorVendedor(utilizador.vendedor_id);
        setProdutos(prods || []);
      } catch (error) {
        console.error('Erro ao carregar desempenho dos produtos:', error);
        setProdutos([]);
      } finally {
        setLoading(false);
      }
    }

    carregar();
  }, [utilizador?.vendedor_id]);

  if (loading) {
    return (
      <p className="font-corpo text-sm text-muted-foreground">
        A carregar desempenho...
      </p>
    );
  }

  const totalCliquesProdutos = produtos.reduce(
    (total, produto) => total + Number(produto.cliques_whatsapp || 0),
    0,
  );

  const produtosContactados = produtos.filter(
    produto => Number(produto.cliques_whatsapp || 0) > 0,
  ).length;

  const maisContactadosProdutos = [...produtos]
    .sort(
      (a, b) =>
        Number(b.cliques_whatsapp || 0) - Number(a.cliques_whatsapp || 0),
    )
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="painel-dashboard-cabecalho mb-8">
        <h1 className="relative z-10 font-titulo text-3xl font-bold text-primary-foreground">
          Desempenho
        </h1>

        <p className="relative z-10 mt-2 font-corpo text-base text-primary-foreground/80">
          Veja quais produtos despertaram mais interesse dos clientes através do WhatsApp.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="painel-dashboard-metrica">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <MessageSquare size={22} className="text-green-700" />
          </div>
          <p className="font-titulo text-4xl font-bold text-slate-800">
            {totalCliquesProdutos}
          </p>
          <p className="mt-2 font-corpo text-sm text-muted-foreground">
            Cliques WhatsApp
          </p>
        </div>

        <div className="painel-dashboard-metrica">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <Package size={22} className="text-green-700" />
          </div>
          <p className="font-titulo text-4xl font-bold text-slate-800">
            {produtosContactados}
          </p>
          <p className="mt-2 font-corpo text-sm text-muted-foreground">
            Produtos contactados
          </p>
        </div>

        <div className="painel-dashboard-metrica">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <Package size={22} className="text-green-700" />
          </div>
          <p className="font-titulo text-4xl font-bold text-slate-800">
            {produtos.length}
          </p>
          <p className="mt-2 font-corpo text-sm text-muted-foreground">
            Produtos publicados
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h3 className="mb-4 font-titulo text-sm">
          📦 Produtos com mais contactos
        </h3>

        <div className="space-y-3">
          {maisContactadosProdutos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem dados ainda.
            </p>
          ) : (
            maisContactadosProdutos.map(produto => (
              <div
                key={produto.id}
                className="flex items-center justify-between rounded-xl border px-4 py-3 transition hover:bg-muted/40"
              >
                <span className="font-medium text-sm text-slate-800">
                  {produto.nome_produto}
                </span>

                <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                  <MessageSquare size={16} />
                  {produto.cliques_whatsapp || 0}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <TrendingUp size={22} className="text-green-700" />
          </div>

          <div>
            <h3 className="font-titulo text-lg font-semibold">
              Dica da ANGROLINK
            </h3>

            <p className="mt-2 font-corpo text-sm text-muted-foreground">
              {totalCliquesProdutos === 0
                ? 'Ainda não recebeu contactos. Reveja os seus produtos e mantenha os anúncios completos e atualizados para aumentar a visibilidade.'
                : 'Os produtos com mais contactos revelam maior interesse dos clientes. Use estes dados para melhorar preço, imagem, descrição e disponibilidade dos restantes produtos.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
