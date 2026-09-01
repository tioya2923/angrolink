/**
 * ========================================
 * PÁGINA DO VENDEDOR (Perfil / Loja)
 * ========================================
 * Foto perfil, capa, informações, lista de produtos.
 * Botão WhatsApp direto.
 */

import { useParams, Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, ArrowLeft, MapPin, Search, X, } from 'lucide-react';

import Cabecalho from '@/componentes/Cabecalho';
import Rodape from '@/componentes/Rodape';
import ListaProdutos from '@/componentes/ListaProdutos';
import ListaServicos from '@/componentes/ListaServicos';
import PerfilVendedorHero from "@/componentes/PerfilVendedorHero";
import CardProduto from "@/componentes/CardProduto";
import CardServico from "@/componentes/CardServico";
import CardProdutoLoja from "@/componentes/CardProdutoLoja";

import {
  fetchVendedorPorId,
  fetchProdutosPorVendedor,
  fetchServicosPorVendedor
} from '@/services/api';

import { gerarLinkWhatsApp } from '@/lib/whatsapp';

import { Vendedor, Produto, Servico } from '@/tipos';
import CardServicoLoja from '@/componentes/CardServicoLoja';
import { useAtualizacaoTempoReal } from '@/hooks/useAtualizacaoTempoReal';

// =============================
// HELPERS
// =============================

// 🔥 fallback imagem
const getImagemPerfil = (img?: string | null) =>
  img || '/placeholder.png';

// 🔥 ordenação de produtos
const ordenarProdutos = (produtos: Produto[]) => {
  return [...produtos].sort((a, b) => {
    if (a.disponivel !== b.disponivel) {
      return a.disponivel ? -1 : 1;
    }

    return (
      new Date(b.criado_em || 0).getTime() -
      new Date(a.criado_em || 0).getTime()
    );
  });
};

export default function PaginaVendedor() {
  const { id } = useParams<{ id: string }>();

  const [vendedor, setVendedor] = useState<Vendedor | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'produtos' | 'servicos'>('produtos');
  const [pesquisa, setPesquisa] = useState("");
  const [versaoTempoReal, setVersaoTempoReal] = useState(0);

  useAtualizacaoTempoReal(['vendedores', 'produtos', 'servicos'], () => setVersaoTempoReal(v => v + 1));

  useEffect(() => {
    async function carregar() {
      console.log("Página vendedor → ID recebido:", id);

      if (!id) {
        setErro("ID inválido");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErro(null);

        const vendedorData = await fetchVendedorPorId(id);

        if (!vendedorData) {
          setErro("Vendedor não encontrado");
          setVendedor(null);
          setProdutos([]);
          setServicos([]);
          return;
        }

        setVendedor(vendedorData);

        const [produtosData, servicosData] = await Promise.all([
          fetchProdutosPorVendedor(vendedorData.id),
          fetchServicosPorVendedor(vendedorData.id),
        ]);

        setProdutos(Array.isArray(produtosData) ? produtosData : []);
        setServicos(Array.isArray(servicosData) ? servicosData : []);

      } catch (err) {
        console.error("Erro ao carregar vendedor:", err);
        setErro("Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    }

    carregar();
  }, [id, versaoTempoReal]);

  const estatisticas = useMemo(() => {

    const visualizacoes =
      [...produtos, ...servicos].reduce(
        (total: number, item: any) =>
          total + Number(item.visualizacoes || 0),
        0
      );

    const contactos =
      [...produtos, ...servicos].reduce(
        (total: number, item: any) =>
          total + Number(item.cliques_whatsapp || 0),
        0
      );

    return {
      produtos: produtos.length,
      servicos: servicos.length,
      visualizacoes,
      contactos,
    };

  }, [produtos, servicos]);

  const produtosFiltrados = useMemo(() => {
  const termo = pesquisa.toLowerCase().trim();

  if (!termo) return ordenarProdutos(produtos);

  return ordenarProdutos(produtos).filter((produto) =>
    [
      produto.nome_produto,
      produto.descricao,
      produto.categoria,
      produto.subcategoria,
      produto.municipio,
      produto.provincia,
    ]
      .filter(Boolean)
      .some((campo) =>
        String(campo).toLowerCase().includes(termo)
      )
  );
}, [pesquisa, produtos]);

const servicosFiltrados = useMemo(() => {
  const termo = pesquisa.toLowerCase().trim();

  if (!termo) return servicos;

  return servicos.filter((servico) =>
    [
      servico.nome_servico,
      servico.descricao,
      servico.tipo_servico,
      servico.municipio,
      servico.provincia,
      servico.zona_atuacao,
    ]
      .filter(Boolean)
      .some((campo) =>
        String(campo).toLowerCase().includes(termo)
      )
  );
}, [pesquisa, servicos]);


  // =============================
  // LOADING
  // =============================
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Cabecalho />
        <main className="flex-1 flex items-center justify-center">
          <p className="font-corpo text-muted-foreground">
            A carregar vendedor...
          </p>
        </main>
        <Rodape />
      </div>
    );
  }

  // =============================
  // ERRO
  // =============================
  if (erro) {
    return (
      <div className="min-h-screen flex flex-col">
        <Cabecalho />
        <main className="flex-1 flex items-center justify-center">
          <p className="font-corpo text-muted-foreground">{erro}</p>
        </main>
        <Rodape />
      </div>
    );
  }

  // =============================
  // NÃO ENCONTRADO
  // =============================
  if (!vendedor) {
    return (
      <div className="min-h-screen flex flex-col">
        <Cabecalho />
        <main className="flex-1 flex items-center justify-center">
          <p className="font-corpo text-muted-foreground">
            Vendedor não encontrado.
          </p>
        </main>
        <Rodape />
      </div>
    );
  }
  return (
    <div className="min-h-screen flex flex-col">
      <Cabecalho />

      <main className="flex-1">

        {/* CAPA */}
        <PerfilVendedorHero
          vendedor={vendedor}
          produtos={produtos}
          servicos={servicos}
        />

        

        <div className="mt-10 rounded-2xl border bg-white shadow-sm overflow-hidden">

          {/* Barra de pesquisa */}
          <div className="relative mb-6">

            <Search
              size={20}
              className="
                absolute
                left-4
                top-1/2
                -translate-y-1/2
                text-gray-400
              "
            />

            <input
              type="text"
              placeholder="Pesquisar nesta loja..."
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              className="
                w-full
                rounded-xl
                border
                border-gray-300
                pl-12
                pr-12
                py-3
                focus:outline-none
                focus:ring-2
                focus:ring-green-600
              "
            />

            {pesquisa && (

              <button
                type="button"
                onClick={() => setPesquisa("")}
                className="
                  absolute
                  right-4
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                  hover:text-gray-700
                "
              >
                <X size={18}/>
              </button>

            )}

          </div>

          <p className="text-sm text-gray-500 mb-5">

            {abaAtiva === "produtos"

              ? `${produtosFiltrados.length} produto${produtosFiltrados.length !== 1 ? "s" : ""}`

              : `${servicosFiltrados.length} serviço${servicosFiltrados.length !== 1 ? "s" : ""}`

            }

          </p>

          {/* Conteúdo das abas */}
          <div className="flex items-center border-b mb-6">

            <button
              onClick={() => setAbaAtiva("produtos")}
              className={`
                px-8
                py-5
                text-lg
                font-semibold
                transition-all
                border-b-4
                flex-1
                ${
                  abaAtiva === "produtos"
                    ? "border-green-600 text-green-700 bg-green-50"
                    : "border-transparent text-gray-500 hover:text-green-700"
                }
              `}
            >
              Produtos ({produtos.length})
            </button>

            <button
              onClick={() => setAbaAtiva("servicos")}
              className={`
                px-8
                py-5
                text-lg
                font-semibold
                transition-all
                border-b-4
                flex-1
                ${
                  abaAtiva === "servicos"
                    ? "border-green-600 text-green-700 bg-green-50"
                    : "border-transparent text-gray-500 hover:text-green-700"
                }
              `}
            >
              Serviços ({servicos.length})
            </button>

          </div>

          <div key={abaAtiva} className="p-6 animate-fade-in">

            {abaAtiva === "produtos" ? (

              produtos.length === 0 ? (

                <div className="text-center py-12 text-gray-500">

                  Este vendedor ainda não possui produtos.

                </div>

              ) : produtosFiltrados.length === 0 ? (

                <div className="text-center py-12">

                  <p className="text-lg font-semibold text-gray-700">

                    Nenhum produto encontrado.

                  </p>

                  <p className="text-sm text-gray-500 mt-2">

                    Tente pesquisar por outro nome ou categoria.

                  </p>

                </div>

              ) : (

                <div
                  className="
                    grid
                    grid-cols-1
                    sm:grid-cols-2
                    lg:grid-cols-3
                    xl:grid-cols-4
                    gap-6
                  "
                >

                  {produtosFiltrados.map((produto) => (

                    <CardProdutoLoja
                      key={produto.id}
                      produto={produto}
                      vendedor={vendedor}
                    />

                  ))}

                </div>

              )

            ) : (

              servicos.length === 0 ? (

                <div className="text-center py-12 text-gray-500">

                  Este vendedor ainda não possui serviços.

                </div>

              ) : servicosFiltrados.length === 0 ? (

                <div className="text-center py-12">

                  <p className="text-lg font-semibold text-gray-700">

                    Nenhum serviço encontrado.

                  </p>

                  <p className="text-sm text-gray-500 mt-2">

                    Tente pesquisar por outro nome ou tipo de serviço.

                  </p>

                </div>

              ) : (

                <div
                  className="
                    grid
                    grid-cols-1
                    sm:grid-cols-2
                    lg:grid-cols-3
                    xl:grid-cols-4
                    gap-6
                  "
                >

                  {servicosFiltrados.map((servico) => (

                    <CardServicoLoja
                        key={servico.id}
                        servico={servico}
                        vendedor={vendedor}
                    />

                  ))}

                </div>

              )

            )}

          </div>

        </div>

        
      </main>

      <Rodape />
    </div>
  );
}
