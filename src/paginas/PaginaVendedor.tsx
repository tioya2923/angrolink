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
import PerfilVendedorHero from "@/componentes/PerfilVendedorHero";
import CardProdutoLoja from "@/componentes/CardProdutoLoja";

import {
  fetchVendedorPorId,
  fetchProdutosPorVendedor
} from '@/services/api';

import { gerarLinkWhatsApp } from '@/lib/whatsapp';

import { Vendedor, Produto } from '@/tipos';
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
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [pesquisa, setPesquisa] = useState("");
  const [versaoTempoReal, setVersaoTempoReal] = useState(0);

  useAtualizacaoTempoReal(['vendedores', 'produtos'], () => setVersaoTempoReal(v => v + 1));

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
          return;
        }

        setVendedor(vendedorData);

        const produtosData = await fetchProdutosPorVendedor(vendedorData.id);

        setProdutos(Array.isArray(produtosData) ? produtosData : []);

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
      produtos.reduce(
        (total: number, item: any) =>
          total + Number(item.visualizacoes || 0),
        0
      );

    const contactos =
      produtos.reduce(
        (total: number, item: any) =>
          total + Number(item.cliques_whatsapp || 0),
        0
      );

    return {
      produtos: produtos.length,
      visualizacoes,
      contactos,
    };

  }, [produtos]);

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
          servicos={[]}
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
            {produtosFiltrados.length} produto{produtosFiltrados.length !== 1 ? "s" : ""}
          </p>

          <div className="p-6 animate-fade-in">

            {(

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

            )}

          </div>

        </div>

        
      </main>

      <Rodape />
    </div>
  );
}
