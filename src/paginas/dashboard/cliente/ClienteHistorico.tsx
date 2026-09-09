import { useEffect, useState } from 'react';
import { History } from 'lucide-react';

import { useAuth } from '@/contextos/AuthContexto';
import { useAtualizacaoTempoReal } from '@/hooks/useAtualizacaoTempoReal';
import { supabase } from '@/services/supabase';

import ListaProdutos from '@/componentes/ListaProdutos';

type HistoricoProduto = {
  id: string;
  criado_em: string;
  atualizado_em?: string;
  produto?: any;
  vendedor?: any;
};

export default function ClienteHistorico() {
  const { utilizador } = useAuth();

  const [historico, setHistorico] = useState<HistoricoProduto[]>([]);
  const [loading, setLoading] = useState(true);
  const [versaoTempoReal, setVersaoTempoReal] = useState(0);

  useAtualizacaoTempoReal(
    ['historico_contactos', 'produtos'],
    () => setVersaoTempoReal(v => v + 1),
  );

  useEffect(() => {
    async function carregar() {
      setLoading(true);

      try {
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - 60);

        if (utilizador?.id) {
          const { data: historicoProdutos, error } = await supabase
            .from('historico_contactos')
            .select(`
              *,
              vendedor:vendedores (
                id,
                nome_comercial,
                telefone_whatsapp
              ),
              produto:produtos (
                id,
                nome_produto,
                imagem_url,
                preco_aproximado,
                preco_grosso,
                unidade,
                municipio,
                provincia,
                vendedor_id
              )
            `)
            .eq('cliente_id', utilizador.id)
            .gte('criado_em', dataLimite.toISOString())
            .order('atualizado_em', { ascending: false })
            .limit(100);

          if (error) {
            console.error('Erro ao carregar histórico de produtos:', error);
            setHistorico([]);
            return;
          }

          const produtosNormalizados: HistoricoProduto[] = (historicoProdutos || [])
            .filter((item: any) => item.produto)
            .map((item: any) => ({
              id: `produto-${item.id}`,
              criado_em: item.criado_em,
              atualizado_em: item.atualizado_em,
              produto: item.produto,
              vendedor: item.vendedor,
            }));

          setHistorico(produtosNormalizados);
          return;
        }

        const historicoProdutosLocal = JSON.parse(
          localStorage.getItem('historico') || '[]',
        );

        const produtosNormalizados: HistoricoProduto[] = historicoProdutosLocal
          .map((item: any, index: number) => ({
            id: `produto-local-${index}`,
            criado_em: item.data,
            produto: {
              id: item.id || `produto-local-${index}`,
              nome_produto: item.nome_produto,
              imagem_url: item.imagem_url,
              preco_aproximado: item.preco_aproximado,
              preco_grosso: item.preco_grosso,
              unidade: item.unidade,
              municipio: item.municipio,
              provincia: item.provincia,
            },
            vendedor: {
              nome_comercial: item.nome_vendedor,
              telefone_whatsapp: item.telefone,
            },
          }))
          .sort(
            (a: HistoricoProduto, b: HistoricoProduto) =>
              new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime(),
          );

        setHistorico(produtosNormalizados);
      } finally {
        setLoading(false);
      }
    }

    carregar();
  }, [utilizador?.id, versaoTempoReal]);

  if (loading) {
    return (
      <div className="painel-dashboard-form font-corpo text-sm text-muted-foreground">
        A carregar histórico...
      </div>
    );
  }

  const produtosHistorico = historico
    .filter(item => item.produto)
    .map(item => ({
      ...item.produto,
      vendedor: item.vendedor,
      data_contacto: item.atualizado_em || item.criado_em,
    }));

  return (
    <div className="space-y-6">
      <header className="painel-dashboard-cabecalho flex items-center gap-3">
        <span className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15 text-primary-foreground">
          <History className="size-5" />
        </span>
        <div>
          <h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">
            Histórico de contactos
          </h1>
          <p className="relative z-10 mt-1 font-corpo text-sm text-primary-foreground/80">
            Os produtos contactados nos últimos 60 dias.
          </p>
        </div>
      </header>

      {produtosHistorico.length === 0 ? (
        <div className="painel-dashboard-form border-dashed text-center">
          <p className="font-corpo text-sm text-muted-foreground">
            Ainda não contactaste nenhum produto.
          </p>
        </div>
      ) : (
        <ListaProdutos produtos={produtosHistorico} mostrarDataContacto />
      )}
    </div>
  );
}
