import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';

import { useAuth } from '@/contextos/AuthContexto';
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
  }, [utilizador?.id]);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">
        A carregar histórico...
      </p>
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
    <div className="space-y-4">
      <h1 className="font-titulo text-2xl font-bold">
        Histórico de Contactos
      </h1>

      {historico.length === 0 ? (
        <p className="font-corpo text-sm text-muted-foreground">
          Ainda não contactaste nenhum vendedor ou prestador.
        </p>
      ) : (
        <div className="space-y-6">

          {/* ABAS */}
          <div className="border-b border-border">
            <div className="flex gap-2">

              <button
                onClick={() =>
                  setAbaAtiva('produtos')
                }
                className={`px-4 py-2 text-sm font-medium transition ${
                  abaAtiva === 'produtos'
                    ? 'border-b-2 border-green-700 text-green-700'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Produtos ({totalProdutos})
              </button>

              <button
                onClick={() =>
                  setAbaAtiva('servicos')
                }
                className={`px-4 py-2 text-sm font-medium transition ${
                  abaAtiva === 'servicos'
                    ? 'border-b-2 border-green-700 text-green-700'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
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