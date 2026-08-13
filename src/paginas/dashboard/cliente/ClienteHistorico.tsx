import { useEffect, useState } from 'react';
import { History, MessageSquare, Package, Wrench } from 'lucide-react';

import { useAuth } from '@/contextos/AuthContexto';
import { useAtualizacaoTempoReal } from '@/hooks/useAtualizacaoTempoReal';
import { supabase } from '@/services/supabase';
import { gerarLinkWhatsApp } from '@/lib/whatsapp';

import ListaProdutos from '@/componentes/ListaProdutos';
import ListaServicos from '@/componentes/ListaServicos';

type HistoricoItem = {
  id: string;

  tipo: 'produto' | 'servico';

  criado_em: string;
  atualizado_em?: string;

  telefone?: string | null;

  produto?: any;

  servico?: any;

  vendedor?: any;

  nome_item?: string;
  nome_vendedor?: string;
};

export default function ClienteHistorico() {
  const { utilizador } = useAuth();

  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [versaoTempoReal, setVersaoTempoReal] = useState(0);

  useAtualizacaoTempoReal(
    ['historico_contactos', 'historico_contactos_servicos', 'produtos', 'servicos'],
    () => setVersaoTempoReal(v => v + 1),
  );
  const [abaAtiva, setAbaAtiva] =
  useState<'produtos' | 'servicos'>(
    'produtos'
  );

  useEffect(() => {
    async function carregar() {
      setLoading(true);

      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 60);

      if (utilizador?.id) {
        const { data: historicoProdutos, error: erroProdutos } = await supabase
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
          .order('atualizado_em', {
            ascending: false,
          })
          .limit(100);

        if (erroProdutos) {
          console.error('Erro ao carregar histórico de produtos:', erroProdutos);
        }

        const { data: historicoServicos, error: erroServicos } = await supabase
          .from('historico_contactos_servicos')
          .select(`
            *,
            vendedor:vendedores (
              id,
              nome_comercial,
              telefone_whatsapp
            ),
            servico:servicos (
              id,
              nome_servico,
              imagem_url,
              preco_estimado,
              municipio,
              provincia,
              vendedor_id,
              telefone_whatsapp
            )
          `)
          .eq('cliente_id', utilizador.id)
          .gte('criado_em', dataLimite.toISOString())
          .order('atualizado_em', {
            ascending: false,
          })
          .limit(100);

        if (erroServicos) {
          console.error('Erro ao carregar histórico de serviços:', erroServicos);
        }

        const produtosNormalizados: HistoricoItem[] =
          (historicoProdutos || []).map(
            (h: any) => ({
              id: `produto-${h.id}`,
              tipo: 'produto',
              criado_em: h.criado_em,
              atualizado_em: h.atualizado_em,

              telefone:
                h.vendedor?.telefone_whatsapp || null,

              produto: h.produto,

              vendedor: h.vendedor,

              nome_item:
                h.produto?.nome_produto ||
                h.nome_produto,

              nome_vendedor:
                h.vendedor?.nome_comercial ||
                h.nome_vendedor,
            })
          );

        const servicosNormalizados: HistoricoItem[] =
          (historicoServicos || []).map(
            (h: any) => ({
              id: `servico-${h.id}`,
              tipo: 'servico',
              criado_em: h.criado_em,
              atualizado_em: h.atualizado_em,

              telefone:
                h.vendedor?.telefone_whatsapp ||
                h.servico?.telefone_whatsapp ||
                null,

              servico: h.servico,

              vendedor: h.vendedor,

              nome_item:
                h.servico?.nome_servico ||
                h.nome_servico,

              nome_vendedor:
                h.vendedor?.nome_comercial ||
                h.nome_prestador,
            })
          );

        const combinado = [
          ...produtosNormalizados,
          ...servicosNormalizados,
        ].sort((a, b) => {
          const dataA =
            a.atualizado_em || a.criado_em;

          const dataB =
            b.atualizado_em || b.criado_em;

          return (
            new Date(dataB).getTime() -
            new Date(dataA).getTime()
          );
        });

        setHistorico(combinado);
      } else {
        const historicoProdutosLocal = JSON.parse(
          localStorage.getItem('historico') || '[]'
        );

        const historicoServicosLocal = JSON.parse(
          localStorage.getItem('historico_servicos') || '[]'
        );

        const produtosNormalizados: HistoricoItem[] = historicoProdutosLocal.map(
          (h: any, index: number) => ({
            id: `produto-local-${index}`,
            tipo: 'produto',
            nome_item: h.nome_produto,
            nome_vendedor: h.nome_vendedor,
            criado_em: h.data,
            telefone: h.telefone,
          })
        );

        const servicosNormalizados: HistoricoItem[] = historicoServicosLocal.map(
          (h: any, index: number) => ({
            id: `servico-local-${index}`,
            tipo: 'servico',
            nome_item: h.nome_servico,
            nome_vendedor: h.nome_prestador || 'Prestador',
            criado_em: h.data,
            telefone: h.telefone,
          })
        );

        const combinado = [
          ...produtosNormalizados,
          ...servicosNormalizados,
        ].sort(
          (a, b) =>
            new Date(b.criado_em).getTime() -
            new Date(a.criado_em).getTime()
        );

        setHistorico(combinado);
      }

      setLoading(false);
    }

    carregar();
  }, [utilizador?.id, versaoTempoReal]);

  if (loading) {
    return (
      <div className="painel-dashboard-form font-corpo text-sm text-muted-foreground">A carregar histórico...</div>
    );
  }

  const produtosHistorico = historico
    .filter(
      h =>
        h.tipo === 'produto' &&
        h.produto
    )
    .map(h => ({
      ...h.produto,
      vendedor: h.vendedor,
      data_contacto:
        h.atualizado_em ||
        h.criado_em,
    }));

  const servicosHistorico = historico
    .filter(
      h =>
        h.tipo === 'servico' &&
        h.servico
    )
    .map(h => ({
      ...h.servico,
      vendedor: h.vendedor,
      data_contacto: 
        h.atualizado_em || 
        h.criado_em,
    }));

    const totalProdutos =
      produtosHistorico.length;

    const totalServicos =
      servicosHistorico.length;

  console.log(
    'PRODUTOS HISTÓRICO:',
    JSON.stringify(produtosHistorico, null, 2)
  );
  console.log(
    'SERVIÇOS HISTÓRICO:',
    JSON.stringify(servicosHistorico, null, 2)
  );

  return (
    <div className="space-y-6">
      <header className="painel-dashboard-cabecalho flex items-center gap-3">
        <span className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15 text-primary-foreground"><History className="size-5" /></span>
        <div><h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">Histórico de contactos</h1><p className="relative z-10 mt-1 font-corpo text-sm text-primary-foreground/80">Os produtos e serviços contactados nos últimos 60 dias.</p></div>
      </header>

      {historico.length === 0 ? (
        <div className="painel-dashboard-form border-dashed text-center"><p className="font-corpo text-sm text-muted-foreground">Ainda não contactaste nenhum vendedor ou prestador.</p></div>
      ) : (
        <div className="space-y-6">

          {/* ABAS */}
          <div className="rounded-xl border-2 border-border bg-card p-2">
            <div className="flex gap-2">

              <button
                onClick={() =>
                  setAbaAtiva('produtos')
                }
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 font-corpo text-sm font-semibold transition ${
                  abaAtiva === 'produtos'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Package className="size-4" />
                Produtos ({totalProdutos})
              </button>

              <button
                onClick={() =>
                  setAbaAtiva('servicos')
                }
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 font-corpo text-sm font-semibold transition ${
                  abaAtiva === 'servicos'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Wrench className="size-4" />
                Serviços ({totalServicos})
              </button>

            </div>
          </div>

          {/* PRODUTOS */}
          {abaAtiva === 'produtos' && (
            totalProdutos === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  Ainda não contactaste
                  nenhum produto.
                </p>
              </div>
            ) : (
              <ListaProdutos
                produtos={produtosHistorico}
                mostrarDataContacto
              />
            )
          )}

          {/* SERVIÇOS */}
          {abaAtiva === 'servicos' && (
            totalServicos === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  Ainda não contactaste
                  nenhum serviço.
                </p>
              </div>
            ) : (
              <ListaServicos
                servicos={servicosHistorico}
                mostrarDataContacto
              />
            )
          )}

        </div>
      )}
    </div>
  );
}
